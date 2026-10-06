package com.harvy.remote;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class FloatingRemoteManager {

    private static FloatingRemoteManager instance;
    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams windowParams;
    private NativeTVManager tvManager;
    private Activity activity;
    private boolean isShowing = false;

    private String currentBrand = "google_tv";
    private String currentIp = "192.168.1.105";
    private int currentPort = 6467;
    private String currentDeviceName = "Smart TV";

    private static final String PREFS_NAME = "floating_remote_prefs";

    public static synchronized FloatingRemoteManager getInstance() {
        if (instance == null) {
            instance = new FloatingRemoteManager();
        }
        return instance;
    }

    public void init(Activity activity, NativeTVManager tvManager) {
        this.activity = activity;
        this.tvManager = tvManager;
        this.windowManager = (WindowManager) activity.getApplicationContext().getSystemService(Context.WINDOW_SERVICE);

        // Restore saved device credentials if available
        try {
            SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            this.currentBrand = sp.getString("brand", this.currentBrand);
            this.currentIp = sp.getString("ip", this.currentIp);
            this.currentPort = sp.getInt("port", this.currentPort);
            this.currentDeviceName = sp.getString("name", this.currentDeviceName);
        } catch (Exception ignored) {}
    }

    public void updateDeviceInfo(String brand, String ip, int port, String name) {
        if (brand != null && !brand.isEmpty()) this.currentBrand = brand;
        if (ip != null && !ip.isEmpty()) this.currentIp = ip;
        if (port > 0) this.currentPort = port;
        if (name != null && !name.isEmpty()) this.currentDeviceName = name;

        // Persist to SharedPreferences
        try {
            if (activity != null) {
                SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                sp.edit()
                    .putString("brand", this.currentBrand)
                    .putString("ip", this.currentIp)
                    .putInt("port", this.currentPort)
                    .putString("name", this.currentDeviceName)
                    .apply();
            }
        } catch (Exception ignored) {}

        if (floatingView != null && activity != null) {
            activity.runOnUiThread(() -> {
                TextView titleView = floatingView.findViewById(101);
                if (titleView != null) {
                    titleView.setText(currentDeviceName);
                }
            });
        }
    }

    public boolean canDrawOverlays() {
        if (activity == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(activity);
        }
        return true;
    }

    public void requestOverlayPermission() {
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(activity)) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + activity.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
        }
    }

    public synchronized void showFloatingRemote() {
        if (activity == null) return;

        if (!canDrawOverlays()) {
            requestOverlayPermission();
            return;
        }

        if (isShowing && floatingView != null) {
            // Already showing, just push Activity to background so user sees home screen & other apps
            activity.runOnUiThread(() -> {
                try {
                    activity.moveTaskToBack(true);
                } catch (Exception ignored) {}
            });
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                int layoutType;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
                } else {
                    layoutType = WindowManager.LayoutParams.TYPE_PHONE;
                }

                windowParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
                );

                windowParams.gravity = Gravity.TOP | Gravity.START;
                windowParams.x = dpToPx(16);
                windowParams.y = dpToPx(120);

                floatingView = createFloatingView();
                windowManager.addView(floatingView, windowParams);
                isShowing = true;

                // Move Activity to back so user's home screen & other apps become visible and interactive
                activity.moveTaskToBack(true);
            } catch (Exception ignored) {}
        });
    }

    public synchronized void hideFloatingRemote() {
        if (!isShowing || floatingView == null || windowManager == null) return;
        activity.runOnUiThread(() -> {
            try {
                windowManager.removeView(floatingView);
            } catch (Exception ignored) {
            } finally {
                floatingView = null;
                isShowing = false;
            }
        });
    }

    public boolean isFloatingShowing() {
        return isShowing;
    }

    private View createFloatingView() {
        Context ctx = activity.getApplicationContext();

        // Container card: 148dp wide compact pebble
        LinearLayout card = new LinearLayout(ctx);
        card.setOrientation(LinearLayout.VERTICAL);
        int pad = dpToPx(8);
        card.setPadding(pad, dpToPx(6), pad, pad);
        card.setLayoutParams(new LinearLayout.LayoutParams(dpToPx(148), LinearLayout.LayoutParams.WRAP_CONTENT));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#FAFBFD"));
        bg.setCornerRadius(dpToPx(22));
        bg.setStroke(dpToPx(1.5f), Color.parseColor("#CFD4DC"));
        card.setBackground(bg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setElevation(dpToPx(8));
        }

        // Top drag indicator bar
        LinearLayout gripBar = new LinearLayout(ctx);
        gripBar.setOrientation(LinearLayout.HORIZONTAL);
        gripBar.setGravity(Gravity.CENTER);
        gripBar.setPadding(0, 0, 0, dpToPx(4));

        View pill = new View(ctx);
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(Color.parseColor("#94A3B8"));
        pillBg.setCornerRadius(dpToPx(2));
        pill.setBackground(pillBg);
        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(dpToPx(28), dpToPx(3.5f));
        pill.setLayoutParams(pillLp);
        gripBar.addView(pill);
        card.addView(gripBar);

        // Header Row: Drag handle & Title, Power, Expand, Close
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dpToPx(2), 0, dpToPx(2), dpToPx(6));

        TextView title = new TextView(ctx);
        title.setId(101);
        title.setText(currentDeviceName);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.5f);
        title.setTextColor(Color.parseColor("#334155"));
        title.setSingleLine(true);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        title.setLayoutParams(titleLp);
        header.addView(title);

        // Power Button
        Button btnPower = createIconButton(ctx, "⏻", Color.parseColor("#10B981"));
        btnPower.setOnClickListener(v -> {
            vibrateTap(ctx);
            sendAction("POWER");
        });
        header.addView(btnPower);

        // Expand Button (Brings full app to front)
        Button btnExpand = createIconButton(ctx, "⛶", Color.parseColor("#0284C7"));
        btnExpand.setOnClickListener(v -> {
            vibrateTap(ctx);
            hideFloatingRemote();
            Intent intent = new Intent(activity, MainActivity.class);
            intent.putExtra("LAUNCH_MODE", "EXPAND");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            activity.startActivity(intent);
        });
        header.addView(btnExpand);

        // Close Button
        Button btnClose = createIconButton(ctx, "✕", Color.parseColor("#E11D48"));
        btnClose.setOnClickListener(v -> {
            vibrateTap(ctx);
            hideFloatingRemote();
        });
        header.addView(btnClose);

        card.addView(header);

        // Center OK / Play-Pause Button
        Button btnOk = new Button(ctx);
        btnOk.setText("OK / ⏯");
        btnOk.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        btnOk.setTextColor(Color.parseColor("#0F172A"));
        btnOk.setAllCaps(false);

        GradientDrawable okBg = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{ Color.parseColor("#FFFFFF"), Color.parseColor("#E2E8F0") }
        );
        okBg.setCornerRadius(dpToPx(14));
        okBg.setStroke(dpToPx(1.2f), Color.parseColor("#CBD5E1"));
        btnOk.setBackground(okBg);

        LinearLayout.LayoutParams okLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(42)
        );
        okLp.setMargins(0, 0, 0, dpToPx(6));
        btnOk.setLayoutParams(okLp);
        btnOk.setOnClickListener(v -> {
            vibrateTap(ctx);
            sendAction("SELECT");
        });
        card.addView(btnOk);

        // Volume Row: [-] [Mute] [+]
        LinearLayout volRow = new LinearLayout(ctx);
        volRow.setOrientation(LinearLayout.HORIZONTAL);
        volRow.setWeightSum(3.0f);

        Button btnVolDown = createActionButton(ctx, "−");
        btnVolDown.setOnClickListener(v -> {
            vibrateTap(ctx);
            sendAction("VOLUME_DOWN");
        });
        volRow.addView(btnVolDown);

        Button btnMute = createActionButton(ctx, "🔇");
        btnMute.setOnClickListener(v -> {
            vibrateTap(ctx);
            sendAction("MUTE");
        });
        volRow.addView(btnMute);

        Button btnVolUp = createActionButton(ctx, "+");
        btnVolUp.setOnClickListener(v -> {
            vibrateTap(ctx);
            sendAction("VOLUME_UP");
        });
        volRow.addView(btnVolUp);

        card.addView(volRow);

        // Setup Drag Handling on the gripBar and header
        View.OnTouchListener dragListener = new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = windowParams.x;
                        initialY = windowParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        windowParams.x = initialX + dx;
                        windowParams.y = initialY + dy;
                        if (windowManager != null && floatingView != null) {
                            try {
                                windowManager.updateViewLayout(floatingView, windowParams);
                            } catch (Exception ignored) {}
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        return true;
                }
                return false;
            }
        };

        gripBar.setOnTouchListener(dragListener);
        title.setOnTouchListener(dragListener);

        return card;
    }

    private Button createIconButton(Context ctx, String text, int color) {
        Button b = new Button(ctx);
        b.setText(text);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        b.setTextColor(color);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setPadding(0, 0, 0, 0);
        b.setMinimumWidth(dpToPx(24));
        b.setMinimumHeight(dpToPx(24));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dpToPx(24), dpToPx(24));
        lp.setMargins(dpToPx(1.5f), 0, 0, 0);
        b.setLayoutParams(lp);
        return b;
    }

    private Button createActionButton(Context ctx, String text) {
        Button b = new Button(ctx);
        b.setText(text);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        b.setTextColor(Color.parseColor("#1E293B"));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E8EDF3"));
        bg.setCornerRadius(dpToPx(12));
        bg.setStroke(dpToPx(1), Color.parseColor("#CBD5E1"));
        b.setBackground(bg);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dpToPx(38), 1.0f);
        lp.setMargins(dpToPx(1.5f), 0, dpToPx(1.5f), 0);
        b.setLayoutParams(lp);
        return b;
    }

    private void vibrateTap(Context ctx) {
        try {
            Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(18);
                }
            }
        } catch (Exception ignored) {}
    }

    private void sendAction(String action) {
        if (tvManager != null) {
            tvManager.sendAction(currentBrand, currentIp, currentPort, action);
        }
    }

    private int dpToPx(float dp) {
        if (activity == null) return (int) (dp * 2);
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            activity.getResources().getDisplayMetrics()
        );
    }
}
