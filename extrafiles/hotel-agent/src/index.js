import WebSocket, { WebSocketServer } from 'ws';
import { Session } from './session.js';

const env = process.env;
const ARI_URL = env.ARI_URL || 'http://127.0.0.1:8088';
const APP = env.ARI_APP || 'livekitserverdev';
const CONN = env.ARI_WS_CONNECTION || 'livekit_agent';
const PORT = +env.MEDIA_WS_PORT || 8099;
const auth = 'Basic ' + Buffer.from(`${env.ARI_USER}:${env.ARI_PASS}`).toString('base64');

console.log('==============================================');
console.log(` ${env.HOTEL_NAME || 'Hotel'} AI Front-Desk Agent  (Asterisk <-> Sarvam <-> LiveKit)`);
console.log(` ARI app        : ${APP} @ ${ARI_URL}`);
console.log(` Media WS       : ws://0.0.0.0:${PORT}  (Asterisk connection "${CONN}")`);
console.log(` LiveKit mirror : ${env.USE_LIVEKIT === '1' ? env.LIVEKIT_URL : 'disabled'}`);
console.log(` Media format   : ${env.MEDIA_FORMAT || 'slin16'}`);
console.log(` Sarvam         : STT ${env.SARVAM_STT_MODEL} (${env.SARVAM_STT_LANG || 'unknown'}) | LLM ${env.SARVAM_LLM_MODEL} | TTS ${env.SARVAM_TTS_MODEL} voice=${env.SARVAM_TTS_SPEAKER}`);
console.log(` Staff alerts   : ${env.ALERT_URL ? env.ALERT_URL : 'ALERT_URL not set (alerts only logged)'}`);
console.log(` Dial extension 700 to talk to the agent`);
console.log('==============================================');

async function ari(method, path, params = {}) {
  const url = new URL(`${ARI_URL}/ari${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { method, headers: { Authorization: auth } });
  if (!r.ok && r.status !== 404) throw new Error(`ARI ${method} ${path} -> ${r.status} ${await r.text()}`);
  return r.status === 204 || r.status === 404 ? null : r.json();
}

const sessions = new Map(); // caller channel id -> Session
const awaitingMedia = [];   // sessions waiting for Asterisk to open the media websocket
const stasisWaiters = new Map(); // external-media channel id -> resolve()

const waitForStasis = (id, ms = 8000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => { stasisWaiters.delete(id); reject(new Error(`external media channel ${id} never entered Stasis`)); }, ms);
  stasisWaiters.set(id, () => { clearTimeout(t); resolve(); });
});

// ---- Media websocket server: Asterisk (chan_websocket) connects here per call ----
const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });
wss.on('connection', (ws, req) => {
  const s = awaitingMedia.shift();
  console.log(`[media] Asterisk connected from ${req.socket.remoteAddress} path=${req.url}`);
  if (!s) { console.warn('[media] no pending call, closing'); return ws.close(); }
  s.attach(ws);
});

// ---- ARI events ----
function connectAri() {
  const wsUrl = ARI_URL.replace(/^http/, 'ws') +
    `/ari/events?app=${APP}&api_key=${encodeURIComponent(env.ARI_USER + ':' + env.ARI_PASS)}`;
  const ev = new WebSocket(wsUrl);
  ev.on('open', () => console.log('[ari] connected, waiting for calls...'));
  ev.on('message', (d) => onAriEvent(JSON.parse(d.toString())).catch((e) => console.error('[ari] event error:', e.message)));
  ev.on('close', () => { console.log('[ari] disconnected, retrying in 3s'); setTimeout(connectAri, 3000); });
  ev.on('error', (e) => console.error('[ari] error:', e.message));
}

async function onAriEvent(e) {
  if (e.type === 'StasisStart') {
    const ch = e.channel;
    if (ch.name.startsWith('WebSocket/')) { // our own external-media channel
      stasisWaiters.get(ch.id)?.(); stasisWaiters.delete(ch.id);
      return;
    }
    console.log(`[ari] incoming call ${ch.id} from ${ch.caller?.number || 'unknown'}`);
    await setupCall(ch);
  } else if (e.type === 'StasisEnd' || e.type === 'ChannelHangupRequest') {
    sessions.get(e.channel.id)?.end('caller hung up');
  }
}

async function setupCall(ch) {
  const bridgeId = `br-${ch.id}`, extId = `ext-${ch.id}`;
  const cleanup = async () => {
    sessions.delete(ch.id);
    const i = awaitingMedia.indexOf(session); if (i >= 0) awaitingMedia.splice(i, 1);
    stasisWaiters.delete(extId);
    await ari('DELETE', `/channels/${extId}`).catch(() => {});
    await ari('DELETE', `/channels/${ch.id}`).catch(() => {});
    await ari('DELETE', `/bridges/${bridgeId}`).catch(() => {});
  };
  const session = new Session({ id: ch.id, caller: ch.caller?.number, hangup: cleanup });
  sessions.set(ch.id, session);
  awaitingMedia.push(session);
  try {
    await ari('POST', `/channels/${ch.id}/answer`);
    await ari('POST', '/bridges', { type: 'mixing', bridgeId });
    await ari('POST', `/bridges/${bridgeId}/addChannel`, { channel: ch.id });
    await session.start();
    const inStasis = waitForStasis(extId);
    inStasis.catch(() => {}); // avoid unhandled rejection if the create call throws first
    await ari('POST', '/channels/externalMedia', {
      app: APP, channelId: extId, external_host: CONN,
      transport: 'websocket', encapsulation: 'none', format: env.MEDIA_FORMAT || 'slin16', connection_type: 'client',
    });
    await inStasis;
    await ari('POST', `/bridges/${bridgeId}/addChannel`, { channel: extId });
    console.log('[call] bridged caller <-> agent media');
  } catch (err) {
    console.error('[call] setup failed:', err.message);
    session.end('setup failed');
  }
}

connectAri();
process.on('SIGINT', () => process.exit(0));
