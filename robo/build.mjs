// Gera robo/dist com um unico Code.js para o clasp (ordem de carga garantida).
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dist = new URL('./dist/', import.meta.url);
mkdirSync(dist, { recursive: true });

const shim = `
var __tribunaCrypto = {
  getRandomValues: function (arr) {
    var i = 0;
    while (i < arr.length) {
      var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random());
      for (var j = 0; j < d.length && i < arr.length; j++) arr[i++] = d[j] & 255;
    }
    return arr;
  }
};
if (typeof globalThis.crypto === 'undefined') globalThis.crypto = __tribunaCrypto;
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = function () {};
  globalThis.TextEncoder.prototype.encode = function (s) {
    var b = Utilities.newBlob(String(s)).getBytes(), o = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) o[i] = b[i] & 255;
    return o;
  };
}
`;

const out = await build({
  entryPoints: [new URL('./src/webpush_entry.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  bundle: true, format: 'iife', globalName: 'WebPush', target: 'es2020',
  minify: true, write: false, legalComments: 'none'
});

const code = readFileSync(new URL('./src/Code.js', import.meta.url), 'utf8');
writeFileSync(new URL('./Code.js', dist), shim + '\n' + out.outputFiles[0].text + '\n' + code);
writeFileSync(new URL('./appsscript.json', dist), JSON.stringify({
  timeZone: 'America/Sao_Paulo', runtimeVersion: 'V8', exceptionLogging: 'STACKDRIVER',
  oauthScopes: ['https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.scriptapp'],
  webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }
}, null, 2));
console.log('ok', (shim.length + out.outputFiles[0].text.length + code.length) / 1024 | 0, 'KB');
