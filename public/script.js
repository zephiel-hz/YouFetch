const urlInput = document.getElementById('url');
const fetchButton = document.getElementById('fetchButton');
const errorMessage = document.getElementById('errorMessage');
const workspaceSection = document.getElementById('workspaceSection');
const durationLabelEl = document.getElementById('durationLabel');
const formatButtons = document.getElementById('formatButtons');
const qualitySelect = document.getElementById('qualitySelect');
const videoEmbed = document.getElementById('videoEmbed');
const toggleTrim = document.getElementById('toggleTrim');
const toggleThumb = document.getElementById('toggleThumb');
const trimFields = document.getElementById('trimFields');
const trimPreview = document.getElementById('trimPreview');
const trimTimeDisplay = document.getElementById('trimTimeDisplay');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const processButton = document.getElementById('processButton');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');

let videoId = '';
let enableTrim = false;
let format = 'mp4';
let quality = '1080p';
let isProcessing = false;
let progress = 0;
let processInterval = null;

const qualityOptions = {
  mp4: ['1080p', '720p', '480p', '360p'],
  mp3: ['320kbps', '256kbps', '128kbps'],
};

function extractVideoId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : false;
}

function setError(message) {
  errorMessage.textContent = message;
}

function resetWorkspace() {
  workspaceSection.hidden = true;
  isProcessing = false;
  progress = 0;
  progressBar.hidden = true;
  progressFill.style.width = '0%';
  processButton.textContent = 'Proses & Siapkan Unduhan';
  processButton.disabled = false;
  delete processButton.dataset.downloadUrl;
}

function setFormat(newFormat) {
  format = newFormat;
  document.querySelectorAll('.format-option').forEach((button) => {
    button.classList.toggle('active', button.dataset.format === format);
  });
  updateQualityOptions();
}

function updateQualityOptions() {
  qualitySelect.innerHTML = '';
  const options = qualityOptions[format] || [];
  options.forEach((option) => {
    const el = document.createElement('option');
    el.value = option;
    el.textContent = option;
    qualitySelect.appendChild(el);
  });
  quality = options[0] || '';
  if (qualitySelect.options.length > 0) {
    qualitySelect.value = quality;
  }
}

function setTrimState(enabled) {
  enableTrim = enabled;
  toggleTrim.classList.toggle('active', enableTrim);
  toggleThumb.style.transform = enableTrim ? 'translateX(30px)' : 'translateX(0px)';
  trimFields.hidden = !enableTrim;
  trimPreview.hidden = !enableTrim;
  updateTrimPreview();
}

function updateTrimPreview() {
  if (enableTrim) {
    trimTimeDisplay.textContent = `${startInput.value} - ${endInput.value}`;
  }
}

function showVideoData(id) {
  videoEmbed.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  durationLabelEl.textContent = 'Durasi: 10:30';
  updateQualityOptions();
  workspaceSection.hidden = false;
}

function simulateProgress(doneCallback) {
  progressBar.hidden = false;
  progress = 0;
  progressFill.style.width = '0%';
  processButton.disabled = true;

  processInterval = setInterval(() => {
    progress = Math.min(100, progress + Math.random() * 18);
    progressFill.style.width = `${progress}%`;
    processButton.textContent = `Memproses (${Math.round(progress)}%)`;

    if (progress >= 100) {
      clearInterval(processInterval);
      processInterval = null;
      doneCallback();
    }
  }, 500);
}

fetchButton.addEventListener('click', () => {
  setError('');
  resetWorkspace();

  const url = urlInput.value.trim();
  if (!url) {
    setError('Harap masukkan URL YouTube terlebih dahulu.');
    return;
  }

  const id = extractVideoId(url);
  if (!id) {
    setError('URL YouTube tidak valid. Harap periksa kembali.');
    return;
  }

  videoId = id;
  showVideoData(id);
});

formatButtons.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-format]');
  if (!button) return;
  setFormat(button.dataset.format);
});

qualitySelect.addEventListener('change', (event) => {
  quality = event.target.value;
});

toggleTrim.addEventListener('click', () => {
  setTrimState(!enableTrim);
});

startInput.addEventListener('input', updateTrimPreview);
endInput.addEventListener('input', updateTrimPreview);

processButton.addEventListener('click', async () => {
  if (!videoId) {
    setError('Silakan ambil video terlebih dahulu sebelum memproses.');
    return;
  }

  if (processButton.dataset.downloadUrl) {
    triggerDownload(processButton.dataset.downloadUrl, processButton.dataset.filename);
    return;
  }

  if (isProcessing) return;

  if (enableTrim && (!startInput.value.trim() || !endInput.value.trim())) {
    setError('Harap tentukan waktu mulai dan selesai.');
    return;
  }

  setError('');
  isProcessing = true;

  simulateProgress(async () => {
    try {
      const payload = {
        url: urlInput.value.trim(),
        format,
      };
      if (enableTrim) {
        payload.start = parseTimeToSeconds(startInput.value.trim());
        payload.end = parseTimeToSeconds(endInput.value.trim());
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memproses video di server.');
      }

      processButton.textContent = 'Unduh Sekarang';
      processButton.dataset.downloadUrl = result.downloadUrl;
      processButton.dataset.filename = result.filename;
      processButton.disabled = false;
      isProcessing = false;
    } catch (error) {
      setError(error.message);
      progressBar.hidden = true;
      processButton.textContent = 'Proses & Siapkan Unduhan';
      processButton.disabled = false;
      isProcessing = false;
    }
  });
});

function parseTimeToSeconds(value) {
  const parts = value.split(':').map((segment) => Number(segment.trim()));
  if (parts.some((n) => Number.isNaN(n))) {
    return 0;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(parts[0] || 0);
}

function triggerDownload(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  if (filename) {
    anchor.download = filename;
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

workspaceSection.hidden = true;
setFormat('mp4');
setTrimState(false);

console.log('YouFetch build version: 20260515.3');
