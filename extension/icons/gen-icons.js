/**
 * 生成简单的占位 PNG 图标（纯 Node.js，无外部依赖）
 * 运行：node gen-icons.js
 */
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * 最小化 PNG 编码（RGBA，不依赖 canvas/sharp）
 * @param {number} size
 * @param {number[]} rgba  [r, g, b, a]
 */
function makePng(size, [r, g, b, a = 255]) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuffer, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // color type: RGB (no alpha for simplicity, use 6 for RGBA)
  ihdr[9]  = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw pixel data with filter byte per row
  const rowBytes  = size * 4; // RGBA
  const rawSize   = (1 + rowBytes) * size;
  const raw       = Buffer.alloc(rawSize);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// CRC-32 implementation
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const SIZES = [16, 48, 128];
// OpenClaw 蓝色: #3b82f6 = rgb(59, 130, 246)
const COLOR = [59, 130, 246, 255];

for (const size of SIZES) {
  const buf  = makePng(size, COLOR);
  const file = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`✓ ${file} (${buf.length} bytes)`);
}
console.log('图标生成完成。');
