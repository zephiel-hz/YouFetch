# YouFetch

Website sederhana untuk download, memotong, dan mengubah format video YouTube.

## Fitur

- Unduh video YouTube
- Potong durasi (mulai / selesai)
- Ubah format: `mp4`, `mkv`, `webm`, `mp3`

## Instalasi

1. Buka folder `e:\my apps\Web\YouFetch`
2. Jalankan:

```bash
npm install
```

## Menjalankan

```bash
npm start
```

Lalu buka: `http://localhost:3000`

## Catatan

- Backend menggunakan `yt-dlp` untuk mengunduh video dan `ffmpeg` untuk konversi.
- Paket `ffmpeg-static` sudah disertakan, sehingga tidak perlu instal FFmpeg secara manual.
- Jika terjadi kegagalan, periksa koneksi internet dan format yang dipilih.

## Struktur proyek

- `server.js` - backend Express
- `public/index.html` - antarmuka web
- `public/styles.css` - gaya tampilan
- `public/script.js` - logika frontend
