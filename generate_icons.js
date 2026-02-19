const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a simple PNG file with a gradient
// PNG format: signature + chunks (IHDR, IDAT, IEND)

function createPNG(width, height) {
    // PNG Signature
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData.writeUInt8(8, 8);  // Bit depth
    ihdrData.writeUInt8(2, 9);  // Color type (RGB)
    ihdrData.writeUInt8(0, 10); // Compression
    ihdrData.writeUInt8(0, 11); // Filter
    ihdrData.writeUInt8(0, 12); // Interlace

    const ihdr = createChunk('IHDR', ihdrData);

    // Create raw pixel data with filter byte
    const rawData = Buffer.alloc((width * 3 + 1) * height);

    for (let y = 0; y < height; y++) {
        const rowStart = y * (width * 3 + 1);
        rawData[rowStart] = 0; // Filter byte (none)

        for (let x = 0; x < width; x++) {
            // Normalized coordinates (0 to 1)
            const u = x / width;
            const v = y / height;

            // Mix factor (diagonal gradient)
            const t = (u + v) / 2;

            // Purple (#8b5cf6) to Blue (#6366f1)
            const r = Math.floor(139 * (1 - t) + 99 * t);
            const g = Math.floor(92 * (1 - t) + 102 * t);
            const b = Math.floor(246 * (1 - t) + 241 * t);

            const offset = rowStart + 1 + x * 3;
            rawData[offset] = r;
            rawData[offset + 1] = g;
            rawData[offset + 2] = b;
        }
    }

    // Compress with zlib
    const compressed = zlib.deflateSync(rawData, { level: 9 });
    const idat = createChunk('IDAT', compressed);

    // IEND chunk
    const iend = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function crc32(buffer) {
    let crc = 0xffffffff;
    const table = getCRC32Table();

    for (let i = 0; i < buffer.length; i++) {
        crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table = null;
function getCRC32Table() {
    if (crc32Table) return crc32Table;

    crc32Table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crc32Table[i] = c;
    }
    return crc32Table;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

const sizes = [16, 48, 128];

sizes.forEach(size => {
    try {
        const buffer = createPNG(size, size);
        const filePath = path.join(iconsDir, `icon${size}.png`);
        fs.writeFileSync(filePath, buffer);
        console.log(`Generated ${filePath}`);
    } catch (err) {
        console.error(`Failed to generate icon${size}.png:`, err);
    }
});

console.log('Done! Icons generated as PNG files.');
