use std::process::Command;
use sha2::{Sha256, Digest};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LicenseClaims {
    pub hwId: String,
    pub exp: usize,
}

#[cfg(target_os = "windows")]
pub async fn generate_hardware_fingerprint() -> Result<String, String> {
    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "Try {  = (Get-CimInstance Win32_BaseBoard).SerialNumber;  = (Get-CimInstance Win32_Processor).ProcessorId;  = (Get-CimInstance Win32_DiskDrive)[0].SerialNumber; Write-Output \"--\" } Catch { Write-Output 'error' }"
        ])
        .output()
        .map_err(|e| e.to_string())?;

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw == "error" || raw.is_empty() {
        return Err("Failed to generate hardware ID".into());
    }

    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

#[cfg(target_os = "android")]
pub async fn generate_hardware_fingerprint() -> Result<String, String> {
    // Return a generic device ID for Android for now
    Ok("ANDROID_MOBILE_DEVICE_001".to_string())
}

pub fn verify_license(token: &str, expected_hw_id: &str) -> Result<LicenseClaims, String> {
    let key = b"Attendo_Secure_RSA_2026_!@#_Key";
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    
    let token_data = decode::<LicenseClaims>(
        token,
        &DecodingKey::from_secret(key),
        &validation,
    ).map_err(|e| e.to_string())?;

    if token_data.claims.hwId != expected_hw_id {
        return Err("License hardware mismatch".into());
    }

    Ok(token_data.claims)
}
