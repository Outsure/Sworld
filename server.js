const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
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
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed.'));
  }
});
const recentSubmissions = new Map();
const DUPLICATE_WINDOW_MS = 15000;

function isDuplicateSubmission(key) {
  const now = Date.now();
  const lastTime = recentSubmissions.get(key);

  if (lastTime && now - lastTime < DUPLICATE_WINDOW_MS) {
    return true;
  }

  recentSubmissions.set(key, now);

  for (const [k, t] of recentSubmissions.entries()) {
    if (now - t > DUPLICATE_WINDOW_MS) {
      recentSubmissions.delete(k);
    }
  }

  return false;
}
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use(express.static(PUBLIC_DIR));

async function readData() {
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeData(data) {
  await fsp.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let dataQueue = Promise.resolve();

function withDataLock(task) {
  dataQueue = dataQueue.then(task, task);
  return dataQueue;
}

function sendPublicFile(res, filename) {
  res.sendFile(path.join(PUBLIC_DIR, filename));
}

app.get('/', (_req, res) => res.redirect(`${SWORLD_PREFIX}/join`));
app.get(SWORLD_PREFIX, (_req, res) => res.redirect(`${SWORLD_PREFIX}/join`));
app.get(`${SWORLD_PREFIX}/join`, (_req, res) => sendPublicFile(res, 'join.html'));
app.get(`${SWORLD_PREFIX}/display`, (_req, res) => sendPublicFile(res, 'display.html'));
app.get(`${SWORLD_PREFIX}/admin`, (_req, res) => sendPublicFile(res, 'admin.html'));

app.get('/api/entries', async (_req, res) => {
const data = (await readData()).filter(item => item.approved !== false);
  res.json(data.sort((a, b) => a.createdAt - b.createdAt));
});

app.post('/api/entries', upload.single('photo'), async (req, res) => {
  const { name, ig, message } = req.body;

if (!name) {
  return res.status(400).json({ error: 'name is required' });
}

const normalizedIg = String(ig).trim().replace(/^@/, '').toLowerCase();
  const normalizedName = String(name).trim().toLowerCase();
const normalizedMessage = String(message || '').trim().toLowerCase();
const originalFileName = req.file ? String(req.file.originalname || '').toLowerCase() : '';

const duplicateKey = `${normalizedName}__${normalizedIg}__${normalizedMessage}__${originalFileName}`;

if (isDuplicateSubmission(duplicateKey)) {
  if (req.file) {
    const uploadedPath = path.join(UPLOAD_DIR, req.file.filename);
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  }

  return res.status(409).json({
    error: 'duplicate submission'
  });
}
const entry = await withDataLock(async () => {

  const data = await readData();

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    name: String(name).trim(),
    ig: normalizedIg,
    message: String(message || '').trim(),
    photo: req.file ? `/uploads/${req.file.filename}` : '/default-avatar.png',
    approved: true,
    createdAt: Date.now()
  };

  data.push(entry);
  await writeData(data);

  return entry;
});

  res.json({ success: true, entry });
});

app.delete('/api/entries/:id', async (req, res) => {
  const removed = await withDataLock(async () => {
    const data = await readData();
    const index = data.findIndex(item => item.id === req.params.id);
    if (index === -1) return null;

    const [removed] = data.splice(index, 1);
    await writeData(data);
    return removed;
  });

  if (!removed) return res.status(404).json({ error: 'Not found' });

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
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'รูปมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 15MB' });
  }
  res.status(400).json({ error: err.message || 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Sworld Wall running on ${BASE_URL}${SWORLD_PREFIX}/join`);
});
