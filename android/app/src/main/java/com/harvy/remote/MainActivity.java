package com.harvy.remote;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.Rational;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    private static final String ACTION_PIP_POWER = "com.harvy.remote.PIP_POWER";
    private static final String ACTION_PIP_OK = "com.harvy.remote.PIP_OK";
    private static final String ACTION_PIP_VOL_UP = "com.harvy.remote.PIP_VOL_UP";
    private static final String ACTION_PIP_VOL_DOWN = "com.harvy.remote.PIP_VOL_DOWN";

    private boolean isLaunchedFromExpand = false;
    private NativeTVManager tvManager;
    private FloatingRemoteManager floatingManager;
    private BroadcastReceiver pipReceiver;

    private String currentBrand = "google_tv";
    private String currentIp = "192.168.1.105";
    private int currentPort = 6467;

    private void handleIntent(Intent intent) {
        if (intent != null && "EXPAND".equals(intent.getStringExtra("LAUNCH_MODE"))) {
            isLaunchedFromExpand = true;
            if (floatingManager != null) {
                floatingManager.hideFloatingRemote();
            }
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

            // Transparent background so wallpaper & background apps are visible
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);

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

                tvManager = new NativeTVManager(MainActivity.this, webView);
                webView.addJavascriptInterface(tvManager, "NativeTVManager");

                floatingManager = FloatingRemoteManager.getInstance();
                floatingManager.init(MainActivity.this, tvManager);

                registerPipReceiver();

                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void enterPip() {
                        MainActivity.this.enterPip();
                    }

                    @JavascriptInterface
                    public void exitPip() {
                        runOnUiThread(() -> {
                            Intent intent = new Intent(MainActivity.this, MainActivity.class);
                            intent.setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                            startActivity(intent);
                        });
                    }

                    @JavascriptInterface
                    public boolean isPipSupported() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            return getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_PICTURE_IN_PICTURE);
                        }
                        return false;
                    }

                    @JavascriptInterface
                    public void startFloatingRemote() {
                        runOnUiThread(() -> {
                            if (floatingManager != null) {
                                if (floatingManager.canDrawOverlays()) {
                                    floatingManager.showFloatingRemote();
                                } else {
                                    floatingManager.requestOverlayPermission();
                                }
                            }
                        });
                    }

                    @JavascriptInterface
                    public void hideFloatingRemote() {
                        runOnUiThread(() -> {
                            if (floatingManager != null) {
                                floatingManager.hideFloatingRemote();
                            }
                        });
                    }

                    @JavascriptInterface
                    public boolean hasOverlayPermission() {
                        return floatingManager != null && floatingManager.canDrawOverlays();
                    }

                    @JavascriptInterface
                    public void requestOverlayPermission() {
                        runOnUiThread(() -> {
                            if (floatingManager != null) {
                                floatingManager.requestOverlayPermission();
                            }
                        });
                    }

                    @JavascriptInterface
                    public void openOverlaySettingsList() {
                        runOnUiThread(() -> {
                            if (floatingManager != null) {
                                floatingManager.openOverlaySettingsList();
                            }
                        });
                    }

                    @JavascriptInterface
                    public void openAppDetailsSettings() {
                        runOnUiThread(() -> {
                            if (floatingManager != null) {
                                floatingManager.openAppDetailsSettings();
                            }
                        });
                    }

                    @JavascriptInterface
                    public void updateFloatingDeviceInfo(String brand, String ip, int port, String name) {
                        currentBrand = brand;
                        currentIp = ip;
                        currentPort = port;
                        if (floatingManager != null) {
                            floatingManager.updateDeviceInfo(brand, ip, port, name);
                        }
                    }

                    @JavascriptInterface
                    public void setWindowMode(String mode) {
                        runOnUiThread(() -> {
                            if ("mini".equalsIgnoreCase(mode)) {
                                if (floatingManager != null && floatingManager.canDrawOverlays()) {
                                    floatingManager.showFloatingRemote();
                                }
                            } else {
                                if (floatingManager != null) {
                                    floatingManager.hideFloatingRemote();
                                }
                            }
                        });
                    }

                    @JavascriptInterface
                    public boolean isExpandMode() {
                        return isLaunchedFromExpand;
                    }

                    @JavascriptInterface
                    public void sendAction(String brand, String ip, int port, String action) {
                        currentBrand = brand;
                        currentIp = ip;
                        currentPort = port;
                        if (tvManager != null) {
                            tvManager.sendAction(brand, ip, port, action);
                        }
                    }

                    @JavascriptInterface
                    public void startScan() {
                        if (tvManager != null) tvManager.startScan();
                    }

                    @JavascriptInterface
                    public void launchApp(String brand, String ip, int port, String appSlug) {
                        currentBrand = brand;
                        currentIp = ip;
                        currentPort = port;
                        if (tvManager != null) tvManager.launchApp(brand, ip, port, appSlug);
                    }

                    @JavascriptInterface
                    public void fetchInstalledApps(String brand, String ip, int port) {
                        if (tvManager != null) tvManager.fetchInstalledApps(brand, ip, port);
                    }

                    @JavascriptInterface
                    public void pingDevice(String ip, int port) {
                        if (tvManager != null) tvManager.pingDevice(ip, port);
                    }

                    @JavascriptInterface
                    public void sendTextInput(String brand, String ip, int port, String text) {
                        if (tvManager != null) tvManager.sendTextInput(brand, ip, port, text);
                    }

                    @JavascriptInterface
                    public void startPairing(String ip) {
                        if (tvManager != null) tvManager.startPairing(ip);
                    }

                    @JavascriptInterface
                    public void submitPairingPin(String ip, String pin) {
                        if (tvManager != null) tvManager.submitPairingPin(ip, pin);
                    }

                    @JavascriptInterface
                    public String getDeviceSubnet() {
                        return tvManager != null ? tvManager.getDeviceSubnet() : "192.168.1.";
                    }

                    @JavascriptInterface
                    public void moveTaskToBack() {
                        runOnUiThread(() -> {
                            try {
                                MainActivity.this.moveTaskToBack(true);
                            } catch (Exception ignored) {}
                        });
                    }

                    @JavascriptInterface
                    public void closeApp() {
                        runOnUiThread(() -> {
                            try {
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

    public void enterPip() {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                    // Aspect ratio for compact vertical mini remote pebble (3:4)
                    Rational aspectRatio = new Rational(3, 4);
                    builder.setAspectRatio(aspectRatio);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        builder.setAutoEnterEnabled(true);
                        builder.setSeamlessResizeEnabled(true);
                    }
                    List<RemoteAction> actions = buildPipActions();
                    if (actions != null && !actions.isEmpty()) {
                        builder.setActions(actions);
                    }
                    enterPictureInPictureMode(builder.build());
                } catch (Exception e) {
                    Log.e(TAG, "enterPictureInPictureMode error", e);
                }
            }
        });
    }

    private List<RemoteAction> buildPipActions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return null;
        }
        List<RemoteAction> actions = new ArrayList<>();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        try {
            // 1. Power Action
            Intent powerIntent = new Intent(ACTION_PIP_POWER).setPackage(getPackageName());
            PendingIntent piPower = PendingIntent.getBroadcast(this, 101, powerIntent, flags);
            Icon iconPower = Icon.createWithResource(this, android.R.drawable.ic_lock_power_off);
            actions.add(new RemoteAction(iconPower, "Power", "Power", piPower));

            // 2. Play / Pause OK Action
            Intent okIntent = new Intent(ACTION_PIP_OK).setPackage(getPackageName());
            PendingIntent piOk = PendingIntent.getBroadcast(this, 102, okIntent, flags);
            Icon iconOk = Icon.createWithResource(this, android.R.drawable.ic_media_play);
            actions.add(new RemoteAction(iconOk, "OK", "Play / Pause", piOk));

            // 3. Vol Up Action
            Intent volIntent = new Intent(ACTION_PIP_VOL_UP).setPackage(getPackageName());
            PendingIntent piVol = PendingIntent.getBroadcast(this, 103, volIntent, flags);
            Icon iconVol = Icon.createWithResource(this, android.R.drawable.ic_input_add);
            actions.add(new RemoteAction(iconVol, "Vol +", "Volume Up", piVol));
        } catch (Exception e) {
            Log.w(TAG, "Error building PiP actions", e);
        }

        return actions;
    }

    private void registerPipReceiver() {
        if (pipReceiver == null) {
            pipReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null || intent.getAction() == null || tvManager == null) return;
                    String action = intent.getAction();
                    if (ACTION_PIP_POWER.equals(action)) {
                        tvManager.sendAction(currentBrand, currentIp, currentPort, "POWER");
                    } else if (ACTION_PIP_OK.equals(action)) {
                        tvManager.sendAction(currentBrand, currentIp, currentPort, "SELECT");
                    } else if (ACTION_PIP_VOL_UP.equals(action)) {
                        tvManager.sendAction(currentBrand, currentIp, currentPort, "VOLUME_UP");
                    } else if (ACTION_PIP_VOL_DOWN.equals(action)) {
                        tvManager.sendAction(currentBrand, currentIp, currentPort, "VOLUME_DOWN");
                    }
                }
            };
            IntentFilter filter = new IntentFilter();
            filter.addAction(ACTION_PIP_POWER);
            filter.addAction(ACTION_PIP_OK);
            filter.addAction(ACTION_PIP_VOL_UP);
            filter.addAction(ACTION_PIP_VOL_DOWN);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(pipReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(pipReceiver, filter);
            }
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        // If user has enabled overlay permission, show the interactive floating remote over other apps
        if (floatingManager != null && floatingManager.canDrawOverlays()) {
            floatingManager.showFloatingRemote();
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('pip-mode-changed', { detail: { isPip: " + isInPictureInPictureMode + " } }));",
                null
            );
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (floatingManager != null) {
            boolean hasPermission = floatingManager.canDrawOverlays();
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('overlay-permission-status', { detail: { granted: " + hasPermission + " } }));",
                    null
                );
            }
        }
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        return super.onTouchEvent(event);
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('android-back-pressed'));",
                null
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingManager != null) {
            try {
                floatingManager.hideFloatingRemote();
            } catch (Exception ignored) {}
        }
        if (pipReceiver != null) {
            try {
                unregisterReceiver(pipReceiver);
            } catch (Exception ignored) {}
            pipReceiver = null;
        }
    }
}
