package com.harvy.remote;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean isLaunchedFromExpand = false;
    private FloatingRemoteManager floatingManager;

    private void handleIntent(Intent intent) {
        if (intent != null && "EXPAND".equals(intent.getStringExtra("LAUNCH_MODE"))) {
            isLaunchedFromExpand = true;
        } else {
            isLaunchedFromExpand = false;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());

        try {
            // Enable hardware acceleration
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            );
            // Solid dark background for full remote mode (never translucent wallpaper)
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.parseColor("#0B0F19")));
            getWindow().getDecorView().setFitsSystemWindows(true);

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setFitsSystemWindows(true);
                webView.setBackgroundColor(Color.parseColor("#0B0F19"));

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

                floatingManager = FloatingRemoteManager.getInstance();
                floatingManager.init(MainActivity.this, tvManager);

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void enterPip() {
                        startFloatingRemote();
                    }

                    @JavascriptInterface
                    public void exitPip() {
                        hideFloatingRemote();
                    }

                    @JavascriptInterface
                    public boolean isPipSupported() {
                        return true;
                    }

                    @JavascriptInterface
                    public void startFloatingRemote() {
                        isLaunchedFromExpand = false;
                        floatingManager.showFloatingRemote();
                    }

                    @JavascriptInterface
                    public void hideFloatingRemote() {
                        floatingManager.hideFloatingRemote();
                    }

                    @JavascriptInterface
                    public boolean hasOverlayPermission() {
                        return floatingManager.canDrawOverlays();
                    }

                    @JavascriptInterface
                    public void requestOverlayPermission() {
                        floatingManager.requestOverlayPermission();
                    }

                    @JavascriptInterface
                    public void updateFloatingDeviceInfo(String brand, String ip, int port, String name) {
                        floatingManager.updateDeviceInfo(brand, ip, port, name);
                    }

                    @JavascriptInterface
                    public void setWindowMode(String mode) {
                        if ("mini".equalsIgnoreCase(mode)) {
                            startFloatingRemote();
                        } else {
                            hideFloatingRemote();
                        }
                    }

                    @JavascriptInterface
                    public boolean isExpandMode() {
                        return isLaunchedFromExpand;
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
                    public void fetchInstalledApps(String brand, String ip, int port) {
                        tvManager.fetchInstalledApps(brand, ip, port);
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

                    @JavascriptInterface
                    public void closeApp() {
                        runOnUiThread(() -> {
                            try {
                                if (floatingManager != null) {
                                    floatingManager.hideFloatingRemote();
                                }
                                finishAffinity();
                            } catch (Exception e) {
                                finish();
                            }
                        });
                    }
                }, "AndroidNativeBridge");
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (floatingManager != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                boolean hasPermission = floatingManager.canDrawOverlays();
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('overlay-permission-status', { detail: { granted: " + hasPermission + " } }));",
                    null
                );
            }

            // If user launches app normally (not expanded from floating remote) and overlay permission is granted:
            // automatically show the floating remote and minimize activity so they can use other apps in parallel!
            if (!isLaunchedFromExpand && floatingManager.canDrawOverlays()) {
                floatingManager.showFloatingRemote();
            }
        }
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        finish();
    }
}
