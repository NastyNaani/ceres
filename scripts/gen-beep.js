// One-off generator for a short, soft confirmation beep used on a successful scan.
// Produces a 16-bit PCM mono WAV at assets/scan-beep.wav.
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationS = 0.14;
const total = Math.floor(sampleRate * durationS);

// A gentle two-tone blip (C6 -> E6) with a quick attack/decay envelope.
const f1 = 1046.5;
const f2 = 1318.5;

const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  const t = i / sampleRate;
  const prog = i / total;
  // attack then exponential decay -> avoids clicks, feels "premium".
  const env = Math.min(1, prog / 0.06) * Math.pow(1 - prog, 1.8);
  const freq = prog < 0.5 ? f1 : f2;
  const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  const v = Math.max(-1, Math.min(1, sample));
  data.writeInt16LE((v * 32767) | 0, i * 2);
}

function wavHeader(dataLen) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataLen, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(dataLen, 40);
  return h;
}

const out = Buffer.concat([wavHeader(data.length), data]);
const dest = path.join(__dirname, '..', 'assets', 'scan-beep.wav');
fs.writeFileSync(dest, out);
console.log('Wrote', dest, out.length, 'bytes');
