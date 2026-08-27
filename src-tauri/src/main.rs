#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod security;
mod server;

use tauri::Manager;

#[tauri::command]
async fn get_hardware_id() -> Result<String, String> {
    security::generate_hardware_fingerprint().await
}

#[tauri::command]
async fn check_license(token: String) -> Result<bool, String> {
    let hw_id = security::generate_hardware_fingerprint().await?;
    match security::verify_license(&token, &hw_id) {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}
#[tauri::command]
fn export_backup(app: tauri::AppHandle, dest_path: String) -> Result<bool, String> {
    let config_dir = app.path().app_config_dir().unwrap().join("attendo_core.db");
    let data_dir = app.path().app_data_dir().unwrap().join("attendo_core.db");
    let db_path = if config_dir.exists() { config_dir } else { data_dir };
    
    std::fs::copy(&db_path, dest_path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn trigger_shadow_backup(app: tauri::AppHandle) -> Result<bool, String> {
    let config_dir = app.path().app_config_dir().unwrap().join("attendo_core.db");
    let data_dir = app.path().app_data_dir().unwrap().join("attendo_core.db");
    let db_path = if config_dir.exists() { config_dir } else { data_dir };
    
    let home = dirs::home_dir().unwrap_or_default();
    if home.as_os_str().is_empty() { return Ok(false); }
    
    let shadow_dir = home.join("Attendo_Backups").join("Shadow_Copies");
    if !shadow_dir.exists() {
        std::fs::create_dir_all(&shadow_dir).map_err(|e| e.to_string())?;
    }
    
    let recent = shadow_dir.join("Attendo_Backup_Recent.attdb");
    let older = shadow_dir.join("Attendo_Backup_Older.attdb");
    let oldest = shadow_dir.join("Attendo_Backup_Oldest.attdb");
    
    if oldest.exists() { std::fs::remove_file(&oldest).unwrap_or(()); }
    if older.exists() { std::fs::rename(&older, &oldest).unwrap_or(()); }
    if recent.exists() { std::fs::rename(&recent, &older).unwrap_or(()); }
    
    std::fs::copy(&db_path, &recent).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    match local_ip_address::local_ip() {
        Ok(ip) => Ok(ip.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn create_temp_backup(app: tauri::AppHandle, src_path: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !data_dir.exists() {
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    }
    let temp_name = format!("merge_temp_{}.db", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let temp_path = data_dir.join(temp_name);
    
    std::fs::copy(src_path, &temp_path).map_err(|e| e.to_string())?;
    Ok(temp_path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_temp_backup(path: String) -> Result<bool, String> {
    std::fs::remove_file(path).unwrap_or(());
    Ok(true)
}

#[tauri::command]
fn auto_shadow_export(session_name: String, pdf_bytes: Vec<u8>, excel_bytes: Vec<u8>, filename_override: Option<String>) -> Result<bool, String> {
    let desktop = dirs::desktop_dir().ok_or("No desktop dir")?;
    
    let mut workspace = "Unknown".to_string();
    if let Some(start) = session_name.find("[Grade ") {
        if let Some(end) = session_name[start..].find("]") {
            workspace = session_name[start+7..start+end].to_string();
        }
    }
    
    let parts: Vec<&str> = session_name.split(" - ").collect();
    let mut s_type = "Session".to_string();
    if parts.len() > 3 {
        s_type = parts[3].trim().to_string();
    }
    
    let shadow_dir = desktop.join("Attendo Exports").join(format!("Grade {}", workspace)).join(s_type);
    
    if !shadow_dir.exists() {
        std::fs::create_dir_all(&shadow_dir).map_err(|e| e.to_string())?;
    }
    
    let base_name = session_name.replace(&['\\', '/', ':', '*', '?', '"', '<', '>', '|'][..], "");
    let safe_name = filename_override.unwrap_or(base_name);
    
    if !pdf_bytes.is_empty() {
        std::fs::write(shadow_dir.join(format!("{}.pdf", safe_name)), pdf_bytes).map_err(|e| e.to_string())?;
    }
    if !excel_bytes.is_empty() {
        std::fs::write(shadow_dir.join(format!("{}.xlsx", safe_name)), excel_bytes).map_err(|e| e.to_string())?;
    }
    
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                server::run_server(app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_id,
            check_license,
            export_backup,
            trigger_shadow_backup,
            get_local_ip,
            create_temp_backup,
            delete_temp_backup,
            auto_shadow_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
