package com.harvy.remote;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
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
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            getWindow().getDecorView().setFitsSystemWindows(true);

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setFitsSystemWindows(true);
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

                NativeTVManager tvManager = new NativeTVManager(MainActivity.this, webView);
                webView.addJavascriptInterface(tvManager, "NativeTVManager");

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void enterPip() {
                        runOnUiThread(() -> triggerPipMode());
                    }

                    @JavascriptInterface
                    public void exitPip() {
                        runOnUiThread(() -> {
                            try {
                                Intent intent = new Intent(MainActivity.this, MainActivity.class);
                                intent.setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                                startActivity(intent);
                            } catch (Exception e) {
                                // fallback
                            }
                        });
                    }

                    @JavascriptInterface
                    public boolean isPipSupported() {
                        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
                    }

                    @JavascriptInterface
                    public void sendAction(String brand, String ip, int port, String action) {
                        tvManager.sendAction(brand, ip, port, action);
                    }

                    @JavascriptInterface
                    public void startScan() {
                        tvManager.startScan();
                    }

                    @JavascriptInterface
                    public void launchApp(String brand, String ip, int port, String appSlug) {
                        tvManager.launchApp(brand, ip, port, appSlug);
                    }

                    @JavascriptInterface
                    public void pingDevice(String ip, int port) {
                        tvManager.pingDevice(ip, port);
                    }

                    @JavascriptInterface
                    public void sendTextInput(String brand, String ip, int port, String text) {
                        tvManager.sendTextInput(brand, ip, port, text);
                    }

                    @JavascriptInterface
                    public void startPairing(String ip) {
                        tvManager.startPairing(ip);
                    }

                    @JavascriptInterface
                    public void submitPairingPin(String ip, String pin) {
                        tvManager.submitPairingPin(ip, pin);
                    }

                    @JavascriptInterface
                    public String getDeviceSubnet() {
                        return tvManager.getDeviceSubnet();
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
                webView.setBackgroundColor(Color.TRANSPARENT);
                getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
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


