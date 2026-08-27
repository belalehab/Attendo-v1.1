use axum::{routing::{get, post}, Router, Json, extract::State, response::Html};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
struct AppState {
    app_handle: AppHandle,
}

#[derive(Deserialize)]
struct ScanPayload {
    data: String,
}

#[derive(Serialize)]
struct ScanResponse {
    success: bool,
    message: String,
}

const SCANNER_HTML: &str = r##"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Attendo Scanner</title>
    <script src="/html5-qrcode.min.js" type="text/javascript"></script>
    <style>
      body { background-color: #0f172a; color: white; margin: 0; font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; padding: 24px; box-sizing: border-box; overscroll-behavior: none; }
      .text-center { text-align: center; }
      .mb-6 { margin-bottom: 24px; }
      .mt-2 { margin-top: 8px; }
      h1 { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; color: #2dd4bf; margin: 0; letter-spacing: -0.025em; }
      p { font-size: 0.875rem; line-height: 1.25rem; color: #94a3b8; }
      .text-red { color: #f87171 !important; font-weight: 700; }
      .flex-grow { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; }
      #reader-container { width: 100%; max-width: 400px; margin: 0 auto; position: relative; }
      #reader { width: 100%; border-radius: 16px; overflow: hidden; border: 3px solid #14b8a6; box-shadow: 0 0 20px rgba(20, 184, 166, 0.2); background: rgba(0,0,0,0.5); }
      #reader video { object-fit: cover; }
      #reader__dashboard_section_csr span { display: none !important; }
      #start-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
      .btn { background-color: #14b8a6; color: #0f172a; font-weight: 900; font-size: 1.25rem; padding: 24px 32px; border-radius: 16px; border: none; box-shadow: 0 0 30px rgba(20,184,166,0.5); cursor: pointer; transition: transform 0.1s; }
      .btn:active { transform: scale(0.95); }
      #scan-toast { position: absolute; bottom: -20px; left: 0; right: 0; padding: 16px; background-color: #14b8a6; border-radius: 12px; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); transform: translateY(50px); opacity: 0; transition: all 0.3s; pointer-events: none; }
      #scan-toast h2 { color: #0f172a; font-weight: 900; font-size: 1.25rem; margin: 0; }
    </style>
</head>
<body>
    <div id="start-overlay">
        <button id="unlock-btn" class="btn">TAP TO START SCANNER</button>
        <p style="color: rgba(45, 212, 191, 0.6); margin-top: 24px;">Unlocks Camera, Audio & Haptics</p>
    </div>
    <div class="text-center mb-6 mt-2">
        <h1>Attendo Scanner</h1>
        <p id="status">Waiting to start...</p>
    </div>
    <div class="flex-grow">
        <div id="reader-container">
            <div id="reader"></div>
            <div id="scan-toast"><h2>✅ SCAN SUCCESS</h2></div>
        </div>
    </div>
    <script>
        const html5QrCode = new Html5Qrcode("reader");
        const statusEl = document.getElementById('status');
        const readerEl = document.getElementById('reader');
        const scanToast = document.getElementById('scan-toast');
        const config = { fps: 15, qrbox: { width: 250, height: 250 } };
        const recentScans = new Map();
        let audioCtx = null;

        function initHardwareAndStart() {
            document.getElementById('start-overlay').style.display = 'none';
            statusEl.innerText = "Align QR code in the frame";
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                osc.frequency.value = 0;
                osc.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.01);
            } catch(e) {}
            html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
                .catch(err => {
                    statusEl.innerText = "Please allow camera access.";
                    statusEl.className = "text-red";
                });
        }

        function playSuccessBeep() {
            if (!audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
                osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.1);
            } catch(e) {}
        }

        function showToast() {
            readerEl.style.borderColor = "#22c55e"; 
            scanToast.style.opacity = "1";
            scanToast.style.transform = "translate-y-0";
            setTimeout(() => {
                readerEl.style.borderColor = "#14b8a6"; 
                scanToast.style.opacity = "0";
                scanToast.style.transform = "translate-y-50px";
            }, 1500);
        }

        function onScanSuccess(decodedText) {
            const now = Date.now();
            if (recentScans.has(decodedText) && (now - recentScans.get(decodedText) < 3000)) return; 
            recentScans.set(decodedText, now);
            if (navigator.vibrate) navigator.vibrate([150, 50, 150]);
            playSuccessBeep();
            showToast();
            fetch('/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: decodedText })
            }).catch(error => {
                statusEl.innerText = "Network Error: Check Hotspot";
                statusEl.className = "text-red";
            });
        }
        document.getElementById('unlock-btn').addEventListener('click', initHardwareAndStart);
    </script>
</body>
</html>
"##;

async fn handle_scan(
    State(state): State<AppState>,
    Json(payload): Json<ScanPayload>,
) -> Json<ScanResponse> {
    match state.app_handle.emit("student-scanned", payload.data) {
        Ok(_) => Json(ScanResponse {
            success: true,
            message: "Scan received".into(),
        }),
        Err(_) => Json(ScanResponse {
            success: false,
            message: "Failed to emit to frontend".into(),
        }),
    }
}

async fn serve_html() -> Html<&'static str> {
    Html(SCANNER_HTML)
}

const HTML5_QRCODE_JS: &str = include_str!("html5-qrcode.min.js");

async fn serve_js() -> impl axum::response::IntoResponse {
    ([(axum::http::header::CONTENT_TYPE, "application/javascript")], HTML5_QRCODE_JS)
}

pub async fn run_server(app_handle: AppHandle) {
    let state = AppState { app_handle };
    
    let app = Router::new()
        .route("/", get(serve_html))
        .route("/html5-qrcode.min.js", get(serve_js))
        .route("/scan", post(handle_scan))
        .with_state(state);

    let subject_alt_names = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    let cert = rcgen::generate_simple_self_signed(subject_alt_names).unwrap();
    let cert_pem = cert.cert.pem();
    let key_pem = cert.signing_key.serialize_pem();

    let config = axum_server::tls_rustls::RustlsConfig::from_pem(
        cert_pem.into_bytes(),
        key_pem.into_bytes(),
    )
    .await
    .unwrap();

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Mobile scanner secure server listening on https://{}", addr);
    
    axum_server::bind_rustls(addr, config)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
