package com.tommiconlai.proxodon;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // edge-to-edge anche sotto Android 15: le barre di sistema le gestisce SystemBars (insetsHandling native).
        // Dopo super: BridgeActivity imposta prima il tema senza barra del titolo, chiamarlo prima crea la decor col tema di avvio
        EdgeToEdge.enable(this);
    }
}
