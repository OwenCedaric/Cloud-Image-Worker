const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 32, H = 32;
const SCALE = 4;
const SW = W * SCALE, SH = H * SCALE;

const buf = new Uint8Array(SW * SH * 4);

function insideRoundedRect(x, y, w, h, r) {
  if (x < 0 || x >= w || y < 0 || y >= h) return false;
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r ** 2;
  if (x > w - 1 - r && y < r) return (x - (w - 1 - r)) ** 2 + (y - r) ** 2 <= r ** 2;
  if (x < r && y > h - 1 - r) return (x - r) ** 2 + (y - (h - 1 - r)) ** 2 <= r ** 2;
  if (x > w - 1 - r && y > h - 1 - r) return (x - (w - 1 - r)) ** 2 + (y - (h - 1 - r)) ** 2 <= r ** 2;
  return true;
}

function insideStar(x, y, cx, cy, rTip) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx + dy > rTip * 1.5) return false;
  const a = rTip;
  return Math.pow(dx / a, 2/3) + Math.pow(dy / a, 2/3) <= 1;
}

function insideCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const idx = (y * SW + x) * 4;
    const fx = x / SCALE;
    const fy = y / SCALE;
    
    if (insideRoundedRect(fx, fy, W, H, 7.5)) {
      let r = 61, g = 68, b = 81, a = 255;
      
      if (insideStar(fx, fy, 16, 16, 10.5)) {
        r = 251; g = 249; b = 246;
      } else if (insideCircle(fx, fy, 24, 8, 2.2)) {
        r = 130; g = 161; b = 185;
      }
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    } else {
      buf[idx + 3] = 0;
    }
  }
}

const img32 = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let rSum = 0, gSum = 0, bSum = 0, aSum = 0;
    for (let sy = 0; sy < SCALE; sy++) {
      for (let sx = 0; sx < SCALE; sx++) {
        const sidx = ((y * SCALE + sy) * SW + (x * SCALE + sx)) * 4;
        const a = buf[sidx + 3] / 255;
        rSum += buf[sidx] * a;
        gSum += buf[sidx + 1] * a;
        bSum += buf[sidx + 2] * a;
        aSum += buf[sidx + 3];
      }
    }
    const totalSamples = SCALE * SCALE;
    const finalA = Math.round(aSum / totalSamples);
    const didx = (y * W + x) * 4;
    if (finalA > 0) {
      img32[didx] = Math.round(rSum / (aSum / 255));
      img32[didx + 1] = Math.round(gSum / (aSum / 255));
      img32[didx + 2] = Math.round(bSum / (aSum / 255));
      img32[didx + 3] = finalA;
    }
  }
}

function createPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  
  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, "ascii");
    data.copy(chunk, 8);
    const crc = crc32(chunk.subarray(4, 8 + len));
    chunk.writeUInt32BE(crc >>> 0, 8 + len);
    return chunk;
  }
  
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  function crc32(b) {
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) {
      c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * (1 + width * 4) + 1);
  }
  
  const idatData = zlib.deflateSync(raw);
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", idatData);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));
  
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createIco(pngBuf) {
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0);
  icoHeader.writeUInt16LE(1, 2);
  icoHeader.writeUInt16LE(1, 4);
  
  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(32, 0);
  dirEntry.writeUInt8(32, 1);
  dirEntry.writeUInt8(0, 2);
  dirEntry.writeUInt8(0, 3);
  dirEntry.writeUInt16LE(1, 4);
  dirEntry.writeUInt16LE(32, 6);
  dirEntry.writeUInt32LE(pngBuf.length, 8);
  dirEntry.writeUInt32LE(22, 12);
  
  return Buffer.concat([icoHeader, dirEntry, pngBuf]);
}

const pngBuf = createPng(W, H, img32);
const icoBuf = createIco(pngBuf);

const targetPath = path.join(__dirname, "../src/assets/favicon.ico");
fs.writeFileSync(targetPath, icoBuf);
console.log(`Generated favicon.ico (${icoBuf.length} bytes) at ${targetPath}`);
