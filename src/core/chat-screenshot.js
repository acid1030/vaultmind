const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { MAX_ATTACHMENT_BYTES } = require('./chat-attachments');

async function captureScreenshot({ platform = process.platform, window, permission = () => 'unknown', execute = execFile }) {
  if (platform !== 'darwin') throw new Error('当前截图按钮支持 macOS；请使用系统截图后粘贴到聊天输入框');
  const denied = () => ['denied', 'restricted'].includes(permission());
  if (denied()) throw new Error('请在系统设置 → 隐私与安全性 → 屏幕录制中允许 AxonMind 截图，然后重新打开应用');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'axonmind-capture-'));
  const filePath = path.join(directory, 'screenshot.png');
  const restore = window && !window.isDestroyed() && window.isVisible();
  try {
    if (restore) window.hide();
    try {
      await new Promise((resolve, reject) => execute('/usr/sbin/screencapture', ['-i', '-x', filePath], { maxBuffer: 1024 * 1024 }, error => error ? reject(error) : resolve()));
    } catch (error) {
      if (denied()) throw new Error('截图需要屏幕录制权限，请在系统设置中允许后重试');
      if (!fs.existsSync(filePath) && error.code === 1) return { canceled: true };
      throw new Error('无法截图，请检查系统屏幕录制权限，或使用系统截图后粘贴');
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).size) return { canceled: true };
    if (fs.statSync(filePath).size > MAX_ATTACHMENT_BYTES) throw new Error('截图超过 12MB，请选择较小的区域');
    return { canceled: false, bytes: fs.readFileSync(filePath), name: `截图-${new Date().toISOString().replace(/[:.]/g, '-')}.png` };
  } finally {
    try { fs.rmSync(directory, { recursive: true, force: true }); }
    finally { if (restore && !window.isDestroyed()) { window.show(); window.focus(); } }
  }
}
module.exports = { captureScreenshot };
