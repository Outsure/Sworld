const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const SWORLD_PREFIX = '/sworld';
const BASE_URL = process.env.BASE_URL || 'https://sworld-x3ob.onrender.com';

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sendPublicFile(res, filename) {
  res.sendFile(path.join(PUBLIC_DIR, filename));
}

app.get('/', (_req, res) => res.redirect(`${SWORLD_PREFIX}/join`));
app.get(SWORLD_PREFIX, (_req, res) => res.redirect(`${SWORLD_PREFIX}/join`));
app.get(`${SWORLD_PREFIX}/join`, (_req, res) => sendPublicFile(res, 'join.html'));
app.get(`${SWORLD_PREFIX}/display`, (_req, res) => sendPublicFile(res, 'display.html'));
app.get(`${SWORLD_PREFIX}/admin`, (_req, res) => sendPublicFile(res, 'admin.html'));

app.get('/api/entries', (_req, res) => {
  const data = readData().filter(item => item.approved !== false);
  res.json(data.sort((a, b) => a.createdAt - b.createdAt));
});

app.post('/api/entries', upload.single('photo'), (req, res) => {
  const { name, ig, message } = req.body;

  if (!name || !ig) {
    return res.status(400).json({ error: 'Name and IG are required.' });
  }

  const normalizedIg = String(ig).trim().replace(/^@/, '');
  const data = readData();
  const entry = {
    id: Date.now().toString(),
    name: String(name).trim(),
    ig: normalizedIg,
    message: String(message || '').trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : '/default-avatar.png',
    approved: true,
    createdAt: Date.now()
  };

  data.push(entry);
  writeData(data);
  res.json({ success: true, entry });
});

app.delete('/api/entries/:id', (req, res) => {
  const data = readData();
  const index = data.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });

  const [removed] = data.splice(index, 1);
  writeData(data);

  if (removed.photo && removed.photo.startsWith('/uploads/')) {
    const photoPath = path.join(PUBLIC_DIR, removed.photo);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }

  res.json({ success: true });
});

app.get('/api/qrcode', async (_req, res) => {
  try {
    const joinUrl = `${BASE_URL}${SWORLD_PREFIX}/join`;
    const qr = await QRCode.toDataURL(joinUrl, { width: 500, margin: 1 });
    res.json({ url: joinUrl, qr });
  } catch (error) {
    res.status(500).json({ error: 'QR generation failed.' });
  }
});

app.get('/join.html', (_req, res) => sendPublicFile(res, 'join.html'));
app.get('/display.html', (_req, res) => sendPublicFile(res, 'display.html'));
app.get('/admin.html', (_req, res) => sendPublicFile(res, 'admin.html'));

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Sworld Wall running on ${BASE_URL}${SWORLD_PREFIX}/join`);
});
