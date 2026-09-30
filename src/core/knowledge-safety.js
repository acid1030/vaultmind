const SECRET_NOTICE = '该条目包含加密凭据。为避免在知识问答中泄露，请前往“密码库”并主动解锁查看。';

function redactSensitiveText(value) {
  let text = String(value || '');
  text = text.replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/gi, '[私钥已隐藏]');
  text = text.replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{8,}\b/g, '[Git 凭据已隐藏]');
  text = text.replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[API Key 已隐藏]');
  text = text.replace(/\bAKIA[A-Z0-9]{12,}\b/g, '[访问密钥已隐藏]');
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, 'Bearer [令牌已隐藏]');
  text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[JWT 已隐藏]');
  text = text.replace(
    /\b(password|passwd|pwd|token|api[ _-]?key|access[ _-]?key|secret|private[ _-]?key|密码|口令|密钥)\b\s*[:=：]\s*([^\s,，;；]{4,})/gi,
    (_match, label) => `${label}: [已隐藏]`,
  );
  text = text.replace(/[^\s,，;；]{8,64}/g, (token) => {
    if (/^(?:https?:\/\/|file:\/\/)/i.test(token)) return token;
    const looksCredentialLike = /[A-Za-z]/.test(token)
      && /\d/.test(token)
      && /[@#$%^&*]/.test(token);
    return looksCredentialLike ? '[疑似凭据已隐藏]' : token;
  });
  return text;
}

function normalizedEvidenceKey(item) {
  const title = String(item.title || '').trim().toLowerCase().replace(/[\s_.-]+/g, ' ');
  return `${item.source || ''}|${item.type || ''}|${title}`;
}

function prepareEvidence(evidence, options = {}) {
  const limit = Number(options.limit || 6);
  const hintLimit = Number(options.hintLimit || 2);
  const seen = new Set();
  const results = [];
  let hints = 0;
  let normalItems = 0;
  for (const raw of Array.isArray(evidence) ? evidence : []) {
    if (!raw) continue;
    if (raw.isHint && hints >= hintLimit) continue;
    if (!raw.isHint && normalItems >= limit) continue;
    const key = normalizedEvidenceKey(raw);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const isSecret = String(raw.kind || '').toLowerCase() === 'secret';
    results.push({
      ...raw,
      title: redactSensitiveText(raw.title || '未命名'),
      content: isSecret ? SECRET_NOTICE : redactSensitiveText(raw.content),
    });
    if (raw.isHint) hints += 1;
    else normalItems += 1;
  }
  return results;
}

module.exports = {
  SECRET_NOTICE,
  prepareEvidence,
  redactSensitiveText,
};
