import crypto from 'crypto';
import { getKey } from './encryption';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface H5Session {
  open_id: string;
  name: string;
  iat: number;
  exp: number;
}

export async function createSessionToken(openId: string, name: string): Promise<string> {
  const payload: H5Session = {
    open_id: openId,
    name,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
  const key = await getKey();
  const sig = crypto.createHmac('sha256', key).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<H5Session | null> {
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  try {
    const key = await getKey();
    const expectedSig = crypto.createHmac('sha256', key).update(payloadB64).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const session = JSON.parse(payloadStr) as H5Session;

    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}