package com.harvy.remote;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
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
            Window window = getWindow();
            // Completely transparent window background
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);

            // FLAG_NOT_TOUCH_MODAL allows touches outside the remote window to reach underlying apps
            window.addFlags(
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );

            // Size window strictly to the remote pebble so touches outside pass through to wallpaper/apps
            float density = getResources().getDisplayMetrics().density;
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.width = (int) (230 * density);
            lp.height = (int) (540 * density);
            lp.gravity = Gravity.CENTER;
            window.setAttributes(lp);

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Ensure webview canvas is 100% transparent
                webView.setBackgroundColor(Color.TRANSPARENT);

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

                    @JavascriptInterface
                    public void moveWindow(int deltaX, int deltaY) {
                        runOnUiThread(() -> {
                            try {
                                WindowManager.LayoutParams currentLp = getWindow().getAttributes();
                                currentLp.x += deltaX;
                                currentLp.y += deltaY;
                                getWindow().setAttributes(currentLp);
                            } catch (Exception e) {
                                // ignore
                            }
                        });
                    }

                    @JavascriptInterface
                    public void setWindowMode(String mode) {
                        runOnUiThread(() -> {
                            try {
                                WindowManager.LayoutParams currentLp = getWindow().getAttributes();
                                float d = getResources().getDisplayMetrics().density;
                                if ("mini".equals(mode)) {
                                    currentLp.width = (int) (190 * d);
                                    currentLp.height = (int) (360 * d);
                                } else {
                                    currentLp.width = (int) (230 * d);
                                    currentLp.height = (int) (540 * d);
                                }
                                getWindow().setAttributes(currentLp);
                            } catch (Exception e) {
                                // ignore
                            }
                        });
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
                // 9:16 portrait aspect ratio for the floating pebble remote
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
        // Automatically enter floating Picture-in-Picture remote when user presses Home or switches apps
        triggerPipMode();
    }
}


