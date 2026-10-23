package com.homefees.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;

/**
 * هوم فيز — غلاف WebView يشير إلى خادم HomeFees (محلي أو عبر الإنترنت).
 * عند أول تشغيل يطلب عنوان الخادم ويحفظه؛ زر الرجوع من الصفحة الرئيسية يعيد السؤال لتغييره.
 */
public class MainActivity extends Activity {

    private WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("homefees", MODE_PRIVATE);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        web.setWebViewClient(new WebViewClient());
        setContentView(web);

        String url = prefs.getString("server_url", "");
        if (url.isEmpty()) askUrl(); else web.loadUrl(url);
    }

    private void askUrl() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(60, 60, 60, 20);

        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("مثال: https://xxxx.trycloudflare.com");
        box.addView(input);

        new AlertDialog.Builder(this)
                .setTitle("عنوان خادم هوم فيز")
                .setMessage("اكتب رابط الخادم الذي يعمل عليه التطبيق (الرابط العام أو محلي).")
                .setView(box)
                .setCancelable(false)
                .setPositiveButton("اتصال", (d, w) -> {
                    String u = input.getText().toString().trim();
                    if (u.isEmpty()) { askUrl(); return; }
                    if (!u.startsWith("http")) u = "http://" + u;
                    while (u.endsWith("/")) u = u.substring(0, u.length() - 1);
                    prefs.edit().putString("server_url", u).apply();
                    web.loadUrl(u);
                })
                .show();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (web.canGoBack()) {
                web.goBack();
                return true;
            }
            // من الصفحة الرئيسية: فرصة لتغيير عنوان الخادم
            askUrl();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
