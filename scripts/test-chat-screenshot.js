const assert = require('node:assert/strict');
const fs = require('node:fs');
const { captureScreenshot } = require('../src/core/chat-screenshot');
async function main() {
  let hidden = 0, shown = 0, capturePath;
  const window = { isVisible: () => true, isDestroyed: () => false, hide: () => hidden++, show: () => shown++, focus: () => {} };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
  const result = await captureScreenshot({ platform: 'darwin', window, permission: () => 'granted', execute: (command, args, options, callback) => {
    assert.equal(command, '/usr/sbin/screencapture');
    assert.ok(args.includes('-i'));
    capturePath = args.at(-1);
    fs.writeFileSync(capturePath, png);
    callback(null);
  } });
  assert.ok(result.bytes.equals(png));
  assert.equal(hidden, 1); assert.equal(shown, 1);
  assert.equal(fs.existsSync(capturePath), false, 'temporary screenshots must be removed');
  const canceled = await captureScreenshot({ platform: 'darwin', window, permission: () => 'granted', execute: (_command, args, _options, callback) => { capturePath = args.at(-1); callback(Object.assign(new Error('cancel'), { code: 1 })); } });
  assert.equal(canceled.canceled, true);
  assert.equal(fs.existsSync(capturePath), false);
  await assert.rejects(captureScreenshot({ platform: 'darwin', window, permission: () => 'denied' }), /屏幕录制/);
  await assert.rejects(captureScreenshot({ platform: 'win32', window }), /系统截图/);
  console.log('Screenshot workflow tests passed: interactive capture, cancellation, permission error, window restore and temp cleanup.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
