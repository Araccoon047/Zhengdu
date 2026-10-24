package com.zhengdu.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class NativeBridge {
    private static final String MESSAGE_CHANNEL_ID = "zhengdu_messages";
    private static final String MESSAGE_CHANNEL_NAME = "争渡消息通知";

    private final MainActivity activity;
    private final WebView webView;

    NativeBridge(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public String getAppVersion() {
        return "Zhengdu1.0";
    }

    @JavascriptInterface
    public boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public void requestAppPermissions() {
        activity.runOnUiThread(activity::requestAppPermissions);
    }

    @JavascriptInterface
    public void requestIgnoreBatteryOptimizations() {
        activity.runOnUiThread(activity::requestIgnoreBatteryOptimizations);
    }

    @JavascriptInterface
    public void setKeepAlive(boolean enabled) {
        Intent intent = new Intent(activity, KeepAliveService.class);
        if (enabled) {
            if (Build.VERSION.SDK_INT >= 26) activity.startForegroundService(intent);
            else activity.startService(intent);
        } else {
            activity.stopService(intent);
        }
    }

    @JavascriptInterface
    public void showNotification(String title, String body) {
        showMessageNotification(title, body);
    }

    @JavascriptInterface
    public boolean saveTextFile(String filename, String mimeType, String content) {
        String safeName = sanitizeFilename(filename);
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver resolver = activity.getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType == null ? "application/json" : mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/争渡备份");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (OutputStream stream = resolver.openOutputStream(uri)) {
                    if (stream == null) return false;
                    stream.write(String.valueOf(content).getBytes(StandardCharsets.UTF_8));
                    stream.flush();
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                toast("备份已保存到下载/争渡备份");
                return true;
            }

            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File directory = new File(downloads, "争渡备份");
            if (!directory.exists() && !directory.mkdirs()) return false;
            File target = new File(directory, safeName);
            try (FileOutputStream stream = new FileOutputStream(target)) {
                stream.write(String.valueOf(content).getBytes(StandardCharsets.UTF_8));
            }
            toast("备份已保存到下载/争渡备份");
            return true;
        } catch (Exception error) {
            toast("保存备份失败，请检查存储权限");
            return false;
        }
    }

    @JavascriptInterface
    public boolean createLauncherShortcut(String dataUrl, String label) {
        if (Build.VERSION.SDK_INT < 26 || dataUrl == null) return false;
        try {
            String base64 = dataUrl;
            int comma = base64.indexOf(',');
            if (comma >= 0) base64 = base64.substring(comma + 1);
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap source = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (source == null) return false;
            int maxSide = 256;
            float scale = Math.min(1f, maxSide / (float) Math.max(source.getWidth(), source.getHeight()));
            int width = Math.max(1, Math.round(source.getWidth() * scale));
            int height = Math.max(1, Math.round(source.getHeight() * scale));
            Bitmap bitmap = scale == 1f ? source : Bitmap.createScaledBitmap(source, width, height, true);

            ShortcutManager manager = (ShortcutManager) activity.getSystemService(Context.SHORTCUT_SERVICE);
            if (manager == null || !manager.isRequestPinShortcutSupported()) return false;
            String safeLabel = label == null || label.trim().isEmpty() ? "争渡" : label.trim();
            String id = "zhengdu-custom-icon-" + System.currentTimeMillis();
            Intent launchIntent = new Intent(activity, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_VIEW);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            ShortcutInfo shortcut = new ShortcutInfo.Builder(activity, id)
                    .setShortLabel(safeLabel)
                    .setLongLabel(safeLabel)
                    .setIcon(Icon.createWithBitmap(bitmap))
                    .setIntent(launchIntent)
                    .build();
            activity.runOnUiThread(() -> {
                boolean requested = manager.requestPinShortcut(shortcut, null);
                toast(requested ? "请按桌面提示添加自定义图标" : "桌面快捷方式请求失败");
            });
            return true;
        } catch (Exception error) {
            toast("创建自定义桌面图标失败");
            return false;
        }
    }

    private void showMessageNotification(String title, String body) {
        try {
            NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = new NotificationChannel(
                        MESSAGE_CHANNEL_ID,
                        MESSAGE_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("聊天、信箱、朋友圈与番茄钟提醒");
                manager.createNotificationChannel(channel);
            }
            Intent openIntent = new Intent(activity, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pendingIntent = PendingIntent.getActivity(activity, 9001, openIntent, pendingFlags);
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(activity, MESSAGE_CHANNEL_ID)
                    : new Notification.Builder(activity);
            builder.setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title == null ? "争渡" : title)
                    .setContentText(body == null ? "" : body)
                    .setStyle(new Notification.BigTextStyle().bigText(body == null ? "" : body))
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setShowWhen(true);
            manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
        } catch (Exception ignored) {
        }
    }

    private String sanitizeFilename(String filename) {
        String name = filename == null ? "zhengdu-backup.json" : filename.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|]", "-");
        return name.isEmpty() ? "zhengdu-backup.json" : name;
    }

    private void toast(String message) {
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }
}