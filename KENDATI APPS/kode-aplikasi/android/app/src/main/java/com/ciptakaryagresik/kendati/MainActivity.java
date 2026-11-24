package com.ciptakaryagresik.kendati;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * KENDATI - Android
 *  - Layar penuh (status bar & navigation bar disembunyikan, geser dari tepi untuk memunculkan sementara)
 *  - Mode Mobile/Web, overlay & unduhan: lihat KendatiShellPlugin
 *  - Tombol Back Android = kembali ke halaman sebelumnya
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // plugin dipasang SEBELUM halaman pertama dimuat (atur UA, overlay, jembatan JS)
        registerPlugin(KendatiShellPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#071b3a"));
        hideSystemBars();
        askPermissionsOnce();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = getBridge().getWebView();
                if (w != null && w.canGoBack()) {
                    w.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    // ---------------- Izin: lokasi, kamera, galeri & file ----------------
    // Ditanyakan sekali saat aplikasi pertama dibuka. Bisa diubah lagi di
    // Setelan HP -> Aplikasi -> KENDATI -> Izin.
    private void askPermissionsOnce() {
        SharedPreferences prefs = getSharedPreferences("kendati", MODE_PRIVATE);
        if (prefs.getBoolean("permsAsked", false)) return;
        prefs.edit().putBoolean("permsAsked", true).apply();

        List<String> want = new ArrayList<>();
        want.add(Manifest.permission.ACCESS_FINE_LOCATION);
        want.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        want.add(Manifest.permission.CAMERA);
        if (Build.VERSION.SDK_INT >= 33) {
            want.add(Manifest.permission.READ_MEDIA_IMAGES);
            want.add(Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            want.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        List<String> missing = new ArrayList<>();
        for (String p : want) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), 7);
        }
    }

    // ---------------- Layar penuh tanpa bar ----------------
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }
}
