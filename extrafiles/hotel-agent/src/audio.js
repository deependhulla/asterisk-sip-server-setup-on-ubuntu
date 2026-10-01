// Converts between Asterisk wire formats and the 16 kHz int16 mono PCM used internally.
// Supported: slin16 (16 kHz), slin (8 kHz), ulaw, alaw. All frames are 20 ms.
const BIAS = 0x84, CLIP = 32635;

const ulawDec = (u) => {
  u = ~u & 0xff;
  const t = (((u & 0x0f) << 3) + BIAS) << ((u & 0x70) >> 4);
  return u & 0x80 ? BIAS - t : t - BIAS;
};
const ulawEnc = (s) => {
  const sign = (s >> 8) & 0x80;
  if (sign) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sign | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff;
};

const SEG_END = [0x1f, 0x3f, 0x7f, 0xff, 0x1ff, 0x3ff, 0x7ff, 0xfff];
const alawDec = (a) => {
  a ^= 0x55;
  let t = (a & 0x0f) << 4;
  const seg = (a & 0x70) >> 4;
  if (seg === 0) t += 8; else { t += 0x108; if (seg > 1) t <<= seg - 1; }
  return a & 0x80 ? t : -t;
};
const alawEnc = (s) => {
  s >>= 3;
  let mask;
  if (s >= 0) mask = 0xd5; else { mask = 0x55; s = -s - 1; }
  let seg = SEG_END.findIndex((e) => s <= e);
  if (seg < 0) return 0x7f ^ mask;
  const v = (seg << 4) | (seg < 2 ? (s >> 1) & 0x0f : (s >> seg) & 0x0f);
  return v ^ mask;
};

export const FORMATS = ['slin16', 'slin', 'ulaw', 'alaw'];
export const frameBytes = (fmt) => ({ slin16: 640, slin: 320, ulaw: 160, alaw: 160 }[fmt]);

const up = (s8) => { // 8k -> 16k, linear interpolation
  const o = new Int16Array(s8.length * 2);
  for (let i = 0; i < s8.length; i++) {
    const a = s8[i], b = i + 1 < s8.length ? s8[i + 1] : a;
    o[2 * i] = a; o[2 * i + 1] = (a + b) >> 1;
  }
  return o;
};
const down = (s16) => { // 16k -> 8k, average pairs (cheap low-pass)
  const o = new Int16Array(s16.length >> 1);
  for (let i = 0; i < o.length; i++) o[i] = (s16[2 * i] + s16[2 * i + 1]) >> 1;
  return o;
};
const asInt16 = (buf) => new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + (buf.length & ~1)));
const toBuf = (i16) => Buffer.from(i16.buffer, i16.byteOffset, i16.byteLength);

/** wire frame -> 16 kHz int16 Buffer */
export function toPcm16k(buf, fmt) {
  if (fmt === 'slin16') return buf;
  if (fmt === 'slin') return toBuf(up(asInt16(buf)));
  const dec = fmt === 'ulaw' ? ulawDec : alawDec;
  const s = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) s[i] = dec(buf[i]);
  return toBuf(up(s));
}

/** 16 kHz int16 Buffer -> wire frame */
export function fromPcm16k(pcm, fmt) {
  if (fmt === 'slin16') return pcm;
  const s8 = down(asInt16(pcm));
  if (fmt === 'slin') return toBuf(s8);
  const enc = fmt === 'ulaw' ? ulawEnc : alawEnc;
  const out = Buffer.alloc(s8.length);
  for (let i = 0; i < s8.length; i++) out[i] = enc(s8[i]);
  return out;
}
