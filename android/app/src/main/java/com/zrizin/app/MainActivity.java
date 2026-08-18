package com.zrizin.app;

import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    @SuppressWarnings("unchecked")
    public void onCreate(Bundle savedInstanceState) {
        // ZrizinHealth references Android 14 Health Connect classes. Do not even
        // resolve that class on older Android releases; doing so can terminate
        // the process before the Capacitor WebView has a chance to start.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            try {
                Class<?> candidate = Class.forName("com.zrizin.app.ZrizinHealthPlugin");
                if (Plugin.class.isAssignableFrom(candidate)) {
                    registerPlugin((Class<? extends Plugin>) candidate);
                }
            } catch (ClassNotFoundException error) {
                android.util.Log.e("Zrizin", "Health plugin unavailable", error);
            }
        }

        super.onCreate(savedInstanceState);
    }
}
