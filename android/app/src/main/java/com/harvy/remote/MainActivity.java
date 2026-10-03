package com.harvy.remote;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
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
                        // Keep interactive in-app floating mode; do not enter OS video PiP
                    }

                    @JavascriptInterface
                    public void exitPip() {
                        // Exit back to full remote
                    }

                    @JavascriptInterface
                    public boolean isPipSupported() {
                        return false;
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
}


