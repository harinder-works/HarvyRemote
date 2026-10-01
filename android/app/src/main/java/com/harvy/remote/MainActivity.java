package com.harvy.remote;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            // Enable hardware acceleration
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Hardware compositing layer for 60/120fps UI
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                webView.setVerticalScrollBarEnabled(false);
                webView.setHorizontalScrollBarEnabled(false);

                WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                }

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void enterPip() {
                        runOnUiThread(() -> triggerPipMode());
                    }

                    @JavascriptInterface
                    public boolean isPipSupported() {
                        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
                    }
                }, "AndroidNativeBridge");
            }
        } catch (Exception e) {
            // ignore
        }
    }

    public void triggerPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                // 9:16 aspect ratio perfectly matches the mini remote pebble
                builder.setAspectRatio(new Rational(9, 16));
                enterPictureInPictureMode(builder.build());
            } catch (Exception e) {
                try {
                    enterPictureInPictureMode();
                } catch (Exception ex) {
                    // fallback
                }
            }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('pip-mode-changed', { detail: { isPip: " + isInPictureInPictureMode + " } }));",
                        null
                    );
                });
            }
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Automatically enter floating Picture-in-Picture remote when user presses Home
        triggerPipMode();
    }
}


