const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.version, require('../package.json').version);
assert.equal(manifest.manifest_version, 3);
const files = [manifest.background.service_worker, manifest.action.default_popup,
  ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])];
for (const file of new Set(files)) assert.ok(fs.existsSync(path.join(root, file)), `Missing runtime file: ${file}`);
for (const [size, file] of Object.entries(manifest.icons)) {
  const png = fs.readFileSync(path.join(root, file));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
for (const file of ['background.js', 'money.js', 'content.js', 'popup.js', 'test.cjs', 'test-content.cjs'])
  execFileSync(process.execPath, ['--check', path.join(root, file)]);
console.log('PASS: manifest, runtime references, icon dimensions, versions, JavaScript syntax');
