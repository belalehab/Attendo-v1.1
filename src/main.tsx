import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initTauriApi } from './tauriApi'

initTauriApi().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}).catch((err) => {
  console.error("Failed to init Tauri API", err);
  document.getElementById('root')!.innerHTML = `<div style="color:red; padding: 20px;">Failed to initialize Tauri API: ${err}</div>`;
})
