import { transcribe, synthesize, chat } from './sarvam.js';
import { SYSTEM_PROMPT, parseAgent, notifyStaff, GREETING, LANGS, SORRY } from './hotel.js';
import { joinRoom } from './livekit.js';
import { toPcm16k, fromPcm16k, frameBytes, FORMATS } from './audio.js';

const FRAME = 640; // 20 ms of 16 kHz int16 mono
const VAD = { thr: +process.env.VAD_RMS || 450, start: 3, end: 35, min: 10, pre: 10 };

const rms = (buf) => {
  let sum = 0, n = buf.length >> 1;
  for (let i = 0; i < n; i++) { const s = buf.readInt16LE(i * 2); sum += s * s; }
  return Math.sqrt(sum / (n || 1));
};

export class Session {
  constructor({ id, caller, hangup }) {
    this.id = id; this.caller = caller; this.hangup = hangup;
    this.history = [{ role: 'system', content: SYSTEM_PROMPT(caller) }];
    this.ws = null; this.lk = null; this.ended = false;
    // VAD
    this.pre = []; this.utt = []; this.inSpeech = false; this.loudRun = 0; this.quiet = 0;
    // playback
    this.queue = []; this.timer = null; this.xoff = false; this.drainCbs = [];
    this.fmt = process.env.MEDIA_FORMAT || 'slin16';
    this.lang = 'en-IN'; this.pending = null; // English first
    this.gen = 0; this.chain = Promise.resolve(); this.greeted = false;
  }

  log(...a) { console.log(`[call ${this.id.slice(-6)}]`, ...a); }

  async start() {
    if (process.env.USE_LIVEKIT === '1') {
      try {
        this.lk = await joinRoom(`call-${this.id}`, `asterisk-${this.id.slice(-6)}`);
        this.log('LiveKit room joined: call-' + this.id);
      } catch (e) { this.log('LiveKit join failed (continuing without):', e.message); }
    }
  }

  attach(ws) {
    this.ws = ws;
    ws.on('message', (d, isBin) => (isBin ? this.onAudio(d) : this.onText(d.toString())));
    ws.on('close', () => this.end('media websocket closed'));
    ws.on('error', (e) => this.log('ws error', e.message));
  }

  onText(t) {
    const ev = parseEvent(t);
    switch (ev.event) {
      case 'MEDIA_START':
        this.log('MEDIA_START', ev.format, 'frame', ev.optimal_frame_size);
        if (FORMATS.includes(ev.format)) this.fmt = ev.format;
        else this.log(`WARNING: unsupported media format "${ev.format}" (supported: ${FORMATS.join(', ')})`);
        if (!this.greeted) { this.greeted = true; this.speak(GREETING, 'en-IN'); }
        break;
      case 'MEDIA_XOFF': this.xoff = true; break;
      case 'MEDIA_XON': this.xoff = false; break;
      default: break;
    }
  }

  onAudio(wire) {
    const buf = toPcm16k(wire, this.fmt); // always 640 bytes = 20 ms @ 16 kHz
    this.lk?.pushCaller(buf);
    const loud = rms(buf) > VAD.thr;
    if (!this.inSpeech) {
      this.pre.push(buf); if (this.pre.length > VAD.pre) this.pre.shift();
      if (loud && ++this.loudRun >= VAD.start) {
        this.inSpeech = true; this.utt = [...this.pre]; this.quiet = 0;
        this.gen++;                                  // cancel any reply still in flight
        if (this.queue.length) this.flush();         // barge-in
      } else if (!loud) this.loudRun = 0;
    } else {
      this.utt.push(buf);
      if (loud) this.quiet = 0;
      else if (++this.quiet >= VAD.end) {
        this.inSpeech = false; this.loudRun = 0; this.pre = [];
        const pcm = Buffer.concat(this.utt); this.utt = [];
        if (pcm.length >= VAD.min * FRAME) {
          this.chain = this.chain.then(() => this.handle(pcm)).catch((e) => this.log('turn error:', e.message));
        }
      }
    }
  }

