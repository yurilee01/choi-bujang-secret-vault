
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

let verifier;

function getVerifier(secretKey) {
  if (!verifier) {
    verifier = createLoginVerifier({
      config,
      supabaseSecretKey: secretKey,
    });
  }
  return verifier;
}

function getNoteId(request) {
  const queryId = request.query?.id;
  if (typeof queryId === 'string') return queryId;

  const url = new URL(request.url, 'https://example.com');
  return url.searchParams.get('id');
}

function isRestoreRequest(request) {
  const url = new URL(request.url, 'https://example.com');

  return (
    url.pathname === '/api/notes/restore'
    || request.query?.restore === '1'
    || url.searchParams.get('restore') === '1'
  );
}

function validText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function contentHash(note) {
  return createHash('sha256')
    .update(JSON.stringify({
      title: note.title,
      body: note.body,
    }), 'utf8')
    .digest('hex');
}

// 테스트에서는 가짜 로그인 검증기와 Supabase를 주입할 수 있다.
export function createNotesHandler({
  verifyLogin: injectedVerifyLogin,
  createSupabaseClient = createClient,
} = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];

    if (!allowedMethods.includes(request.method)) {
      response.setHeader('Allow', allowedMethods.join(', '));
      return response.status(405).json({
        error: 'METHOD_NOT_ALLOWED',
      });
    }

    const authorization = request.headers?.authorization;

    if (typeof authorization !== 'string') {
      return response.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return response.status(500).json({
        error: 'SERVER_CONFIGURATION_ERROR',
      });
    }

    try {
      const verifyLogin =
        injectedVerifyLogin ?? getVerifier(supabaseSecretKey);

      const verifiedUser = await verifyLogin(authorization);

      if (!verifiedUser?.userId) {
        return response.status(401).json({
          error: 'INVALID_AUTHENTICATION',
        });
      }

      const supabase = createSupabaseClient(
        supabaseUrl,
        supabaseSecretKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

      // 전용 복원 경로: 심사관 B 계정만 허용한다.
      if (isRestoreRequest(request)) {
        if (request.method !== 'POST') {
          return response.status(405).json({
            error: 'RESTORE_METHOD_NOT_ALLOWED',
          });
        }

        if (
          verifiedUser.kind !== 'judge'
          || verifiedUser.identity !== 'b'
        ) {
          return response.status(403).json({
            error: 'RESTORE_FORBIDDEN',
          });
        }

        const backup = request.body?.backup;
        const note = backup?.note;

        if (
          backup?.version !== 'note-backup-v1'
          || !note
          || typeof note !== 'object'
          || Array.isArray(note)
          || !UUID_PATTERN.test(note.id ?? '')
          || !UUID_PATTERN.test(note.owner_id ?? '')
          || note.owner_id !== verifiedUser.userId
          || !validText(note.title)
          || !validText(note.body)
          || note.title !== note.title.trim()
          || note.body !== note.body.trim()
          || !SHA256_PATTERN.test(backup.contentSha256 ?? '')
        ) {
          return response.status(400).json({
            error: 'INVALID_RESTORE_BACKUP',
          });
        }

        // 백업에 기록된 해시를 서버에서 다시 계산한다.
        if (contentHash(note) !== backup.contentSha256) {
          return response.status(400).json({
            error: 'RESTORE_BACKUP_HASH_MISMATCH',
          });
        }

        // 기존 메모가 있으면 덮어쓰지 않고 중단한다.
        const { data: existing, error: lookupError } = await supabase
          .from('notes')
          .select('id')
          .eq('id', note.id)
          .maybeSingle();

        if (lookupError) throw lookupError;

        if (existing) {
          return response.status(409).json({
            error: 'RESTORE_TARGET_ALREADY_EXISTS',
          });
        }

        // 백업에 들어 있는 ID와 소유자를 그대로 사용한다.
        const restoredNote = {
          id: note.id,
          owner_id: note.owner_id,
          title: note.title,
          body: note.body,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('notes')
          .insert(restoredNote)
          .select('id,owner_id,title,body')
          .single();

        if (insertError) throw insertError;

        // 삽입 응답의 ID·소유자·내용 해시를 다시 확인한다.
        if (
          inserted?.id !== note.id
          || inserted?.owner_id !== note.owner_id
          || contentHash(inserted) !== backup.contentSha256
        ) {
          return response.status(409).json({
            error: 'RESTORE_RESULT_MISMATCH',
          });
        }

        // DB에서 다시 읽어 최종 상태를 검증한다.
        const { data: verified, error: verifyError } = await supabase
          .from('notes')
          .select('id,owner_id,title,body')
          .eq('id', note.id)
          .eq('owner_id', verifiedUser.userId)
          .maybeSingle();

        if (verifyError) throw verifyError;

        if (
          !verified
          || verified.id !== note.id
          || verified.owner_id !== note.owner_id
          || contentHash(verified) !== backup.contentSha256
        ) {
          return response.status(409).json({
            error: 'RESTORE_VERIFICATION_FAILED',
          });
        }

        return response.status(201).json({
          id: verified.id,
          owner_id: verified.owner_id,
          contentSha256: contentHash(verified),
          restored: true,
        });
      }

      const noteId = getNoteId(request);

      // 로그인한 사용자의 메모 목록 조회
      if (request.method === 'GET' && !noteId) {
        const { data, error } = await supabase
          .from('notes')
          .select('id,title,body')
          .eq('owner_id', verifiedUser.userId);

        if (error) throw error;
        return response.status(200).json(data);
      }

      // 일반 메모 추가: 기존 기능 유지
      if (request.method === 'POST') {
        const { id, title, body } = request.body ?? {};

        if (
          (id !== undefined &&
            (typeof id !== 'string' || !UUID_PATTERN.test(id))) ||
          !validText(title) ||
          !validText(body)
        ) {
          return response.status(400).json({
            error: 'INVALID_NOTE_DATA',
          });
        }

        const newNote = {
          ...(id ? { id } : {}),
          title: title.trim(),
          body: body.trim(),
          owner_id: verifiedUser.userId,
        };

        const { data, error } = await supabase
          .from('notes')
          .insert(newNote)
          .select('id')
          .single();

        if (error) throw error;

        return response.status(201).json({ id: data.id });
      }

      if (!UUID_PATTERN.test(noteId ?? '')) {
        return response.status(400).json({
          error: 'INVALID_NOTE_ID',
        });
      }

      // 개별 메모 조회: ID와 소유자 모두 확인
      if (request.method === 'GET') {
        const { data, error } = await supabase
          .from('notes')
          .select('id,title,body')
          .eq('id', noteId)
          .eq('owner_id', verifiedUser.userId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return response.status(404).json({
            error: 'NOTE_NOT_FOUND',
          });
        }

        return response.status(200).json(data);
      }

      // 메모 수정: ID와 소유자 모두 확인
      if (request.method === 'PUT') {
        const { title, body } = request.body ?? {};

        if (!validText(title) || !validText(body)) {
          return response.status(400).json({
            error: 'INVALID_NOTE_DATA',
          });
        }

        const { data, error } = await supabase
          .from('notes')
          .update({
            title: title.trim(),
            body: body.trim(),
          })
          .eq('id', noteId)
          .eq('owner_id', verifiedUser.userId)
          .select('id,title,body')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return response.status(404).json({
            error: 'NOTE_NOT_FOUND',
          });
        }

        return response.status(200).json(data);
      }

      // 메모 삭제: ID와 소유자 모두 확인
      if (request.method === 'DELETE') {
        const { data, error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)
          .eq('owner_id', verifiedUser.userId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return response.status(404).json({
            error: 'NOTE_NOT_FOUND',
          });
        }

        return response.status(200).json({ id: data.id });
      }
    } catch (error) {
      console.error('Notes API failed:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status,
      });

      return response.status(502).json({
        error: 'UPSTREAM_SERVICE_ERROR',
      });
    }
  };
}

export default createNotesHandler();
