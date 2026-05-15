const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const ytdlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const tempRoot = path.join(os.tmpdir(), 'youfetch-temp');

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

async function ensureTempDir() {
  try {
    await fs.mkdir(tempRoot, { recursive: true });
  } catch (err) {
    console.error('Gagal membuat direktori sementara:', err);
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const error = new Error(`Command failed with code ${code}: ${stderr.trim()}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9-_.]/gi, '_');
}

async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(tempRoot);
    const now = Date.now();
    for (const file of files) {
      const filePath = path.join(tempRoot, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > 1000 * 60 * 30) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Cleanup error:', err.message || err);
  }
}

app.post('/api/process', async (req, res) => {
  const { url, start, end, format } = req.body;

  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'URL YouTube tidak valid.' });
  }

  const allowedFormats = ['mp4', 'mkv', 'webm', 'mp3'];
  const targetFormat = allowedFormats.includes(format) ? format : 'mp4';

  const startTime = start ? Number(start) : undefined;
  const endTime = end ? Number(end) : undefined;

  if ((start && Number.isNaN(startTime)) || (end && Number.isNaN(endTime))) {
    return res.status(400).json({ error: 'Waktu mulai atau selesai tidak valid.' });
  }

  if (startTime != null && startTime < 0) {
    return res.status(400).json({ error: 'Waktu mulai tidak boleh negatif.' });
  }

  if (endTime != null && endTime <= 0) {
    return res.status(400).json({ error: 'Waktu selesai tidak boleh negatif atau nol.' });
  }

  if (startTime != null && endTime != null && endTime <= startTime) {
    return res.status(400).json({ error: 'Waktu selesai harus lebih besar dari waktu mulai.' });
  }

  await ensureTempDir();

  const id = sanitizeFilename(uuidv4().slice(0, 10));
  const downloadFile = path.join(tempRoot, `${id}.mkv`);
  const outputFile = path.join(tempRoot, `${id}.${targetFormat}`);

  try {
    await ytdlp(url, {
      format: 'bestvideo+bestaudio/best',
      output: downloadFile,
      merge_output_format: 'mkv',
      no_check_certificate: true,
      no_warnings: true,
      quiet: true,
      no_progress: true,
    });
  } catch (err) {
    console.error('Download error:', err.stderr || err);
    return res.status(500).json({ error: 'Gagal mengunduh video YouTube. Pastikan URL valid dan koneksi internet tersedia.' });
  }

  const ffmpegArgs = ['-y', '-i', downloadFile];

  if (startTime != null) {
    ffmpegArgs.push('-ss', `${startTime}`);
  }
  if (endTime != null) {
    ffmpegArgs.push('-to', `${endTime}`);
  }

  if (targetFormat === 'mp3') {
    ffmpegArgs.push('-vn', '-c:a', 'libmp3lame', '-q:a', '3');
  } else if (targetFormat === 'webm') {
    ffmpegArgs.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-b:v', '1M');
  } else {
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', '-b:a', '192k');
  }

  ffmpegArgs.push(outputFile);

  try {
    await runCommand(ffmpegPath, ffmpegArgs);
    await fs.unlink(downloadFile).catch(() => {});
    const downloadUrl = `/download/${path.basename(outputFile)}`;
    return res.json({ downloadUrl, filename: path.basename(outputFile) });
  } catch (err) {
    console.error('Conversion error:', err.stderr || err);
    await fs.unlink(downloadFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
    return res.status(500).json({ error: 'Gagal memproses video. Silakan coba lagi dengan pilihan format atau waktu potong lain.' });
  }
});

app.get('/download/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(tempRoot, filename);

  try {
    await fs.access(filePath);
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download failed:', err.message || err);
      }
    });
  } catch {
    res.status(404).send('File tidak ditemukan atau sudah kadaluarsa.');
  }
});

setInterval(cleanupOldFiles, 1000 * 60 * 10);

app.listen(port, () => {
  console.log(`YouFetch berjalan di http://localhost:${port}`);
});
