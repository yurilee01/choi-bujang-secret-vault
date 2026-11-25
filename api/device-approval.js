import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import {
  createDeviceCookie,
  readDeviceCookie,
} from '../src/device-approval.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

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

export function createDeviceApprovalHandler({
  verifyLogin: injectedVerifyLogin,
  createSupabaseClient = createClient,
} = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
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
    const cookieSecret = process.env.DEVICE_COOKIE_SECRET;

    if (!supabaseUrl || !supabaseSecretKey || !cookieSecret) {
      return response.status(500).json({
        error: 'SERVER_CONFIGURATION_ERROR',
      });
    }

    try {
      const verifyLogin =
        injectedVerifyLogin ?? getVerifier(supabaseSecretKey);

      const verifiedUser = await verifyLogin(authorization);

      if (!verifiedUser?.userId || verifiedUser.kind === 'judge') {
        return response.status(401).json({
          error: 'INVALID_AUTHENTICATION',
        });
      }

      if (verifiedUser.kind && verifiedUser.kind !== 'student') {
        return response.status(403).json({
          error: 'STUDENT_ACCOUNT_REQUIRED',
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

      let deviceId = readDeviceCookie(request, cookieSecret);

      if (!deviceId) {
        const issued = createDeviceCookie(cookieSecret);
        deviceId = issued.deviceId;
        response.setHeader('Set-Cookie', issued.cookie);
      }

      const lookup = await supabase
        .from('device_approvals')
        .select('approved,approved_at')
        .eq('user_id', verifiedUser.userId)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (lookup.error) throw lookup.error;

      let approval = lookup.data;

      if (!approval) {
        const inserted = await supabase
          .from('device_approvals')
          .insert({
            user_id: verifiedUser.userId,
            device_id: deviceId,
            approved: false,
            approved_at: null,
          })
          .select('approved,approved_at')
          .single();

        if (inserted.error) throw inserted.error;
        approval = inserted.data;
      }

      const approved =
        approval?.approved === true
        && typeof approval.approved_at === 'string';

      return response.status(200).json({
        approved,
        status: approved ? 'approved' : 'pending',
        userId: verifiedUser.userId,
        deviceId,
      });
    } catch (error) {
      console.error('Device approval API failed:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status,
      });

      return response.status(502).json({
        error: 'DEVICE_APPROVAL_SERVICE_ERROR',
      });
    }
  };
}

export default createDeviceApprovalHandler();
