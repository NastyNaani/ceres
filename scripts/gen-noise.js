// Generates a small seamless RGBA noise tile (assets/noise.png) used as a faint
// grain overlay for added depth. Self-contained PNG encoder (zlib + CRC32).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 128;
const H = 128;

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Raw RGBA scanlines, each prefixed with filter byte 0.
const raw = Buffer.alloc(H * (1 + W * 4));
let p = 0;
for (let y = 0; y < H; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const r = Math.random();
    // mostly transparent, occasional faint white or black speck
    let v = 255;
    let a = 0;
    if (r > 0.86) {
      v = 255;
      a = Math.floor(Math.random() * 26); // up to ~10%
    } else if (r < 0.06) {
      v = 0;
      a = Math.floor(Math.random() * 30);
    }
    raw[p++] = v;
    raw[p++] = v;
    raw[p++] = v;
    raw[p++] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const dest = path.join(__dirname, '..', 'assets', 'noise.png');
fs.writeFileSync(dest, png);
console.log('Wrote', dest, png.length, 'bytes');
