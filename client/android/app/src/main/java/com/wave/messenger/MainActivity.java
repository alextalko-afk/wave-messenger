package com.wave.messenger;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View webView = this.bridge.getWebView();
        webView.setBackgroundColor(Color.parseColor("#0e1621"));

        // WebView ignores setPadding() for its internal CSS viewport sizing
        // (Chromium measures the view's raw width/height, not its padded
        // content box), so a padding-based fix never actually shrinks the
        // visible 100vh area. Using layout margins instead forces a real
        // re-measure/re-layout of the WebView, which does shrink it.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            ViewGroup.LayoutParams lp = v.getLayoutParams();
            if (lp instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) lp;
                params.leftMargin = bars.left;
                params.topMargin = bars.top;
                params.rightMargin = bars.right;
                params.bottomMargin = bars.bottom;
                v.setLayoutParams(params);
            }
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
