package com.harvy.remote;

import android.graphics.Color;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Coordinates of interactive UI bounds in screen pixels
    private final Rect interactiveBounds = new Rect();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            // Set window flags so touches outside focused areas can pass through to underlying system/apps
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setBackgroundColor(Color.TRANSPARENT);
                webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

                // Add bridge interface for JS to tell native code where the remote is located
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void updateRemoteBounds(float left, float top, float right, float bottom, float density) {
                        runOnUiThread(() -> {
                            interactiveBounds.set(
                                (int) (left * density),
                                (int) (top * density),
                                (int) (right * density),
                                (int) (bottom * density)
                            );
                        });
                    }

                    @JavascriptInterface
                    public void clearRemoteBounds() {
                        runOnUiThread(() -> {
                            interactiveBounds.setEmpty();
                        });
                    }
                }, "AndroidOverlayBridge");
            }
        } catch (Exception e) {
            // fallback
        }
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        // If interactive bounds exist and the touch is outside the remote,
        // let the window pass the touch event or do not consume it
        if (!interactiveBounds.isEmpty()) {
            int x = (int) event.getX();
            int y = (int) event.getY();
            if (!interactiveBounds.contains(x, y)) {
                // Touch is outside the remote pebble: return false so underlying apps receive it
                return false;
            }
        }
        return super.dispatchTouchEvent(event);
    }
}
