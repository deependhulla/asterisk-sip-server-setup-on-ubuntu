const BASE = 'https://api.sarvam.ai';
const KEY = () => process.env.SARVAM_API_KEY;

function wavFromPcm16k(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function pcmFromWav(wav) {
  let p = 12;
  while (p + 8 <= wav.length) {
    const id = wav.toString('ascii', p, p + 4), size = wav.readUInt32LE(p + 4);
    if (id === 'fmt ') {
      const rate = wav.readUInt32LE(p + 12);
      if (rate !== 16000) console.warn(`[sarvam] TTS returned ${rate} Hz, expected 16000`);
    }
    if (id === 'data') return wav.subarray(p + 8, Math.min(p + 8 + size, wav.length));
    p += 8 + size + (size & 1);
  }
  throw new Error('No data chunk in TTS WAV');
}

/** pcm: 16 kHz mono int16 Buffer -> { text, lang } */
export async function transcribe(pcm) {
  const form = new FormData();
  form.append('file', new Blob([wavFromPcm16k(pcm)], { type: 'audio/wav' }), 'speech.wav');
  form.append('model', process.env.SARVAM_STT_MODEL || 'saaras:v3');
  form.append('language_code', process.env.SARVAM_STT_LANG || 'unknown'); // auto-detect; set hi-IN or en-IN to force one language
  if (process.env.SARVAM_STT_MODE) form.append('mode', process.env.SARVAM_STT_MODE); // e.g. codemix
  const r = await fetch(`${BASE}/speech-to-text`, {
    method: 'POST', headers: { 'api-subscription-key': KEY() }, body: form,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`STT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { text: (j.transcript || '').trim(), lang: j.language_code };
}

/** text -> 16 kHz mono int16 PCM Buffer */
export async function synthesize(text, lang = 'hi-IN') {
  const r = await fetch(`${BASE}/text-to-speech`, {
    method: 'POST',
    headers: { 'api-subscription-key': KEY(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      target_language_code: lang,
      model: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
      speaker: process.env.SARVAM_TTS_SPEAKER || 'priya',
      speech_sample_rate: 16000,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return pcmFromWav(Buffer.from(j.audios[0], 'base64'));
}

export async function chat(messages, attempt = 0) {
  const body = {
    model: process.env.SARVAM_LLM_MODEL || 'sarvam-105b-conversations',
    messages: attempt === 0 ? messages : [...messages, { role: 'user', content: '(Reply now with the JSON object only.)' }],
    temperature: attempt === 0 ? 0.3 : 0.6,
    max_tokens: +process.env.SARVAM_MAX_TOKENS || 800,
  };
  // reasoning only on the first attempt; retries run without it
  if (process.env.SARVAM_REASONING && attempt === 0) body.reasoning_effort = process.env.SARVAM_REASONING;
  const r = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'api-subscription-key': KEY(),
      Authorization: `Bearer ${KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(attempt === 0 ? 20000 : 12000),
  });
  if (!r.ok) throw new Error(`LLM ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const c = j.choices?.[0];
  const text = c?.message?.content || c?.message?.reasoning_content || '';
  if (!text.trim()) {
    console.warn(`[llm] empty (attempt ${attempt}), finish=${c?.finish_reason}, raw=`, JSON.stringify(j).slice(0, 700));
    if (attempt < 2) return chat(messages, attempt + 1);
  }
  return text;
}
