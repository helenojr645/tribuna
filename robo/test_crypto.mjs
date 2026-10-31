// Prova a criptografia do bundle contra uma implementacao independente (node:crypto).
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const code = readFileSync(new URL('./dist/Code.js', import.meta.url), 'utf8');
const ctx = {
  Uint8Array, TextEncoder, console, Date, Math,
  crypto: globalThis.crypto,
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: 'x' },
    computeDigest: (_a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => (b > 127 ? b - 256 : b)),
    newBlob: s => ({ getBytes: () => [...Buffer.from(s)] }),
    formatDate: () => '12'
  }
};
vm.createContext(ctx);
vm.runInContext(code + ';this.WebPush=WebPush;this.randomBytes_=randomBytes_;', ctx);
const { WebPush, randomBytes_ } = ctx;
const b = u => Buffer.from(u).toString('base64url');

// 1. VAPID: assinatura ES256 verificada pelo node:crypto
const keys = WebPush.generateVapid();
const header = WebPush.vapidHeader('https://web.push.apple.com/abc', keys, 'https://helenojr645.github.io/tribuna/', 1800000000);
const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(k, keys.publicKey);
const [h, p, s] = token.split('.');
const pub = crypto.createPublicKey({
  key: { kty: 'EC', crv: 'P-256', x: b(Buffer.from(k, 'base64url').subarray(1, 33)), y: b(Buffer.from(k, 'base64url').subarray(33)) },
  format: 'jwk'
});
assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + p), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')), 'assinatura VAPID invalida');
const claims = JSON.parse(Buffer.from(p, 'base64url'));
assert.equal(claims.aud, 'https://web.push.apple.com');
assert.ok(claims.exp - 1800000000 <= 3600, 'exp acima de 1h');

// 2. Payload: decifrado como um navegador faria (RFC 8291)
const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
const auth = crypto.randomBytes(16);
const text = JSON.stringify({ title: 'GOL do São Paulo!', body: 'acentuação ok' });
const cipher = Buffer.from(WebPush.encryptPayload(text, b(ua.getPublicKey()), b(auth), randomBytes_));
const salt = cipher.subarray(0, 16);
assert.equal(cipher.readUInt32BE(16), 4096);
assert.equal(cipher[20], 65);
const asPub = cipher.subarray(21, 86);
const shared = ua.computeSecret(asPub);
const hk = (ikm, sl, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, sl, info, n));
const prk = hk(shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPub]), 32);
const cek = hk(prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
const nonce = hk(prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
const body = cipher.subarray(86);
const dec = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
dec.setAuthTag(body.subarray(body.length - 16));
const plain = Buffer.concat([dec.update(body.subarray(0, body.length - 16)), dec.final()]);
assert.equal(plain[plain.length - 1], 2);
assert.equal(plain.subarray(0, plain.length - 1).toString(), text);

// 3. Duas execucoes nunca repetem chave efemera nem salt
const c2 = Buffer.from(WebPush.encryptPayload(text, b(ua.getPublicKey()), b(auth), randomBytes_));
assert.notDeepEqual(c2.subarray(0, 86), cipher.subarray(0, 86));
console.log('CRIPTO OK: VAPID e aes128gcm validados contra node:crypto');
