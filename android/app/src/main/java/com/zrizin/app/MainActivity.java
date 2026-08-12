package com.zrizin.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ZrizinHealthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
