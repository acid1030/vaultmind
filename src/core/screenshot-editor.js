const path = require('path');
const { MAX_ATTACHMENT_BYTES } = require('./chat-attachments');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function createScreenshotEditor({ BrowserWindow, ipcMain, nativeImage, screen }) {
  let active = null;
  function requireEditor(event) {
    if (!active || event.sender !== active.window.webContents) throw new Error('无权访问截图编辑器');
    active.check();
    return active;
  }
  function settle(current, result) {
    if (active !== current) return;
    active = null;
    clearInterval(current.timer);
    current.bytes = null;
    current.image = null;
    current.resolve(result);
    if (!current.window.isDestroyed()) current.window.close();
  }
  ipcMain.handle('screenshot:getSource', event => {
    const current = requireEditor(event);
    return { image: current.image, name: current.name, ...current.size };
  });
  ipcMain.handle('screenshot:finish', (event, input) => {
    const current = requireEditor(event);
    if (typeof input?.base64 !== 'string' || input.base64.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4
      || input.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new Error('标注后的 PNG 图片无效或超过 12MB');
    const bytes = Buffer.from(input.base64, 'base64');
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('截图必须是 PNG 图片');
    const image = nativeImage.createFromBuffer(bytes);
    const size = image.getSize();
    if (image.isEmpty() || size.width !== current.size.width || size.height !== current.size.height) throw new Error('截图图片尺寸不匹配');
    settle(current, { canceled: false, bytes, name: current.name });
    return { ok: true };
  });
  ipcMain.handle('screenshot:cancel', event => { const current = requireEditor(event); settle(current, { canceled: true }); return { ok: true }; });
  return {
    isOpen: () => Boolean(active),
    edit: ({ bytes, name, check }) => {
      if (active) throw new Error('截图标注窗口正在使用中');
      check();
      if (!Buffer.isBuffer(bytes) || bytes.length > MAX_ATTACHMENT_BYTES || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('截图 PNG 图片无效或超过 12MB');
      const image = nativeImage.createFromBuffer(bytes);
      const size = image.getSize();
      if (image.isEmpty() || !size.width || !size.height || size.width * size.height > 80 * 1000 * 1000) throw new Error('截图图片尺寸过大或无法读取');
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const width = Math.min(workArea.width - 32, Math.max(760, size.width + 56));
      const height = Math.min(workArea.height - 32, Math.max(500, size.height + 160));
      const window = new BrowserWindow({ title: '截图标注', width, height,
        x: Math.round(workArea.x + (workArea.width - width) / 2), y: Math.round(workArea.y + (workArea.height - height) / 2),
        minWidth: Math.min(640, width), minHeight: Math.min(400, height), show: false,
        backgroundColor: '#141b24', alwaysOnTop: true, skipTaskbar: true, fullscreenable: false,
        webPreferences: { preload: path.join(__dirname, '..', 'screenshot', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      const result = new Promise(resolve => {
        const current = { window, bytes, name, check, size, image: image.toDataURL(), resolve, timer: null };
        active = current;
        current.timer = setInterval(() => { try { check(); } catch { settle(current, { canceled: true }); } }, 300);
        window.once('closed', () => settle(current, { canceled: true }));
        window.once('ready-to-show', () => { if (active === current) { window.show(); window.focus(); } });
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.on('will-navigate', event => event.preventDefault());
        window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
        window.loadFile(path.join(__dirname, '..', 'screenshot', 'editor.html')).catch(() => settle(current, { canceled: true }));
      });
      return result;
    },
    cancel: () => { if (active) settle(active, { canceled: true }); },
    dispose: () => {
      if (active) settle(active, { canceled: true });
      for (const name of ['screenshot:getSource', 'screenshot:finish', 'screenshot:cancel']) ipcMain.removeHandler(name);
    },
  };
}
module.exports = { createScreenshotEditor };
