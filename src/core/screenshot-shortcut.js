const DEFAULT_SCREENSHOT_SHORTCUT = 'CommandOrControl+Alt+A';
function validateShortcut(value) {
  const accelerator = String(value || '').trim();
  const parts = accelerator.split('+');
  if (parts.length < 2 || parts.length > 5 || new Set(parts.map(item => item.toLowerCase())).size !== parts.length
    || !parts.slice(0, -1).every(item => /^(CommandOrControl|Command|Control|Ctrl|Alt|Option|Shift|Super|Meta)$/i.test(item))
    || !parts.slice(0, -1).some(item => /^(CommandOrControl|Command|Control|Ctrl|Alt|Option|Super|Meta)$/i.test(item))
    || !/^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space|PrintScreen)$/i.test(parts.at(-1))) throw new Error('请使用包含 Command、Ctrl 或 Alt 的组合键，例如 CommandOrControl+Alt+A');
  return accelerator;
}
function canonicalShortcut(value, platform) {
  const parts = value.toLowerCase().split('+');
  const key = parts.pop();
  const modifiers = parts.map(item => item === 'commandorcontrol' ? (platform === 'darwin' ? 'command' : 'control') : item === 'ctrl' ? 'control' : item === 'option' ? 'alt' : item);
  return `${modifiers.sort().join('+')}+${key}`;
}
function createScreenshotShortcut(api, onCapture, platform = process.platform) {
  let state = { accelerator: DEFAULT_SCREENSHOT_SHORTCUT, registered: false, error: '' };
  function setShortcut(value) {
    const accelerator = validateShortcut(value);
    if (state.registered && canonicalShortcut(accelerator, platform) === canonicalShortcut(state.accelerator, platform)) return { ...state };
    let registered = false;
    try { registered = api.register(accelerator, onCapture); } catch { /* invalid system accelerator */ }
    if (!registered) throw new Error('该截图快捷键已被系统或其他应用占用，请更换组合键');
    if (state.registered) api.unregister(state.accelerator);
    state = { accelerator, registered: true, error: '' };
    return { ...state };
  }
  return {
    setShortcut,
    registerInitial: (value = DEFAULT_SCREENSHOT_SHORTCUT) => {
      try { return setShortcut(value); }
      catch (error) { state = { ...state, accelerator: String(value), error: error.message }; return { ...state }; }
    },
    getState: () => ({ ...state }),
    dispose: () => { if (state.registered) api.unregister(state.accelerator); state.registered = false; },
  };
}
module.exports = { DEFAULT_SCREENSHOT_SHORTCUT, createScreenshotShortcut, validateShortcut };
