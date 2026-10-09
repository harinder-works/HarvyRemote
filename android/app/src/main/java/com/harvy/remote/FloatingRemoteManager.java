package com.harvy.remote;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
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
    private boolean isFullMode = true;

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

        // Restore saved device credentials & mode preferences
        try {
            SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            this.currentBrand = sp.getString("brand", this.currentBrand);
            this.currentIp = sp.getString("ip", this.currentIp);
            this.currentPort = sp.getInt("port", this.currentPort);
            this.currentDeviceName = sp.getString("name", this.currentDeviceName);
            this.isFullMode = sp.getBoolean("is_full_mode", true);
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
            try {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + activity.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(fallback);
                } catch (Exception ignored) {}
            }
        }
    }

    public void openAppDetailsSettings() {
        if (activity != null) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    public synchronized void showFloatingRemote() {
        if (activity == null) return;

        if (!canDrawOverlays()) {
            requestOverlayPermission();
            return;
        }

        if (isShowing && floatingView != null) {
            // Already showing, send Activity to background so user can see & use other apps
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

                int savedX = dpToPx(16);
                int savedY = dpToPx(80);
                try {
                    SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    savedX = sp.getInt("pos_x", savedX);
                    savedY = sp.getInt("pos_y", savedY);
                } catch (Exception ignored) {}

                windowParams = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT
                );

                windowParams.gravity = Gravity.TOP | Gravity.START;
                windowParams.x = savedX;
                windowParams.y = savedY;

                floatingView = createFloatingView();
                windowManager.addView(floatingView, windowParams);
                isShowing = true;

                // Move Activity to back so user sees their wallpaper and can use other apps underneath
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

    public synchronized void toggleMode() {
        isFullMode = !isFullMode;
        try {
            if (activity != null) {
                SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                sp.edit().putBoolean("is_full_mode", isFullMode).apply();
            }
        } catch (Exception ignored) {}

        if (activity != null && isShowing && windowManager != null) {
            activity.runOnUiThread(() -> {
                try {
                    if (floatingView != null) {
                        windowManager.removeView(floatingView);
                    }
                    floatingView = createFloatingView();
                    windowManager.addView(floatingView, windowParams);
                } catch (Exception ignored) {}
            });
        }
    }

    public boolean isFloatingShowing() {
        return isShowing;
    }

    private View createFloatingView() {
        Context ctx = activity.getApplicationContext();

        int cardWidthDp = isFullMode ? 244 : 208;
        LinearLayout card = new LinearLayout(ctx);
        card.setOrientation(LinearLayout.VERTICAL);
        int pad = dpToPx(8);
        card.setPadding(pad, dpToPx(6), pad, pad);
        card.setLayoutParams(new LinearLayout.LayoutParams(dpToPx(cardWidthDp), LinearLayout.LayoutParams.WRAP_CONTENT));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#FAFBFD"));
        bg.setCornerRadius(dpToPx(24));
        bg.setStroke(dpToPx(1.5f), Color.parseColor("#CBD5E1"));
        card.setBackground(bg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setElevation(dpToPx(12));
        }

        // Setup Drag Handling
        View.OnTouchListener dragListener = new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isDragging = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = windowParams.x;
                        initialY = windowParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isDragging = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
                            isDragging = true;
                        }
                        windowParams.x = initialX + dx;
                        windowParams.y = initialY + dy;
                        if (windowManager != null && floatingView != null) {
                            try {
                                windowManager.updateViewLayout(floatingView, windowParams);
                            } catch (Exception ignored) {}
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (isDragging && activity != null) {
                            try {
                                SharedPreferences sp = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                                sp.edit().putInt("pos_x", windowParams.x).putInt("pos_y", windowParams.y).apply();
                            } catch (Exception ignored) {}
                        }
                        return true;
                }
                return false;
            }
        };

        // Top drag indicator bar
        LinearLayout gripBar = new LinearLayout(ctx);
        gripBar.setOrientation(LinearLayout.HORIZONTAL);
        gripBar.setGravity(Gravity.CENTER);
        gripBar.setPadding(0, 0, 0, dpToPx(3));

        View pill = new View(ctx);
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setColor(Color.parseColor("#94A3B8"));
        pillBg.setCornerRadius(dpToPx(2));
        pill.setBackground(pillBg);
        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(dpToPx(28), dpToPx(3.5f));
        pill.setLayoutParams(pillLp);
        gripBar.addView(pill);
        gripBar.setOnTouchListener(dragListener);
        card.addView(gripBar);

        // Header Row: TV name status dot, Mode Toggle, Close
        LinearLayout header = new LinearLayout(ctx);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dpToPx(2), 0, dpToPx(2), dpToPx(4));

        View dot = new View(ctx);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setColor(Color.parseColor("#10B981"));
        dotBg.setShape(GradientDrawable.OVAL);
        dot.setBackground(dotBg);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dpToPx(7), dpToPx(7));
        dotLp.setMargins(0, 0, dpToPx(4), 0);
        dot.setLayoutParams(dotLp);
        header.addView(dot);

        TextView title = new TextView(ctx);
        title.setId(101);
        title.setText(currentDeviceName);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, isFullMode ? 11 : 9.5f);
        title.setTextColor(Color.parseColor("#1E293B"));
        title.setSingleLine(true);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        title.setLayoutParams(titleLp);
        title.setOnTouchListener(dragListener);
        header.addView(title);

        // Mode switch button: switches between Full Remote and Mini Remote
        Button btnToggle = createIconButton(ctx, isFullMode ? "🗕 Mini" : "⛶ Full", Color.parseColor("#475569"), isFullMode ? dpToPx(48) : dpToPx(44));
        btnToggle.setOnClickListener(v -> {
            vibrateTap(ctx);
            toggleMode();
        });
        header.addView(btnToggle);

        // Close Button
        Button btnClose = createIconButton(ctx, "✕", Color.parseColor("#475569"), dpToPx(24));
        btnClose.setOnClickListener(v -> {
            vibrateTap(ctx);
            hideFloatingRemote();
        });
        header.addView(btnClose);

        card.addView(header);

        if (isFullMode) {
            // FULL REMOTE MODE
            // 1. Hardware Row: Power, USB Media, Mute
            LinearLayout hwRow = new LinearLayout(ctx);
            hwRow.setOrientation(LinearLayout.HORIZONTAL);
            hwRow.setWeightSum(3.0f);
            hwRow.setPadding(0, 0, 0, dpToPx(4));

            Button btnPower = createActionButton(ctx, "⏻", 13, Color.parseColor("#0F172A"));
            btnPower.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("POWER");
            });
            hwRow.addView(btnPower);

            Button btnUsb = createActionButton(ctx, "🖴 USB", 10.5f, Color.parseColor("#0F172A"));
            btnUsb.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("USB_MEDIA");
            });
            hwRow.addView(btnUsb);

            Button btnMute = createActionButton(ctx, "🔇", 13, Color.parseColor("#0F172A"));
            btnMute.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("MUTE");
            });
            hwRow.addView(btnMute);

            card.addView(hwRow);

            // 2. SEPARATED DIRECTIONAL CONTROLS (Standalone independent buttons)
            LinearLayout dpadContainer = new LinearLayout(ctx);
            dpadContainer.setOrientation(LinearLayout.VERTICAL);
            dpadContainer.setGravity(Gravity.CENTER_HORIZONTAL);
            dpadContainer.setPadding(0, dpToPx(2), 0, dpToPx(3));

            // Up Button
            Button btnUp = createDirectionalButton(ctx, "▲");
            btnUp.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_UP");
            });
            dpadContainer.addView(btnUp);

            // Middle Row: Left, Center OK, Right
            LinearLayout midRow = new LinearLayout(ctx);
            midRow.setOrientation(LinearLayout.HORIZONTAL);
            midRow.setGravity(Gravity.CENTER_VERTICAL);
            midRow.setPadding(0, dpToPx(3), 0, dpToPx(3));

            Button btnLeft = createDirectionalButton(ctx, "◀");
            btnLeft.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_LEFT");
            });
            midRow.addView(btnLeft);

            Button btnOk = createOkButton(ctx);
            btnOk.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("SELECT");
            });
            midRow.addView(btnOk);

            Button btnRight = createDirectionalButton(ctx, "▶");
            btnRight.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_RIGHT");
            });
            midRow.addView(btnRight);

            dpadContainer.addView(midRow);

            // Down Button
            Button btnDown = createDirectionalButton(ctx, "▼");
            btnDown.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_DOWN");
            });
            dpadContainer.addView(btnDown);

            card.addView(dpadContainer);

            // 3. Navigation Row: Back & Home
            LinearLayout navRow = new LinearLayout(ctx);
            navRow.setOrientation(LinearLayout.HORIZONTAL);
            navRow.setWeightSum(2.0f);
            navRow.setPadding(0, 0, 0, dpToPx(3));

            Button btnBack = createActionButton(ctx, "⮌ Back", 10.5f, Color.parseColor("#1E293B"));
            btnBack.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("BACK");
            });
            navRow.addView(btnBack);

            Button btnHome = createActionButton(ctx, "⌂ Home", 10.5f, Color.parseColor("#1E293B"));
            btnHome.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("HOME");
            });
            navRow.addView(btnHome);

            card.addView(navRow);

            // 4. Volume Row: Vol − & Vol +
            LinearLayout volRow = new LinearLayout(ctx);
            volRow.setOrientation(LinearLayout.HORIZONTAL);
            volRow.setWeightSum(2.0f);
            volRow.setPadding(0, 0, 0, dpToPx(4));

            Button btnVolDown = createActionButton(ctx, "−  VOL", 10.5f, Color.parseColor("#1E293B"));
            btnVolDown.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("VOLUME_DOWN");
            });
            volRow.addView(btnVolDown);

            Button btnVolUp = createActionButton(ctx, "VOL  +", 10.5f, Color.parseColor("#1E293B"));
            btnVolUp.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("VOLUME_UP");
            });
            volRow.addView(btnVolUp);

            card.addView(volRow);

            // 5. Six Streaming App Shortcuts (2 columns x 3 rows)
            LinearLayout appRow1 = createStreamingAppRow(ctx, "YouTube", Color.parseColor("#DC2626"), "youtube", "Netflix", Color.parseColor("#E50914"), "netflix");
            card.addView(appRow1);

            LinearLayout appRow2 = createStreamingAppRow(ctx, "Hotstar", Color.parseColor("#1D4ED8"), "hotstar", "Prime Video", Color.parseColor("#0284C7"), "prime");
            card.addView(appRow2);

            LinearLayout appRow3 = createStreamingAppRow(ctx, "JioCinema", Color.parseColor("#D946EF"), "jiocinema", "Sony LIV", Color.parseColor("#2563EB"), "sonyliv");
            card.addView(appRow3);

        } else {
            // MINI REMOTE MODE (Compact, balanced & complete)
            // 1. Hardware Row: Power, Input, Mute
            LinearLayout hwRow = new LinearLayout(ctx);
            hwRow.setOrientation(LinearLayout.HORIZONTAL);
            hwRow.setWeightSum(3.0f);
            hwRow.setPadding(0, 0, 0, dpToPx(3));

            Button btnPower = createActionButton(ctx, "⏻", 13, Color.parseColor("#0F172A"));
            btnPower.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("POWER");
            });
            hwRow.addView(btnPower);

            Button btnInput = createActionButton(ctx, "📥 Input", 10.5f, Color.parseColor("#0F172A"));
            btnInput.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("TV_INPUT");
            });
            hwRow.addView(btnInput);

            Button btnMute = createActionButton(ctx, "🔇", 13, Color.parseColor("#0F172A"));
            btnMute.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("MUTE");
            });
            hwRow.addView(btnMute);

            card.addView(hwRow);

            // 2. Separated D-Pad (Up, Left, Center OK, Right, Down)
            LinearLayout dpadContainer = new LinearLayout(ctx);
            dpadContainer.setOrientation(LinearLayout.VERTICAL);
            dpadContainer.setGravity(Gravity.CENTER_HORIZONTAL);
            dpadContainer.setPadding(0, dpToPx(2), 0, dpToPx(2));

            Button btnUp = createDirectionalButton(ctx, "▲");
            btnUp.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_UP");
            });
            dpadContainer.addView(btnUp);

            LinearLayout midRow = new LinearLayout(ctx);
            midRow.setOrientation(LinearLayout.HORIZONTAL);
            midRow.setGravity(Gravity.CENTER_VERTICAL);
            midRow.setPadding(0, dpToPx(2), 0, dpToPx(2));

            Button btnLeft = createDirectionalButton(ctx, "◀");
            btnLeft.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_LEFT");
            });
            midRow.addView(btnLeft);

            Button btnOk = createOkButton(ctx);
            btnOk.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("SELECT");
            });
            midRow.addView(btnOk);

            Button btnRight = createDirectionalButton(ctx, "▶");
            btnRight.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_RIGHT");
            });
            midRow.addView(btnRight);

            dpadContainer.addView(midRow);

            Button btnDown = createDirectionalButton(ctx, "▼");
            btnDown.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("DPAD_DOWN");
            });
            dpadContainer.addView(btnDown);

            card.addView(dpadContainer);

            // 3. Navigation Row: Back & Home
            LinearLayout navRow = new LinearLayout(ctx);
            navRow.setOrientation(LinearLayout.HORIZONTAL);
            navRow.setWeightSum(2.0f);
            navRow.setPadding(0, 0, 0, dpToPx(3));

            Button btnBack = createActionButton(ctx, "⮌ Back", 10.5f, Color.parseColor("#1E293B"));
            btnBack.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("BACK");
            });
            navRow.addView(btnBack);

            Button btnHome = createActionButton(ctx, "⌂ Home", 10.5f, Color.parseColor("#1E293B"));
            btnHome.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("HOME");
            });
            navRow.addView(btnHome);

            card.addView(navRow);

            // 4. Volume Row: Vol − & Vol +
            LinearLayout volRow = new LinearLayout(ctx);
            volRow.setOrientation(LinearLayout.HORIZONTAL);
            volRow.setWeightSum(2.0f);
            volRow.setPadding(0, 0, 0, dpToPx(3));

            Button btnVolDown = createActionButton(ctx, "−  VOL", 10.5f, Color.parseColor("#1E293B"));
            btnVolDown.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("VOLUME_DOWN");
            });
            volRow.addView(btnVolDown);

            Button btnVolUp = createActionButton(ctx, "VOL  +", 10.5f, Color.parseColor("#1E293B"));
            btnVolUp.setOnClickListener(v -> {
                vibrateTap(ctx);
                sendAction("VOLUME_UP");
            });
            volRow.addView(btnVolUp);

            card.addView(volRow);

            // 5. Four Streaming App Shortcuts (YouTube, Netflix, Hotstar, Prime)
            LinearLayout appRow1 = createStreamingAppRow(ctx, "YouTube", Color.parseColor("#DC2626"), "youtube", "Netflix", Color.parseColor("#E50914"), "netflix");
            card.addView(appRow1);

            LinearLayout appRow2 = createStreamingAppRow(ctx, "Hotstar", Color.parseColor("#1D4ED8"), "hotstar", "Prime Video", Color.parseColor("#0284C7"), "prime");
            card.addView(appRow2);
        }

        return card;
    }

    private Button createDirectionalButton(Context ctx, String text) {
        Button b = new Button(ctx);
        b.setText(text);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        b.setTextColor(Color.parseColor("#1E293B"));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E2E8F0"));
        bg.setCornerRadius(dpToPx(12));
        bg.setStroke(dpToPx(1), Color.parseColor("#CBD5E1"));
        b.setBackground(bg);

        int w = isFullMode ? dpToPx(70) : dpToPx(54);
        int h = isFullMode ? dpToPx(36) : dpToPx(34);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(w, h);
        lp.setMargins(dpToPx(1.5f), dpToPx(1), dpToPx(1.5f), dpToPx(1));
        b.setLayoutParams(lp);
        return b;
    }

    private Button createOkButton(Context ctx) {
        Button b = new Button(ctx);
        b.setText("OK");
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        b.setTextColor(Color.parseColor("#0F172A"));
        b.setAllCaps(false);

        GradientDrawable bg = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{ Color.parseColor("#FFFFFF"), Color.parseColor("#E2E8F0") }
        );
        bg.setCornerRadius(dpToPx(12));
        bg.setStroke(dpToPx(1.2f), Color.parseColor("#94A3B8"));
        b.setBackground(bg);

        int w = isFullMode ? dpToPx(70) : dpToPx(44);
        int h = isFullMode ? dpToPx(36) : dpToPx(32);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(w, h);
        lp.setMargins(dpToPx(1.5f), dpToPx(1), dpToPx(1.5f), dpToPx(1));
        b.setLayoutParams(lp);
        return b;
    }

    private Button createActionButton(Context ctx, String text, float textSizeSp, int textColor) {
        Button b = new Button(ctx);
        b.setText(text);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp);
        b.setTextColor(textColor);
        b.setAllCaps(false);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E2E8F0"));
        bg.setCornerRadius(dpToPx(12));
        bg.setStroke(dpToPx(1), Color.parseColor("#CBD5E1"));
        b.setBackground(bg);

        int h = isFullMode ? dpToPx(35) : dpToPx(32);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, h, 1.0f);
        lp.setMargins(dpToPx(1.5f), dpToPx(1), dpToPx(1.5f), dpToPx(1));
        b.setLayoutParams(lp);
        return b;
    }

    private Button createIconButton(Context ctx, String text, int color, int widthPx) {
        Button b = new Button(ctx);
        b.setText(text);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9.5f);
        b.setTextColor(color);
        b.setAllCaps(false);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E2E8F0"));
        bg.setCornerRadius(dpToPx(8));
        bg.setStroke(dpToPx(0.8f), Color.parseColor("#CBD5E1"));
        b.setBackground(bg);
        b.setPadding(dpToPx(4), 0, dpToPx(4), 0);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(widthPx, dpToPx(24));
        lp.setMargins(dpToPx(2), 0, 0, 0);
        b.setLayoutParams(lp);
        return b;
    }

    private LinearLayout createStreamingAppRow(Context ctx, String app1Name, int app1Color, String app1Slug, String app2Name, int app2Color, String app2Slug) {
        LinearLayout row = new LinearLayout(ctx);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setWeightSum(2.0f);
        row.setPadding(0, 0, 0, dpToPx(2.5f));

        Button b1 = createStreamingAppButton(ctx, app1Name, app1Color, app1Slug);
        row.addView(b1);

        Button b2 = createStreamingAppButton(ctx, app2Name, app2Color, app2Slug);
        row.addView(b2);

        return row;
    }

    private Button createStreamingAppButton(Context ctx, String appName, int brandColor, String appSlug) {
        Button b = new Button(ctx);
        b.setText(appName);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        b.setTextColor(Color.parseColor("#0F172A"));
        b.setAllCaps(false);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#FFFFFF"));
        bg.setCornerRadius(dpToPx(11));
        bg.setStroke(dpToPx(1), Color.parseColor("#CBD5E1"));
        b.setBackground(bg);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dpToPx(34), 1.0f);
        lp.setMargins(dpToPx(1.5f), 0, dpToPx(1.5f), 0);
        b.setLayoutParams(lp);

        b.setOnClickListener(v -> {
            vibrateTap(ctx);
            if (tvManager != null) {
                tvManager.launchApp(currentBrand, currentIp, currentPort, appSlug);
            }
        });
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
