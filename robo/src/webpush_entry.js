// Criptografia do Web Push (RFC 8291 + VAPID RFC 8292) sobre libs auditadas (noble).
// Empacotado com esbuild para rodar dentro do Apps Script, que nao tem WebCrypto.
import { p256 } from '@noble/curves/nist.js';
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

const te = new TextEncoder();

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

function b64u(bytes) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s += A[(n >> 18) & 63] + A[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += A[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += A[n & 63];
  }
  return s;
}

function unb64u(str) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const clean = String(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor(clean.length * 6 / 8));
  let bits = 0, acc = 0, j = 0;
  for (const ch of clean) {
    const v = A.indexOf(ch);
    if (v < 0) throw new Error('base64url invalido');
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; }
  }
  return out;
}

export function generateVapid() {
  const sk = p256.utils.randomSecretKey();
  return { privateKey: b64u(sk), publicKey: b64u(p256.getPublicKey(sk, false)) };
}

// Monta o cabecalho Authorization. O relogio vem de fora para ser testavel.
export function vapidHeader(endpoint, keys, subject, nowSec) {
  const aud = endpoint.match(/^https:\/\/[^/]+/)[0];
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  // A Apple recusa exp acima de 1 hora.
  const body = b64u(te.encode(JSON.stringify({ aud, exp: nowSec + 3000, sub: subject })));
  const unsigned = head + '.' + body;
  const sig = p256.sign(te.encode(unsigned), unb64u(keys.privateKey), { prehash: true, format: 'compact' });
  return 'vapid t=' + unsigned + '.' + b64u(sig) + ', k=' + keys.publicKey;
}

export function encryptPayload(text, p256dh, auth, randomBytes) {
  const uaPub = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const asSk = p256.utils.randomSecretKey();
  const asPub = p256.getPublicKey(asSk, false);
  const shared = p256.getSharedSecret(asSk, uaPub, true).slice(1);
  const salt = randomBytes(16);
  const prk = hkdf(sha256, shared, authSecret, concat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = hkdf(sha256, prk, salt, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(sha256, prk, salt, te.encode('Content-Encoding: nonce\0'), 12);
  const plain = concat(te.encode(text), new Uint8Array([2]));
  const cipher = gcm(cek, nonce).encrypt(plain);
  const header = concat(salt, new Uint8Array([0, 0, 16, 0, 65]), asPub);
  return concat(header, cipher);
}
