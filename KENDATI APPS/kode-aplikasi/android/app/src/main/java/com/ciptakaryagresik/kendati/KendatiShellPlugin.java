package com.ciptakaryagresik.kendati;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.widget.Toast;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.content.FileProvider;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
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
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
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

    /** Halaman Google yang butuh login: dibuka di tab browser DI DALAM aplikasi
     *  (Google memblokir login di WebView). Tombol X membawa kembali ke KENDATI. */
    private static final Set<String> GOOGLE_HOSTS = new HashSet<>(Arrays.asList(
        "accounts.google.com", "accounts.youtube.com", "myaccount.google.com",
        "drive.google.com", "docs.google.com", "mail.google.com"
    ));

    private String mobileUA;
    private boolean overlayViaDocStart = false;

    @Override
    public void load() {
        WebView wv = getBridge().getWebView();
        WebSettings s = wv.getSettings();
        mobileUA = s.getUserAgentString();            // sudah berisi "KendatiApp" (appendUserAgent)
        wv.addJavascriptInterface(new NativeBridge(), "KendatiNative");
        // unduhan biasa (http/https) diteruskan ke browser / pengelola unduhan sistem
        wv.setDownloadListener((url, ua, contentDisposition, mime, length) -> openUrl(url));
        injectOverlay(wv);
        applyMode(isDesktop(), false);
    }

    // ---------------- Semua link tetap di dalam aplikasi ----------------
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https")) return null;   // tel:, mailto:, whatsapp: -> aplikasi terkait
        String host = url.getHost() == null ? "" : url.getHost().toLowerCase();
        if (GOOGLE_HOSTS.contains(host)) {
            openInAppTab(url);
            return true;
        }
        return false;   // situs lain dimuat di dalam aplikasi
    }

    private void openInAppTab(Uri url) {
        getActivity().runOnUiThread(() -> {
            try {
                CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(Color.parseColor("#071b3a"))
                    .build();
                new CustomTabsIntent.Builder()
                    .setDefaultColorSchemeParams(colors)
                    .setShowTitle(true)
                    .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
                    .build()
                    .launchUrl(getActivity(), url);
            } catch (Exception e) {
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {}
            }
        });
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
            final Uri openUri = uri;
            final String shown = safe;
            getActivity().runOnUiThread(() -> {
                Toast.makeText(getActivity(), "Tersimpan di Download/KENDATI: " + shown, Toast.LENGTH_LONG).show();
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(openUri, mime);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    getActivity().startActivity(i);
                } catch (Exception ignored) {}
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
