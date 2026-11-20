import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLoginVerifier } from '../src/verify-login.mjs';

const ISSUER = 'https://yggaxjcaqxswsplprkjo.supabase.co/auth/v1';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const config = {
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  publicAppUrl: 'https://choi-bujang-secret-vault-umber-beta.vercel.app',
  identityProvider: {
    issuer: ISSUER,
    audience: 'authenticated',
    jwksUrl: `${ISSUER}/.well-known/jwks.json`,
  },
};

function makeToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER })).toString('base64url');
  return `${header}.${payload}.signature`;
}

function createVerifier(aal) {
  const token = makeToken();
  const verifier = createLoginVerifier({
    config,
    judgeKeySet: async () => ({}),
    supabaseClient: {
      auth: {
        async getClaims() {
          return {
            data: {
              claims: {
                iss: ISSUER,
                aud: 'authenticated',
                role: 'authenticated',
                sub: USER_ID,
                exp: Math.floor(Date.now() / 1000) + 3600,
                ...(aal === undefined ? {} : { aal }),
              },
            },
            error: null,
          };
        },
      },
    },
  });
  return { token, verifier };
}

test('AAL1 학생 인증은 거부한다', async () => {
  const { token, verifier } = createVerifier('aal1');
  assert.equal(await verifier(`Bearer ${token}`), null);
});

test('AAL2 학생 인증은 통과한다', async () => {
  const { token, verifier } = createVerifier('aal2');
  assert.deepEqual(await verifier(`Bearer ${token}`), {
    kind: 'student',
    userId: USER_ID,
  });
});

test('인증 단계 정보가 없으면 거부한다', async () => {
  const { token, verifier } = createVerifier(undefined);
  assert.equal(await verifier(`Bearer ${token}`), null);
});
