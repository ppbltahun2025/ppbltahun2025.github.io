package com.ciptakaryagresik.kendati;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.WebViewListener;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Collections;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KENDATI Shell: dipasang sebelum halaman pertama dimuat.
 *  - Mode Mobile / Mode Web (desktop) seperti "Situs desktop" di Chrome
 *  - Menyuntikkan kendati-overlay.js ke setiap halaman (tombol menu mengambang)
 *  - Jembatan JS "KendatiNative": ganti mode, muat ulang, buka browser, simpan unduhan
 */
@CapacitorPlugin(name = "KendatiShell")
public class KendatiShellPlugin extends Plugin {

    private static final String PREFS = "kendati";
    private static final String KEY_MODE = "mode";

    private String mobileUA;
    private boolean overlayViaDocStart = false;

    @Override
    public void load() {
        WebView wv = getBridge().getWebView();
        WebSettings s = wv.getSettings();
        mobileUA = s.getUserAgentString();            // sudah berisi "KendatiApp" (appendUserAgent)
        wv.addJavascriptInterface(new NativeBridge(), "KendatiNative");
        // unduhan biasa (http/https) diunduh langsung oleh aplikasi, tidak lewat Chrome
        wv.setDownloadListener((url, ua, contentDisposition, mime, length) -> downloadInApp(url, ua, contentDisposition, mime));
        injectOverlay(wv);
        setupLoginMemory(wv);
        applyMode(isDesktop(), false);
    }

