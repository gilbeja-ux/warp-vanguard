package com.warpvanguard.game;

import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    // THREE STRIKES IN A MINUTE IS A LOOP, NOT A HICCUP: a renderer that dies
    // during the splash bake dies again on the recreated boot. Past the third
    // death the listener answers false and the OS takes the app down cleanly,
    // instead of a navy window that flickers forever.
    private static final int RENDERER_DEATHS_MAX = 3;
    private static final long RENDERER_DEATHS_WINDOW_MS = 60_000L;
    private static int rendererDeaths = 0;
    private static long rendererDeathsSince = 0L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyImmersive();
        // THE RENDERER CAN DIE WITHOUT THE APP DYING (2026-09-08). Android runs
        // web content in its own process; when memory runs out it ends that
        // process and asks the app what to do. With no answer, Android ends the
        // app too — and a lane holds 135 MB of canvas, so this is the likeliest
        // native crash the game has. The iOS shell already reloads (Capacitor's
        // webViewWebContentProcessDidTerminate); this is its twin. A dead
        // renderer's WebView cannot be reused, so the activity is recreated,
        // which brings a fresh one and boots the game from its splash. The save
        // is on disk: the lane is lost, the app is not.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                long now = System.currentTimeMillis();
                if (now - rendererDeathsSince > RENDERER_DEATHS_WINDOW_MS) { rendererDeaths = 0; rendererDeathsSince = now; }
                if (++rendererDeaths > RENDERER_DEATHS_MAX) return false;
                recreate();
                return true;
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // System bars can reappear (returning from background, a swipe, etc.);
        // re-hide them whenever we regain focus so the game stays fullscreen.
        if (hasFocus) applyImmersive();
    }

    private void applyImmersive() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
