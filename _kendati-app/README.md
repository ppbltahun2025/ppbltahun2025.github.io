# KENDATI — Aplikasi Android & iOS

Aplikasi ini membuka **https://ppbltahun2025.github.io/** secara langsung.
Semua fitur KENDATI (SIMBG, PPBL, Dan Lain Lain, statistik pengunjung, musik,
slideshow, Heisenberg, Penerangan Sementara, 360 Tour, Scrape GAS, Agen Hataf, dst.)
tetap sama persis, karena yang tampil adalah situs aslinya.

## Fitur
| | |
|---|---|
| **Otomatis update** | Setiap kali kamu mengubah file di repo `ppbltahun2025.github.io`, aplikasi langsung memakai versi baru. Tidak perlu build atau install ulang. GitHub Pages bisa menyimpan cache maksimal ±10 menit; tombol **Muat ulang** memaksa ambil versi terbaru. |
| **Layar penuh, tanpa bar** | Status bar, navigation bar, dan address bar disembunyikan. Di Android, geser dari tepi layar untuk memunculkannya sebentar. |
| **Mode Mobile / Mode Web** | Seperti "Situs desktop" di Chrome. Pilihan tersimpan, tetap berlaku untuk semua halaman, termasuk Apps Script. |
| **Tombol menu mengambang** | Bulatan kecil transparan yang bisa digeser ke tepi kiri/kanan. Isinya: Mobile/Web, Kembali, Beranda, Muat ulang, Buka di browser. |
| **Logo dari assets** | Ikon dan splash dibuat otomatis dari `assets/icon-menu.png` setiap kali build. |
| **Unduhan** | Ekspor PDF/Excel dari halaman (termasuk iframe Apps Script) tersimpan di **Download/KENDATI** (Android), atau lewat lembar Bagikan → Simpan ke File (iOS). |
| **Offline** | Kalau internet mati, muncul halaman "Tidak ada koneksi" dengan tombol Coba lagi. |
| **Tombol Back / swipe** | Android: tombol Back = halaman sebelumnya. iOS: geser dari tepi kiri. |

## Letak di repo `ppbltahun2025.github.io`
- `_kendati-app/` adalah kode aplikasi ini. Awalan `_` membuatnya tidak ikut tampil di situs.
- `.github/workflows/kendati-app.yml` membangun APK & IPA otomatis setiap kali folder ini
  atau `assets/icon-menu.png` berubah. Bisa juga dijalankan manual dari tab **Actions** → **Run workflow**.
- Hasil build diterbitkan ke Release **aplikasi**. Halaman pemasangannya:
  **https://ppbltahun2025.github.io/unduh.html**
  (juga ada di menu *Dan Lain Lain → PASANG APLIKASI KENDATI*).
- APK selalu ditandatangani dengan kunci yang sama (`android/app/kendati-debug.keystore`),
  jadi versi baru bisa dipasang di atas versi lama tanpa uninstall.

## iPhone / iPad
Apple tidak mengizinkan IPA diinstal tanpa tanda tangan. Pilihannya:
- **Gratis:** pasang `KENDATI-unsigned.ipa` dengan **Sideloadly** atau **AltStore** memakai Apple ID biasa. Aplikasi perlu ditandatangani ulang setiap 7 hari.
- **Resmi:** ikut Apple Developer Program (US$99/tahun), lalu buka `ios/App/App.xcodeproj` di Xcode. Atur *Signing & Capabilities* → Team, lalu Archive ke TestFlight atau App Store.

## APK rilis bertanda tangan (opsional, untuk Play Store)
Tanpa pengaturan apa pun, hasilnya adalah APK yang bisa langsung diinstal (kunci bawaan di repo).
Untuk APK rilis, tambahkan secret di repo (Settings → Secrets → Actions):
`ANDROID_KEYSTORE_BASE64` (isi file .jks hasil `base64 -w0`), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Catatan
- Halaman login Google (accounts.google.com), Google Drive, dan Google Docs/Sheets dibuka
  di browser atau aplikasi Google, karena Google memblokir login di dalam aplikasi pihak ketiga.
  Web app Apps Script yang tidak butuh login Google tetap terbuka di dalam aplikasi.
- Iklan AdSense biasanya tidak tampil di dalam aplikasi (WebView).
- Build ulang hanya perlu bila logo atau kode native di repo ini berubah.

## Struktur
```
capacitor.config.json   alamat situs live + domain yang boleh dibuka di dalam aplikasi
www/kendati-overlay.js  tombol menu mengambang, mode Web, unduhan (disuntik ke semua halaman)
www/offline.html        halaman saat tidak ada internet
android/…/MainActivity.java        layar penuh + tombol Back
android/…/KendatiShellPlugin.java  mode Mobile/Web, overlay, unduhan
ios/App/App/AppDelegate.swift      MainViewController: layar penuh, mode, overlay, unduhan
scripts/make_resources.py          membuat ikon & splash dari logo assets
.github/workflows/build.yml        build otomatis APK & IPA
```
