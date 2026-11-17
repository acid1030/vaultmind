const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createScreenshotEditor } = require('../src/core/screenshot-editor');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
async function main() {
  const handlers = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), removeHandler: name => handlers.delete(name) };
  class Window extends EventEmitter {
    static windows = [];
    constructor(options) { super(); this.options = options; this.webContents = { setWindowOpenHandler() {}, on() {}, session: { setPermissionRequestHandler() {} } }; Window.windows.push(this); }
    isDestroyed() { return this.destroyed || false; }
    loadFile() { queueMicrotask(() => this.emit('ready-to-show')); return Promise.resolve(); }
    show() {} focus() {} close() { this.destroyed = true; this.emit('closed'); }
  }
  const nativeImage = { createFromBuffer: bytes => ({ isEmpty: () => !bytes.equals(png), getSize: () => ({ width: 1, height: 1 }), toDataURL: () => `data:image/png;base64,${png.toString('base64')}` }) };
  const screen = { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 900 } }) };
  const editor = createScreenshotEditor({ BrowserWindow: Window, ipcMain, nativeImage, screen });
  const result = editor.edit({ bytes: png, name: '截图.png', check: () => {} });
  const window = Window.windows.at(-1);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  await assert.rejects(async () => handlers.get('screenshot:getSource')({ sender: {} }), /无权/);
  const source = await handlers.get('screenshot:getSource')({ sender: window.webContents });
  assert.equal(source.width, 1);
  await assert.rejects(async () => handlers.get('screenshot:finish')({ sender: window.webContents }, { base64: 'not-an-image' }), /PNG|图片/);
  assert.equal(editor.isOpen(), true, 'invalid output must not silently finish');
  await handlers.get('screenshot:finish')({ sender: window.webContents }, { base64: png.toString('base64') });
  assert.ok((await result).bytes.equals(png));
  assert.equal(editor.isOpen(), false);
  const canceled = editor.edit({ bytes: png, name: '取消.png', check: () => {} });
  editor.cancel();
  assert.equal((await canceled).canceled, true);
  let valid = true;
  const fenced = editor.edit({ bytes: png, name: '登录变化.png', check: () => { if (!valid) throw new Error('登录状态已变化'); } });
  const fencedWindow = Window.windows.at(-1);
  valid = false;
  await assert.rejects(async () => handlers.get('screenshot:finish')({ sender: fencedWindow.webContents }, { base64: png.toString('base64') }), /登录/);
  editor.cancel(); await fenced;
  editor.dispose();
  assert.equal(handlers.size, 0);
  console.log('Screenshot editor controller tests passed: sender isolation, output validation, cancel and session fencing.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
