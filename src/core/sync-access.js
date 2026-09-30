const MODES = new Set(['personal', 'enterprise', 'managed']);

function normalizeMode(mode, settings = {}) {
  if (MODES.has(mode)) return mode;
  // Existing installations only had user-supplied credentials, so preserve
  // their behavior instead of silently switching them to a hosted service.
  if (settings.appId || settings.appSecret) return 'personal';
  return 'managed';
}

function normalizeServiceUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw new Error('托管服务地址格式无效'); }
  if (url.protocol !== 'https:') {
    throw new Error('托管服务必须使用 HTTPS');
  }
  return url.toString().replace(/\/$/, '');
}

function readiness(settings = {}, environmentUrl = '') {
  const mode = normalizeMode(settings.syncAccessMode, settings);
  if (mode === 'managed') {
    const serviceUrl = normalizeServiceUrl(environmentUrl || settings.managedServiceUrl || '');
    return {
      mode,
      ready: Boolean(serviceUrl),
      serviceUrl,
      reason: serviceUrl ? '' : 'AxonMind 托管服务尚未配置',
    };
  }
  const missing = [];
  if (!String(settings.appId || '').trim()) missing.push('App ID');
  if (!String(settings.appSecret || '').trim()) missing.push('App Secret');
  return {
    mode,
    ready: missing.length === 0,
    serviceUrl: '',
    reason: missing.length ? `请填写 ${missing.join(' 和 ')}` : '',
  };
}

module.exports = { MODES, normalizeMode, normalizeServiceUrl, readiness };
