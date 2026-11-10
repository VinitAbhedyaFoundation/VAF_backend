import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const TOKEN_BYTES = 32;

export function generateCsrfToken(
  secret: string,
  sessionBinding: string,
): string {
  const nonce = randomBytes(TOKEN_BYTES).toString('hex');

  const signature = createHmac('sha256', secret)
    .update(`${sessionBinding}:${nonce}`)
    .digest('hex');

  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(
  token: string,
  secret: string,
  sessionBinding: string,
): boolean {
  if (!token || !secret || !sessionBinding) {
    return false;
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return false;
  }

  const [nonce, receivedSignature] = parts;

  if (
    !/^[a-f0-9]{64}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(receivedSignature)
  ) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(`${sessionBinding}:${nonce}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(receivedSignature, 'hex');

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}