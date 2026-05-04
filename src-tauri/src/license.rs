use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

const TIME_WINDOW_SECS: u64 = 600; // 10 minutes
const ACTIVATION_FILE: &str = "activation.dat";

type HmacSha256 = Hmac<Sha256>;

#[derive(serde::Serialize, serde::Deserialize)]
struct ActivationData {
    activated: bool,
    activated_at: Option<u64>,
    signature: Option<String>,
}

fn get_product_key() -> &'static str {
    "pdf-page-manager-secret-key-2026"
}

fn sign_activation_data(activated_at: u64) -> String {
    let key = get_product_key();
    let data = format!("activated:{}", activated_at);
    let mut mac = HmacSha256::new_from_slice(key.as_bytes()).expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

fn verify_activation_signature(activated_at: u64, signature: &str) -> bool {
    let expected = sign_activation_data(activated_at);
    expected == signature
}

fn get_activation_file_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("pdf-page-manager");
    fs::create_dir_all(&path).ok();
    path.push(ACTIVATION_FILE);
    path
}

fn current_time_window() -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();
    now / TIME_WINDOW_SECS
}

fn time_window_to_string(window: u64) -> String {
    let start_secs = window * TIME_WINDOW_SECS;
    let start = UNIX_EPOCH + std::time::Duration::from_secs(start_secs);
    let datetime: chrono::DateTime<chrono::Utc> = start.into();
    datetime.format("%Y-%m-%d-%H-%M").to_string()
}

pub fn verify_activation_code(code: &str) -> bool {
    let code = code.trim().to_uppercase().replace("-", "");

    // 尝试当前时间窗口和前后各1个窗口（各30分钟误差）
    let current = current_time_window();
    for window_offset in 0..=2 {
        let window = if window_offset == 0 {
            current
        } else if window_offset == 1 {
            current + 1
        } else {
            current.saturating_sub(1)
        };

        let time_str = time_window_to_string(window);
        let key = get_product_key();

        let mut mac = HmacSha256::new_from_slice(key.as_bytes()).expect("HMAC can take key of any size");
        mac.update(time_str.as_bytes());

        let result = mac.finalize();
        let bytes = result.into_bytes();

        let part1 = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) % 10000;
        let part2 = u32::from_be_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]) % 10000;
        let part3 = u32::from_be_bytes([bytes[8], bytes[9], bytes[10], bytes[11]]) % 10000;

        let expected = format!("{:04}{:04}{:04}", part1, part2, part3);
        if code == expected {
            return true;
        }
    }
    false
}

pub fn check_activation_status() -> bool {
    let path = get_activation_file_path();
    if let Ok(data) = fs::read_to_string(&path) {
        if let Ok(activation) = serde_json::from_str::<ActivationData>(&data) {
            if activation.activated {
                if let (Some(activated_at), Some(signature)) = (activation.activated_at, &activation.signature) {
                    return verify_activation_signature(activated_at, signature);
                }
                return false;
            }
        }
    }
    false
}

pub fn save_activation() -> Result<(), String> {
    let path = get_activation_file_path();
    let activated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();
    let signature = sign_activation_data(activated_at);
    let activation = ActivationData {
        activated: true,
        activated_at: Some(activated_at),
        signature: Some(signature),
    };
    let json = serde_json::to_string_pretty(&activation).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn verify_and_activate(code: String) -> Result<bool, String> {
    if verify_activation_code(&code) {
        save_activation()?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn check_activated() -> bool {
    check_activation_status()
}

