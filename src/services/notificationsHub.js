// Real-time customer notifications over SignalR (/hubs/notifications on the API host).
//  • Auth: the in-memory customer access token. accessTokenFactory runs on every (re)connect and refreshes
//    the token first when it is about to expire — the server closes the socket when the 15-minute token
//    expires, and the automatic reconnect comes back with a fresh one.
//  • Never gives up: automatic reconnect retries forever (0 s, 2 s, 5 s, 10 s, 20 s, then every 30 s);
//    a failed first start is retried with the same back-off.
//  • The caller (NotificationsProvider) polls the REST API while the socket is down.
import { HubConnectionBuilder, HubConnectionState, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { getAccessToken, API_ORIGIN } from '@/services/api';

const DELAYS = [0, 2000, 5000, 10000, 20000];
const delayFor = (n) => DELAYS[n] ?? 30000;

/**
 * @param {{ onNotification, onEnded, onRemoved, onState, onLiveChange }} handlers
 * @returns {{ stop: () => Promise<void> }}
 */
export function connectNotifications(handlers) {
  let stopped = false;
  let retryTimer = null;
  let attempt = 0;

  const conn = new HubConnectionBuilder()
    .withUrl(`${API_ORIGIN}/hubs/notifications`, {
      accessTokenFactory: () => getAccessToken('customer'),
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      withCredentials: false,   // bearer token only — no cookies on the hub
    })
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => (stopped ? null : delayFor(ctx.previousRetryCount)) })
    .configureLogging(LogLevel.None)
    .build();

  conn.on('notification', (n) => handlers.onNotification?.(n));
  conn.on('broadcast-ended', (p) => handlers.onEnded?.(p?.id));
  conn.on('broadcast-removed', (p) => handlers.onRemoved?.(p?.id));
  conn.on('notification-state', (p) => handlers.onState?.(p));
  conn.onreconnecting(() => handlers.onLiveChange?.(false));
  conn.onreconnected(() => { attempt = 0; handlers.onLiveChange?.(true, { reconnected: true }); });
  conn.onclose(() => {
    handlers.onLiveChange?.(false);
    if (!stopped) schedule();   // automatic reconnect gave up (or never started) → keep trying
  });

  async function start() {
    if (stopped || conn.state !== HubConnectionState.Disconnected) return;
    try {
      const token = await getAccessToken('customer');
      if (!token) { schedule(); return; }      // session gone / refresh failed for now
      await conn.start();
      attempt = 0;
      handlers.onLiveChange?.(true, { reconnected: false });
    } catch {
      schedule();
    }
  }

  function schedule() {
    if (stopped) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(start, Math.max(1000, delayFor(attempt++)));
  }

  start();

  return {
    stop: async () => {
      stopped = true;
      clearTimeout(retryTimer);
      try { await conn.stop(); } catch { /* already stopped */ }
    },
  };
}