    // ---------------- Ingat login (nama & sandi, terenkripsi Keystore) ----------------
    // Jalur aman: WebMessageListener memberi tahu asal (origin) halaman yang bertanya,
    // jadi akun sebuah situs hanya bisa dibaca oleh situs itu sendiri.
    private void setupLoginMemory(WebView wv) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(wv, "KendatiLogin", Collections.singleton("*"),
            (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                try {
                    if (!"https".equals(sourceOrigin.getScheme()) || sourceOrigin.getHost() == null) return;
                    String key = "login_" + sourceOrigin.getHost();
                    JSONObject msg = new JSONObject(message.getData());
                    SharedPreferences prefs = getActivity().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                    if ("save".equals(msg.optString("type"))) {
                        JSONObject acc = new JSONObject();
                        acc.put("u", msg.optString("u"));
                        acc.put("p", msg.optString("p"));
                        prefs.edit().putString(key, encrypt(acc.toString())).apply();
                    } else if ("get".equals(msg.optString("type"))) {
                        String enc = prefs.getString(key, null);
                        replyProxy.postMessage(enc == null ? "" : decrypt(enc));
                    }
                } catch (Exception ignored) {}
            });
    }

    private SecretKey loginKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (!ks.containsAlias("kendati_login")) {
            KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            kg.init(new KeyGenParameterSpec.Builder("kendati_login",
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
            return kg.generateKey();
        }
        return ((KeyStore.SecretKeyEntry) ks.getEntry("kendati_login", null)).getSecretKey();
    }

    private String encrypt(String plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, loginKey());
        byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
    }

    private String decrypt(String stored) throws Exception {
        String[] parts = stored.split(":");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, loginKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(c.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    // ---------------- Semua link tetap di dalam aplikasi ----------------
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase();
        if (scheme.equals("blob") || scheme.equals("data")) {
            downloadInApp(url.toString(), null, null, null);
            return true;
        }
        if (!scheme.equals("http") && !scheme.equals("https")) return null;   // tel:, mailto:, whatsapp: -> aplikasi terkait
        return false;   // SEMUA halaman web dimuat di dalam aplikasi (tidak dilempar ke Chrome)
    }

    // ---------------- Overlay (menu mengambang) ----------------
    private void injectOverlay(WebView wv) {
        final String js = readAsset("public/kendati-overlay.js");
        if (js == null) return;
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            // berjalan di setiap halaman, termasuk halaman yang dibuka dari link
            WebViewCompat.addDocumentStartJavaScript(wv, js, Collections.singleton("*"));
            overlayViaDocStart = true;
        }
        // cadangan untuk WebView lama: suntik setelah halaman selesai dimuat
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                if (!overlayViaDocStart) webView.evaluateJavascript(js, null);
            }
        });
    }

    private String readAsset(String path) {
        try (InputStream in = getActivity().getAssets().open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) {
            return null;
        }
    }

    // ---------------- Mode Mobile / Web ----------------
    private boolean isDesktop() {
        return "desktop".equals(getActivity().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_MODE, "mobile"));
    }

    private String desktopUA() {
        String chrome = "131.0.0.0";
        Matcher m = Pattern.compile("Chrome/([\\d.]+)").matcher(mobileUA == null ? "" : mobileUA);
        if (m.find()) chrome = m.group(1);
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
            + chrome + " Safari/537.36 KendatiApp KendatiDesktop";
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void applyMode(boolean desktop, boolean reload) {
        WebView wv = getBridge().getWebView();
        if (wv == null) return;
        WebSettings s = wv.getSettings();
        s.setUserAgentString(desktop ? desktopUA() : mobileUA);
        s.setUseWideViewPort(desktop);
        s.setLoadWithOverviewMode(desktop);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        if (reload) wv.reload();
    }

    private void openUrl(String url) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) return;
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {}
        });
    }

    /** Unduh file http/https dengan pengelola unduhan Android (notifikasi + folder Download/KENDATI). */
    private void downloadInApp(String url, String ua, String contentDisposition, String mime) {
        // file buatan halaman (blob:/data:) tidak bisa diunduh Android -> minta halaman mengirim isinya
        if (url != null && (url.startsWith("blob:") || url.startsWith("data:"))) {
            String name = "unduhan";
            if (contentDisposition != null && contentDisposition.contains("filename")) {
                name = URLUtil.guessFileName(url, contentDisposition, mime);
            }
            final String js = "window.__kendatiGrabBlob && window.__kendatiGrabBlob("
                + org.json.JSONObject.quote(url) + "," + org.json.JSONObject.quote(name) + ")";
            getActivity().runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
            return;
        }
        try {
            String name = URLUtil.guessFileName(url, contentDisposition, mime);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) req.addRequestHeader("Cookie", cookies);
            req.addRequestHeader("User-Agent", ua);
            if (mime != null) req.setMimeType(mime);
            req.setTitle(name);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "KENDATI/" + name);
            DownloadManager dm = (DownloadManager) getActivity().getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(req);
            getActivity().runOnUiThread(() -> Toast.makeText(getActivity(), "Mengunduh " + name + " ke Download/KENDATI", Toast.LENGTH_SHORT).show());
        } catch (Exception e) {
            getActivity().runOnUiThread(() -> Toast.makeText(getActivity(), "Gagal mengunduh file", Toast.LENGTH_SHORT).show());
        }
    }

    /** Simpan file (dari blob/data URL halaman) ke folder Download, lalu buka. */
    private void saveToDownloads(String name, String mime, byte[] data) {
        try {
            String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
            if (!safe.contains(".")) {
                String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
                if (ext != null) safe += "." + ext;
            }
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                v.put(MediaStore.Downloads.MIME_TYPE, mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/KENDATI");
                uri = getActivity().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("MediaStore");
                try (OutputStream os = getActivity().getContentResolver().openOutputStream(uri)) {
                    os.write(data);
                }
            } else {
                File dir = new File(getActivity().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "KENDATI");
                dir.mkdirs();
                File f = new File(dir, safe);
                try (FileOutputStream os = new FileOutputStream(f)) {
                    os.write(data);
                }
                uri = FileProvider.getUriForFile(getActivity(), getActivity().getPackageName() + ".fileprovider", f);
            }
            final String shown = safe;
            getActivity().runOnUiThread(() -> {
                // tetap di aplikasi: cukup beri tahu lokasi file
                Toast.makeText(getActivity(), "Tersimpan di Download/KENDATI: " + shown, Toast.LENGTH_LONG).show();
            });
        } catch (Exception e) {
            getActivity().runOnUiThread(() -> Toast.makeText(getActivity(), "Gagal menyimpan file", Toast.LENGTH_SHORT).show());
        }
    }

    private class NativeBridge {
        @JavascriptInterface
        public void setMode(String mode) {
            final boolean desktop = "desktop".equals(mode);
            SharedPreferences p = getActivity().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            p.edit().putString(KEY_MODE, desktop ? "desktop" : "mobile").apply();
            getActivity().runOnUiThread(() -> applyMode(desktop, true));
        }

        @JavascriptInterface
        public void hardReload() {
            getActivity().runOnUiThread(() -> {
                WebView wv = getBridge().getWebView();
                if (wv == null) return;
                wv.clearCache(true);       // ambil versi terbaru dari server
                wv.reload();
            });
        }

        @JavascriptInterface
        public void download(String url, String name) {
            String cd = (name == null || name.isEmpty()) ? null : "attachment; filename=\"" + name + "\"";
            downloadInApp(url, getBridge().getWebView() == null ? null : mobileUA, cd, null);
        }

        /** Kirim rating ke Supabase dari aplikasi (tidak terhalang CSP halaman). */
        @JavascriptInterface
        public void postJson(String url, String key, String body) {
            new Thread(() -> {
                int status = 0;
                try {
                    Uri u = Uri.parse(url);
                    if (!"https".equals(u.getScheme()) || u.getHost() == null || !u.getHost().endsWith(".supabase.co")) return;
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setRequestMethod("POST");
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(15000);
                    c.setDoOutput(true);
                    c.setRequestProperty("apikey", key);
                    c.setRequestProperty("Content-Type", "application/json");
                    try (OutputStream os = c.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                    status = c.getResponseCode();
                    c.disconnect();
                } catch (Exception ignored) {}
                final String js = "window.__kendatiRatingDone && window.__kendatiRatingDone(" + status + ")";
                getActivity().runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
            }).start();
        }

        @JavascriptInterface
        public void openExternal(String url) {
            openUrl(url);
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            try {
                saveToDownloads(name, mime == null ? "application/octet-stream" : mime, Base64.decode(base64, Base64.DEFAULT));
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> Toast.makeText(getActivity(), "Gagal menyimpan file", Toast.LENGTH_SHORT).show());
            }
        }
    }
}
