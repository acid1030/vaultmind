'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { setTimeout: sleep } = require('node:timers/promises');
const { createAuthServer } = require('../server/feishu-auth/server');
const { WebSocket } = require('../server/feishu-auth/node_modules/ws');

(async () => {
  const vaultId = crypto.randomUUID();
  const server = createAuthServer({
    publicUrl: 'https://example.test/mizhan-auth', appId: 'fixture', appSecret: 'fixture',
    tokenKey: crypto.randomBytes(32),
    fetcher: async (_url, opts) => {
      const token = opts.headers.Authorization;
      return { ok: ['Bearer a', 'Bearer b'].includes(token), json: async () => ({ data: { open_id: token } }) };
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = '127.0.0.1:' + server.address().port + '/mizhan-auth/v1/chat';
  const sockets = [];
  const ticket = (token, id) => fetch('http://' + base + '/live-ticket', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vaultId: id }),
  });
  const open = async (token, id) => {
    const response = await ticket(token, id);
    assert.equal(response.status, 200);
    const { ticket: grant } = await response.json();
    const url = 'ws://' + base + '/live?ticket=' + grant;
    const ws = new WebSocket(url);
    sockets.push(ws);
    await once(ws, 'open');
    return { ws, url };
  };
  try {
    assert.ok((await ticket('invalid', vaultId)).status >= 400);
    const sender = await open('a', vaultId);
    const receiver = await open('a', vaultId);
    const otherUser = await open('b', vaultId);
    const otherVault = await open('a', crypto.randomUUID());
    let leaked = 0;
    for (const ws of [sender.ws, otherUser.ws, otherVault.ws]) ws.on('message', () => leaked++);
    const replay = new WebSocket(sender.url);
    sockets.push(replay);
    await assert.rejects(once(replay, 'open'), /403/);
    const received = once(receiver.ws, 'message', { signal: AbortSignal.timeout(2000) });
    sender.ws.send('changed');
    assert.equal((await received)[0].toString(), 'changed');
    const encryptedFrame = 'text-v1:' + JSON.stringify({ ciphertext: 'test-opaque-frame' });
    const relayed = once(receiver.ws, 'message', { signal: AbortSignal.timeout(2000) });
    sender.ws.send(encryptedFrame);
    assert.equal((await relayed)[0].toString(), encryptedFrame);
    await sleep(100);
    assert.equal(leaked, 0);
    console.log('Chat live: real WebSocket delivery, ticket replay denied, different Feishu identities and vaults isolated.');
  } finally {
    for (const ws of sockets) ws.terminate();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
