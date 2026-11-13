'use strict';

function createChatLiveClient({ getContext, issueTicket, onChange, Socket = globalThis.WebSocket }) {
  let key, socket, timer, generation = 0, retry = 1000;
  function stop() {
    generation++;
    clearTimeout(timer);
    socket?.close();
    socket = undefined;
    key = undefined;
    retry = 1000;
  }
  function reconcile() {
    const context = getContext();
    if (!context || !Socket) return stop();
    if (context.key === key) return;
    stop();
    key = context.key;
    void connect(context, generation);
  }
  async function connect(context, current) {
    try {
      const ticket = await issueTicket(context);
      if (current !== generation || getContext()?.key !== context.key) return;
      const url = new URL(context.url + '/v1/chat/live');
      if (url.protocol !== 'https:') throw new Error('Live chat requires HTTPS');
      url.protocol = 'wss:';
      url.searchParams.set('ticket', ticket);
      const ws = new Socket(url.href);
      socket = ws;
      ws.onopen = () => {
        if (current !== generation || getContext()?.key !== context.key) return ws.close();
        retry = 1000;
        onChange();
      };
      ws.onmessage = event => {
        if (current === generation && getContext()?.key === context.key && event.data === 'changed') onChange();
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => reconnect(context, current);
    } catch { reconnect(context, current); }
  }
  function reconnect(context, current) {
    if (current !== generation) return;
    if (getContext()?.key !== context.key) return reconcile();
    clearTimeout(timer);
    timer = setTimeout(() => void connect(context, current), retry);
    retry = Math.min(retry * 2, 60000);
  }
  function publish() {
    if (socket?.readyState === Socket.OPEN && getContext()?.key === key) {
      try { socket.send('changed'); } catch { /* Periodic sync still catches up. */ }
    }
  }
  return { reconcile, publish, stop };
}
module.exports = { createChatLiveClient };
