function sealLocalUnlock({ user, openIdHash, password, passphrase, encrypt }) {
  return encrypt({ kind: 'managed-local-unlock', userId: user.id, openIdHash, password }, passphrase).toString('base64');
}

function openLocalUnlock({ envelope, user, openIdHash, passphrase, decrypt, hashPassword }) {
  if (!envelope) return '';
  const value = decrypt(Buffer.from(envelope, 'base64'), passphrase);
  if (value.kind !== 'managed-local-unlock' || value.userId !== user.id || value.openIdHash !== openIdHash ||
      typeof value.password !== 'string' || hashPassword(value.password, user.password_salt) !== user.password_hash) {
    throw Error('本机登录凭据不匹配，请使用原本机密码恢复一次');
  }
  return value.password;
}

async function resolveSigninKey({ lookup, create, hasProfile, savedPassphrase, recoveryPassphrase, validate }) {
  const managed = await lookup();
  const candidate = managed || recoveryPassphrase || savedPassphrase;
  if (hasProfile) {
    if (!candidate) return { needsRecovery: true };
    try { await validate(candidate); }
    catch (error) {
      if (!managed) return { needsRecovery: true };
      throw Error('托管密钥与已有资料不匹配，请联系管理员恢复密钥备份');
    }
  }
  const passphrase = managed || await create(candidate || undefined);
  return { passphrase };
}

module.exports = { sealLocalUnlock, openLocalUnlock, resolveSigninKey };
