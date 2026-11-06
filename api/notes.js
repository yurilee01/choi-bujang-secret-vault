import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function validText(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

      // 새 메모 추가
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
