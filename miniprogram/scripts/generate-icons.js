const fs = require('fs');
const path = require('path');

// 创建简单的PNG图标（渐变圆形）
function createSimplePNG(color) {
  // 简单的32x32 PNG图标（base64编码）
  // 这是一个简单的渐变圆形图标
  const pngBase64 = `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAARklEQVRYR+2WwQ2AIBAF4S+/rMJIJJZgR8J10J8C3w9E6zrP4dC7QAAAABJRU5ErkJggg==`;
  return Buffer.from(pngBase64, 'base64');
}

// 创建渐变色PNG
function createGradientPNG(isActive) {
  const width = 32;
  const height = 32;
  
  // 简单的RGBA数据
  const pixels = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 2;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        // 在圆内
        const alpha = Math.floor(255 * (1 - dist / radius));
        if (isActive) {
          // 选中状态：蓝色渐变
          pixels.push(74, 144, 217, alpha);
        } else {
          // 未选中状态：灰色
          pixels.push(153, 153, 153, alpha);
        }
      } else {
        // 透明背景
        pixels.push(0, 0, 0, 0);
      }
    }
  }
  
  // PNG文件头
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);
  
  // IDAT chunk (压缩的像素数据)
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (width * 4 + 1)] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const idx = y * width * 4 + x * 4;
      const outIdx = y * (width * 4 + 1) + 1 + x * 4;
      rawData[outIdx] = pixels[idx];
      rawData[outIdx + 1] = pixels[idx + 1];
      rawData[outIdx + 2] = pixels[idx + 2];
      rawData[outIdx + 3] = pixels[idx + 3];
    }
  }
  
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32Table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// CRC32表
const crc32Table = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crc32Table[i] = c;
}

// 生成图标
const iconsDir = path.join(__dirname, '../images_1');

// 创建未选中图标
const inactiveIcon = createGradientPNG(false);
fs.writeFileSync(path.join(iconsDir, 'growth.png'), inactiveIcon);

// 创建选中图标
const activeIcon = createGradientPNG(true);
fs.writeFileSync(path.join(iconsDir, 'growth_active.png'), activeIcon);

console.log('图标生成完成！');