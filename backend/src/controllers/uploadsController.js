const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Farm photo uploads live on local disk (hackathon V1), never in MySQL. Files
// are named server-side with a safe unique name; the client filename is only
// ever used as an extension hint so path traversal is impossible.
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Detect the real image type from the payload bytes (source of truth), not from
// the untrusted client filename.
function sniffExt(buffer) {
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

function isValidBase64(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

async function uploadImage(req, res) {
  const { fileName, base64 } = req.body || {};

  // Accept both a bare base64 string and the data URL form produced by pickers.
  let encoded = typeof base64 === 'string' ? base64.replace(/^data:[^;]+;base64,/, '') : null;
  if (!isValidBase64(encoded)) {
    return res.status(400).json({ success: false, message: 'Invalid base64 image payload' });
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length === 0) {
    return res.status(400).json({ success: false, message: 'Image payload is empty' });
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return res.status(413).json({ success: false, message: 'Image exceeds the 3 MB limit' });
  }

  const ext = sniffExt(buffer);
  if (!ext) {
    return res.status(400).json({ success: false, message: 'Unsupported image type. Use JPG, PNG or WEBP.' });
  }

  // Optional cross-check: if the client declares an extension it must match the
  // bytes. jpeg/jpg are treated as equivalent.
  const clientExt = typeof fileName === 'string'
    ? path.extname(fileName).toLowerCase().replace('.', '')
    : '';
  const allowedHint = ext === 'jpg' ? ['jpg', 'jpeg'] : [ext];
  if (clientExt && !allowedHint.includes(clientExt)) {
    return res.status(400).json({ success: false, message: 'File extension does not match the image type' });
  }

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const uniqueName = `crop-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, uniqueName), buffer);

  res.status(201).json({ success: true, data: { url: `/uploads/${uniqueName}` } });
}

module.exports = { uploadImage, UPLOADS_DIR };