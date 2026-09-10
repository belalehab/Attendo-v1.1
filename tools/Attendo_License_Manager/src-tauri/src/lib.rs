use std::fs::OpenOptions;
use std::io::Write;

#[tauri::command]
fn save_license_data(
    name: String,
    department: String,
    hw_id: String,
    plan: String,
    duration: String,
    activation_date: String,
    expiration_date: String,
) -> Result<(), String> {
    let user_profile = std::env::var("USERPROFILE").map_err(|e| e.to_string())?;
    let path = format!("{}\\Desktop\\Attendo_Master_Licenses.csv", user_profile);
    
    let file_exists = std::path::Path::new(&path).exists();
    
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
        
    if !file_exists {
        // Write CSV header
        writeln!(file, "Name,Department,Hardware ID,Plan,Duration,Activation Date,Expiration Date")
            .map_err(|e| e.to_string())?;
    }
    
    writeln!(
        file,
        "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"",
        name.replace("\"", "\"\""),
        department.replace("\"", "\"\""),
        hw_id.replace("\"", "\"\""),
        plan.replace("\"", "\"\""),
        duration.replace("\"", "\"\""),
        activation_date,
        expiration_date
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_license_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
