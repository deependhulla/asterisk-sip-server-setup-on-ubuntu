import { readFileSync } from 'node:fs';

export const CLUB = 'Club Emerald';
export const LANGS = {
  'en-IN': 'English', 'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi',
  'od-IN': 'Odia', 'pa-IN': 'Punjabi',
};
const KNOWLEDGE = readFileSync(new URL('./knowledge.txt', import.meta.url), 'utf8');

/** Short caller IDs (e.g. 647) are in-house room extensions; long ones are outside phone numbers. */
export const isExtension = (n) => /^\d{2,6}$/.test(String(n || ''));

export const GREETING = `Hello! I'm Pooja, an AI assistant from ${CLUB}. How can I help you today? You can speak in English or Hindi, whichever you prefer.`;

const callContext = (caller) => isExtension(caller)
  ? `The call comes from in-house extension ${caller}, which is the guest's ROOM NUMBER. Never ask "what is your room number". Instead, when you need it, CONFIRM it: say you see they are calling from room ${caller} and ask "is that right?". If they say it is a different room, use the room they give. Put the confirmed room in "room".`
  : `The call comes from the outside phone number ${caller || 'unknown'} (not a room extension). For in-house requests (housekeeping, room service, maintenance, wake-up call, taxi, late check-out) ask which room they are staying in.`;

export const SYSTEM_PROMPT = (caller) => `You are Pooja, the AI Guest Experience Specialist of ${CLUB}, Chembur, Mumbai. You are on a live phone call with a guest or a caller who may be a prospective member. You are female, warm, polite and concise. If asked, say clearly that you are an AI assistant.

CALL CONTEXT
${callContext(caller)}

LANGUAGE
- Every guest message starts with a tag like [reply_language: Hindi]. Write your reply in exactly that language, in its natural script (Hindi in Devanagari, English in Roman letters). Sometimes a [note: ...] tag follows; obey it.
- You prefer English or Hindi; other Indian languages you understand only a little. When a note tells you so, say it once, politely.
- The speech-to-text may contain mistakes. Short answers such as "25" or "room 25" are room numbers. Do not ask people to repeat unless it is truly unclear.

STYLE (phone call)
- 1 to 3 short spoken sentences. No lists, no markdown, no emojis, no reading out long menus. Give the key fact, then offer one helpful follow-up.
- Use ONLY the knowledge base below for facts and prices. If something is not covered, say you will check with the team and offer a callback. Never invent prices, timings or policies. Quote prices as "starting from" or "around" exactly as given.
- For membership, banquet or room enquiries, offer a tour or a callback from the sales team.

TASKS YOU CAN LOG for staff (set "action" only once the guest has confirmed and you have the needed details; otherwise null):
- Hotel guests: housekeeping, room_service, maintenance, wakeup_call, taxi, late_checkout. You need the confirmed room number first (see CALL CONTEXT).
- Anyone: spa_booking (ask name, preferred day and time), tour_callback (membership/banquet/room enquiry: ask name and preferred day and time for a tour or callback), other.
Always put a short English summary in "details", and the guest's name in "name" if known.
Set "end_call" true only after the guest says goodbye or has nothing else to ask.

Respond with ONLY one JSON object and nothing else:
{"reply":"<spoken text>","action":null or {"type":"housekeeping|room_service|maintenance|wakeup_call|taxi|late_checkout|spa_booking|tour_callback|other","room":"<room no or null>","name":"<guest name or null>","details":"<short English summary>"},"end_call":false}

KNOWLEDGE BASE
${KNOWLEDGE}`;

export function parseAgent(raw) {
  const clean = String(raw).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]);
      if (o.reply) return { reply: o.reply, action: o.action || null, end_call: !!o.end_call };
    } catch { /* fall through */ }
  }
  const r = clean.match(/"reply"\s*:\s*"([^"]+)/); // truncated JSON
  if (r) return { reply: r[1], action: null, end_call: false };
  if (clean && !clean.startsWith('{')) return { reply: clean, action: null, end_call: false };
  console.warn('[agent] unusable model output:', JSON.stringify(String(raw).slice(0, 400)));
  return { reply: null, action: null, end_call: false };
}

export const SORRY = {
  'en-IN': "Sorry, I didn't catch that. Could you please repeat?",
  'hi-IN': 'क्षमा करें, कृपया दोबारा बोलिए।',
};

const phoneLabel = (n) => (isExtension(n) ? `extension ${n}` : `phone ${n}`);

/** Builds the text staff will read. Always states which extension/number the call came from. */
export function buildMessage(action, call) {
  const room = action.room || (isExtension(call.caller) ? call.caller : null);
  return [
    `[${action.type}]`,
    room && `Room ${room}.`,
    action.name && `Guest: ${action.name}.`,
    `${action.details}.`.replace(/\.\.$/, '.'),
    call.caller && `Call was from ${phoneLabel(call.caller)}.`,
  ].filter(Boolean).join(' ');
}

/**
 * Sends msgx= and apikey= to ALERT_URL. Expects {"result":"success","msg":"","id":123}.
 * ALERT_MODE: form (POST body, default) | query (POST with fields in the URL) | get (GET with fields in the URL) | json (POST JSON)
 */
async function sendAlert(message) {
  const base = process.env.ALERT_URL;
  if (!base) return;
  const mode = process.env.ALERT_MODE || 'form';
  const fields = { msgx: message, apikey: process.env.ALERT_API_KEY || '' };
  const qs = new URLSearchParams(fields);
  const sep = base.includes('?') ? '&' : '?';
  const opts = { signal: AbortSignal.timeout(10000) };
  let url = base;
  if (mode === 'form') Object.assign(opts, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs });
  else if (mode === 'query') { url = base + sep + qs; Object.assign(opts, { method: 'POST' }); }
  else if (mode === 'get') { url = base + sep + qs; Object.assign(opts, { method: 'GET' }); }
  else if (mode === 'json') Object.assign(opts, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let j; try { j = JSON.parse(text); } catch { /* not JSON */ }
    if (j?.result === 'success') console.log(`[alert] sent OK (${mode}), id=${j.id}`);
    else console.error(`[alert] NOT CONFIRMED mode=${mode} http=${r.status} redirected=${r.redirected} finalUrl=${r.url.replace(/apikey=[^&]*/, 'apikey=***')} body=${JSON.stringify(text.slice(0, 300))}`);
  } catch (e) {
    console.error('[alert] request failed:', e.message);
  }
}

/** Called when the agent confirms a guest request. */
export async function notifyStaff(action, call) {
  const message = buildMessage(action, call);
  const payload = { ...action, club: CLUB, caller: call.caller, call_id: call.id, message, timestamp: new Date().toISOString() };
  console.log('[staff] request:', payload);
  await sendAlert(message);
  const url = process.env.HOTEL_WEBHOOK_URL; // optional JSON webhook
  if (!url) return;
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    console.log(`[staff] webhook -> ${r.status}`);
  } catch (e) {
    console.error('[staff] webhook failed:', e.message);
  }
}
