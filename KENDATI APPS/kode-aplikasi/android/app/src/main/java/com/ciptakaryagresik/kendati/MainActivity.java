package com.ciptakaryagresik.kendati;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
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
