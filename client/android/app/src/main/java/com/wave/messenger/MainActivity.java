package com.wave.messenger;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View decor = getWindow().getDecorView();
        WebView webView = this.bridge.getWebView();
        webView.setBackgroundColor(Color.parseColor("#0e1621"));

        // Resizing/margining the WebView itself turned out to be unreliable
        // inside Capacitor's container. Instead, read the real system bar
        // sizes natively and hand them to the page as plain CSS variables,
        // then let our own CSS use them as padding. This can't be silently
        // swallowed by any container layout logic.
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float density = getResources().getDisplayMetrics().density;
            int top = Math.round(bars.top / density);
            int right = Math.round(bars.right / density);
            int bottom = Math.round(bars.bottom / density);
            int left = Math.round(bars.left / density);

            String script = String.format(
                Locale.US,
                "document.documentElement.style.setProperty('--native-inset-top','%dpx');" +
                "document.documentElement.style.setProperty('--native-inset-right','%dpx');" +
                "document.documentElement.style.setProperty('--native-inset-bottom','%dpx');" +
                "document.documentElement.style.setProperty('--native-inset-left','%dpx');",
                top, right, bottom, left
            );
            webView.post(() -> webView.evaluateJavascript(script, null));

            return insets;
        });
    }
}