  async handle(pcm) {
    const myGen = this.gen;
    let t0 = Date.now();
    this.log(`heard ${(pcm.length / 32000).toFixed(1)}s of speech, transcribing...`);
    const { text, lang } = await transcribe(pcm);
    this.log(`STT ${Date.now() - t0}ms`);
    if (!text) return;
    const { lang: replyLang, note } = this.resolveLang(lang);
    this.log(`guest (${lang}): ${text}  -> reply in ${replyLang}`);
    const tag = `[reply_language: ${LANGS[replyLang]}] ${note ? `[note: ${note}] ` : ''}`;
    this.history.push({ role: 'user', content: tag + text });
    t0 = Date.now();
    const out = parseAgent(await chat(this.history));
    this.log(`LLM ${Date.now() - t0}ms`);
    this.history[this.history.length - 1].content = tag + text;
    out.reply ??= SORRY[replyLang] || SORRY['en-IN'];
    this.log('agent:', out.reply, out.action ? JSON.stringify(out.action) : '');
    this.history.push({ role: 'assistant', content: JSON.stringify({ reply: out.reply, action: out.action, end_call: out.end_call }) });
    if (this.history.length > 21) this.history.splice(1, 2);
    if (out.action) notifyStaff(out.action, this); // fire and forget
    if (myGen !== this.gen) return;                  // guest spoke again meanwhile
    await this.speak(out.reply, replyLang);
    if (out.end_call) this.onDrain(() => setTimeout(() => this.end('agent ended call'), 500));
  }

  /** English/Hindi switch immediately; a third language needs two turns in a row (avoids STT mis-detections). */
  resolveLang(d) {
    if (!LANGS[d] || d === this.lang) { this.pending = null; return { lang: this.lang, note: null }; }
    if (d === 'en-IN' || d === 'hi-IN' || this.pending === d) { this.pending = null; this.lang = d; return { lang: d, note: null }; }
    this.pending = d;
    return { lang: this.lang, note: `The guest seems to speak ${LANGS[d]}. Reply in ${LANGS[this.lang]} and politely say once that you prefer English or Hindi but understand other languages a little.` };
  }

  async speak(text, lang) {
    try {
      const t0 = Date.now();
      const pcm = await synthesize(text, lang);
      this.log(`TTS ${Date.now() - t0}ms, playing ${(pcm.length / 32000).toFixed(1)}s`);
      this.play(pcm);
    } catch (e) { this.log('TTS error:', e.message); }
  }

  play(pcm) {
    for (let i = 0; i < pcm.length; i += FRAME) {
      const f = Buffer.alloc(FRAME); pcm.copy(f, 0, i, Math.min(i + FRAME, pcm.length));
      this.queue.push({ wire: fromPcm16k(f, this.fmt), pcm: f });
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), 20);
  }

  tick() {
    if (this.ended || this.ws?.readyState !== 1) return;
    if (!this.queue.length) {
      clearInterval(this.timer); this.timer = null;
      const cbs = this.drainCbs.splice(0); cbs.forEach((f) => f());
      return;
    }
    if (this.xoff) return;
    const f = this.queue.shift();
    this.ws.send(f.wire);
    this.lk?.pushAgent(f.pcm);
  }

  onDrain(cb) { if (!this.queue.length) cb(); else this.drainCbs.push(cb); }

  flush() {
    this.queue.length = 0;
    try { this.ws.send('FLUSH_MEDIA'); } catch { /* closed */ }
    this.log('barge-in: flushed');
  }

  end(reason) {
    if (this.ended) return;
    this.ended = true; clearInterval(this.timer);
    this.log('ended:', reason);
    this.lk?.close();
    try { this.ws?.close(); } catch { /* ignore */ }
    this.hangup?.();
  }
}

function parseEvent(t) {
  if (t[0] === '{') { try { const j = JSON.parse(t); return { ...j, event: j.event || j.command }; } catch { /* plain text */ } }
  const [event, ...rest] = t.trim().split(/\s+/);
  const o = { event };
  for (const kv of rest) { const i = kv.indexOf(':'); if (i > 0) o[kv.slice(0, i)] = kv.slice(i + 1); }
  return o;
}
