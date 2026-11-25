import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

const COOKIE_NAME = 'byte_back_device';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sign(deviceId, secret) {
  return createHmac('sha256', secret)
    .update(deviceId, 'utf8')
    .digest('base64url');
}

export function createDeviceCookie(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('INVALID_DEVICE_COOKIE_SECRET');
  }

  const deviceId = randomUUID();
  const signature = sign(deviceId, secret);
  const value = `${deviceId}.${signature}`;

  return {
    deviceId,
    cookie: `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`,
  };
}

export function readDeviceCookie(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new TypeError('INVALID_DEVICE_COOKIE_SECRET');
  }

  const cookieHeader = request.headers?.cookie;

  if (typeof cookieHeader !== 'string') return null;

  const entry = cookieHeader
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE_NAME}=`));

  if (!entry) return null;

  const value = entry.slice(COOKIE_NAME.length + 1);
  const separator = value.lastIndexOf('.');

  if (separator < 0) return null;

  const deviceId = value.slice(0, separator);
  const suppliedSignature = value.slice(separator + 1);

  if (!UUID_PATTERN.test(deviceId)) return null;

  const expectedSignature = sign(deviceId, secret);
  const supplied = Buffer.from(suppliedSignature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');

  if (
    supplied.length !== expected.length
    || !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  return deviceId;
}

export const DEVICE_COOKIE_NAME = COOKIE_NAME;
