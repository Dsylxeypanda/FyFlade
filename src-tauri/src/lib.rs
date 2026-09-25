use keyring::Entry;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

mod party_audio;
use party_audio::{start_party_audio_capture, stop_party_audio_capture};

#[cfg(test)]
mod search_history_tests;

#[cfg(test)]
mod obs_dock_tests;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
use webview2_com::{
    CoTaskMemPWSTR,
    WebMessageReceivedEventHandler,
};

#[cfg(target_os = "windows")]
use windows::core::PWSTR;

// ---------------------------------------------------------
// TWITCH LOGIN
// ---------------------------------------------------------

// Keep the legacy Credential Manager service name until credentials have been
// copied and verified under a new FyFlade service name. Changing it directly
// would make existing refresh tokens appear missing and log users out.
const LEGACY_CREDENTIAL_SERVICE: &str = "ChatNest";
const TWITCH_REFRESH_TOKEN_ACCOUNT: &str = "twitch_refresh_token";
const YOUTUBE_REFRESH_TOKEN_ACCOUNT: &str = "youtube_refresh_token";
const YOUTUBE_CLIENT_SECRET_ACCOUNT: &str = "youtube_client_secret";
const KICK_REFRESH_TOKEN_ACCOUNT: &str = "kick_refresh_token";
const KICK_CLIENT_SECRET_ACCOUNT: &str = "kick_client_secret";
const KICK_WEBHOOK_PORT_NUMBER: u16 = 17172;
static KICK_WEBHOOK_PORT: OnceLock<u16> = OnceLock::new();
static KICK_VIEWER_WINDOWS: OnceLock<Mutex<HashMap<String, String>>> =
    OnceLock::new();
const OBS_DOCK_PORT_NUMBER: u16 = 17173;
static OBS_DOCK_PORT: OnceLock<u16> = OnceLock::new();
static OBS_DOCK_STATE: OnceLock<Mutex<String>> = OnceLock::new();

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct KickViewerChannel {
    broadcaster_user_id: String,
    slug: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct KickViewerBridgeMessage {
    fyflate_kick_bridge: bool,
    data: String,
}

fn kick_viewer_windows(
) -> &'static Mutex<HashMap<String, String>> {
    KICK_VIEWER_WINDOWS.get_or_init(
        || Mutex::new(HashMap::new())
    )
}

fn obs_dock_state() -> &'static Mutex<String> {
    OBS_DOCK_STATE.get_or_init(|| {
        Mutex::new(
            r#"{"enabled":false,"appName":"FyFlade","channel":null,"messages":[]}"#
                .to_string(),
        )
    })
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct KickTunnelStatus {
    status: String,
    public_url: String,
    webhook_url: String,
    error: String,
}

impl Default for KickTunnelStatus {
    fn default() -> Self {
        Self {
            status: "idle".to_string(),
            public_url: String::new(),
            webhook_url: String::new(),
            error: String::new(),
        }
    }
}

#[derive(Default)]
struct KickTunnelRuntime {
    child: Option<Child>,
    status: KickTunnelStatus,
}

static KICK_TUNNEL_RUNTIME: OnceLock<Mutex<KickTunnelRuntime>> =
    OnceLock::new();

mod youtube_live_chat {
    tonic::include_proto!("youtube.api.v3");
}

static YOUTUBE_STREAM_GENERATIONS: OnceLock<
    Mutex<HashMap<String, u64>>
> = OnceLock::new();

fn youtube_stream_generations(
) -> &'static Mutex<HashMap<String, u64>> {
    YOUTUBE_STREAM_GENERATIONS.get_or_init(
        || Mutex::new(HashMap::new())
    )
}

fn set_youtube_stream_generation(
    tab_id: &str,
    generation: u64,
) {
    if let Ok(mut map) =
        youtube_stream_generations().lock()
    {
        map.insert(
            tab_id.to_string(),
            generation,
        );
    }
}

fn youtube_stream_is_current(
    tab_id: &str,
    generation: u64,
) -> bool {
    youtube_stream_generations()
        .lock()
        .ok()
        .and_then(
            |map|
                map.get(tab_id).copied()
        )
        == Some(generation)
}

fn invalidate_youtube_stream(
    tab_id: &str,
) {
    if let Ok(mut map) =
        youtube_stream_generations().lock()
    {
        let next =
            map.get(tab_id)
                .copied()
                .unwrap_or(0)
                .saturating_add(1);

        map.insert(
            tab_id.to_string(),
            next,
        );
    }
}

// Compatibility default for clients that do not provide a retention period.
const CHAT_HISTORY_DEFAULT_MAX_AGE_MS: u64 =
    24 * 60 * 60 * 1000;

fn history_cutoff(now: u64, max_age_ms: Option<u64>) -> u64 {
    match max_age_ms {
        Some(0) => 0,
        Some(value) => now.saturating_sub(value),
        None => now.saturating_sub(CHAT_HISTORY_DEFAULT_MAX_AGE_MS),
    }
}

fn twitch_token_entry() -> Result<Entry, String> {
    Entry::new(
        LEGACY_CREDENTIAL_SERVICE,
        TWITCH_REFRESH_TOKEN_ACCOUNT,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_twitch_refresh_token(
    refresh_token: String,
) -> Result<(), String> {
    let entry = twitch_token_entry()?;

    entry
        .set_password(&refresh_token)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_twitch_refresh_token(
) -> Result<Option<String>, String> {
    let entry = twitch_token_entry()?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn delete_twitch_refresh_token(
) -> Result<(), String> {
    let entry = twitch_token_entry()?;

    let _ = entry.delete_credential();

    Ok(())
}

// ---------------------------------------------------------
// YOUTUBE LOGIN
// ---------------------------------------------------------

fn youtube_token_entry() -> Result<Entry, String> {
    Entry::new(
        LEGACY_CREDENTIAL_SERVICE,
        YOUTUBE_REFRESH_TOKEN_ACCOUNT,
    )
    .map_err(|error| error.to_string())
}

fn youtube_client_secret_entry() -> Result<Entry, String> {
    Entry::new(
        LEGACY_CREDENTIAL_SERVICE,
        YOUTUBE_CLIENT_SECRET_ACCOUNT,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_youtube_refresh_token(
    refresh_token: String,
) -> Result<(), String> {
    let entry = youtube_token_entry()?;

    entry
        .set_password(&refresh_token)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_youtube_refresh_token(
) -> Result<Option<String>, String> {
    let entry = youtube_token_entry()?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn delete_youtube_refresh_token(
) -> Result<(), String> {
    let entry = youtube_token_entry()?;

    let _ = entry.delete_credential();

    Ok(())
}

#[tauri::command]
fn save_youtube_client_secret(
    client_secret: String,
) -> Result<(), String> {
    if client_secret.trim().is_empty() {
        return Err(
            "YouTube Client Secret kan ikke være tom.".to_string()
        );
    }

    youtube_client_secret_entry()?
        .set_password(&client_secret)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_youtube_client_secret(
) -> Result<Option<String>, String> {
    match youtube_client_secret_entry()?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn delete_youtube_client_secret(
) -> Result<(), String> {
    let _ = youtube_client_secret_entry()?.delete_credential();
    Ok(())
}

// ---------------------------------------------------------
// KICK LOGIN
// ---------------------------------------------------------

fn kick_refresh_token_entry() -> Result<Entry, String> {
    Entry::new(
        LEGACY_CREDENTIAL_SERVICE,
        KICK_REFRESH_TOKEN_ACCOUNT,
    )
    .map_err(|error| error.to_string())
}

fn kick_client_secret_entry() -> Result<Entry, String> {
    Entry::new(
        LEGACY_CREDENTIAL_SERVICE,
        KICK_CLIENT_SECRET_ACCOUNT,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_kick_refresh_token(
    refresh_token: String,
) -> Result<(), String> {
    let entry = kick_refresh_token_entry()?;

    entry
        .set_password(&refresh_token)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_kick_refresh_token(
) -> Result<Option<String>, String> {
    let entry = kick_refresh_token_entry()?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn delete_kick_refresh_token(
) -> Result<(), String> {
    let entry = kick_refresh_token_entry()?;

    let _ = entry.delete_credential();

    Ok(())
}

#[tauri::command]
fn save_kick_client_secret(
    client_secret: String,
) -> Result<(), String> {
    if client_secret.trim().is_empty() {
        return Err(
            "Kick Client Secret kan ikke være tom.".to_string()
        );
    }

    let entry = kick_client_secret_entry()?;

    entry
        .set_password(&client_secret)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_kick_client_secret(
) -> Result<Option<String>, String> {
    let entry = kick_client_secret_entry()?;

    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn delete_kick_client_secret(
) -> Result<(), String> {
    let entry = kick_client_secret_entry()?;

    let _ = entry.delete_credential();

    Ok(())
}

fn decode_hex_digit(
    byte: u8,
) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_decode_query_component(
    value: &str,
) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                out.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                let high = decode_hex_digit(bytes[index + 1]);
                let low = decode_hex_digit(bytes[index + 2]);

                if let (Some(high), Some(low)) = (high, low) {
                    out.push((high << 4) | low);
                    index += 3;
                } else {
                    out.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                out.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&out).into_owned()
}

fn oauth_query_parameter(
    path: &str,
    name: &str,
) -> Option<String> {
    let (_, query) = path.split_once('?')?;

    for pair in query.split('&') {
        let (key, value) =
            pair.split_once('=').unwrap_or((pair, ""));

        if percent_decode_query_component(key) == name {
            return Some(
                percent_decode_query_component(value)
            );
        }
    }

    None
}

fn write_oauth_browser_response(
    stream: &mut std::net::TcpStream,
    success: bool,
) {
    let (title, message) = if success {
        (
            "FyFlade - YouTube connected",
            "YouTube authorization was received. You can close this browser tab and return to FyFlade.",
        )
    } else {
        (
            "FyFlade - YouTube login failed",
            "FyFlade could not complete YouTube authorization. Return to FyFlade to see the error.",
        )
    };

    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{}</title></head><body style=\"margin:0;background:#101115;color:#eee;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;min-height:100vh\"><main style=\"max-width:560px;padding:32px;text-align:center\"><div style=\"font-size:42px\">{}</div><h1 style=\"font-size:22px\">{}</h1><p style=\"color:#aeb3bb;line-height:1.6\">{}</p></main></body></html>",
        title,
        if success { "✓" } else { "×" },
        title,
        message,
    );

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body,
    );

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[tauri::command]
fn start_youtube_oauth_listener(
    app: tauri::AppHandle,
    expected_state: String,
) -> Result<u16, String> {
    if expected_state.len() < 20 {
        return Err(
            "OAuth state var ugyldig.".to_string()
        );
    }

    let listener = TcpListener::bind(
        "127.0.0.1:0"
    )
    .map_err(|error| error.to_string())?;

    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();

    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;

    thread::spawn(move || {
        let deadline =
            Instant::now() + Duration::from_secs(300);

        loop {
            if Instant::now() >= deadline {
                let _ = app.emit(
                    "youtube-oauth-result",
                    "error:YouTube-innloggingen gikk ut på tid. Prøv igjen."
                );

                break;
            }

            match listener.accept() {
                Ok((mut stream, _address)) => {
                    let mut request_line = String::new();

                    if let Ok(cloned) = stream.try_clone() {
                        let mut reader = BufReader::new(cloned);
                        let _ = reader.read_line(&mut request_line);
                    }

                    let path = request_line
                        .split_whitespace()
                        .nth(1)
                        .unwrap_or("");

                    let code = oauth_query_parameter(
                        path,
                        "code",
                    );

                    let oauth_error = oauth_query_parameter(
                        path,
                        "error",
                    );

                    // Nettleseren kan spørre etter f.eks. favicon.
                    // Ignorer forespørsler som ikke er OAuth-callbacken.
                    if code.is_none() && oauth_error.is_none() {
                        let response = b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n";
                        let _ = stream.write_all(response);
                        let _ = stream.flush();
                        continue;
                    }

                    let received_state = oauth_query_parameter(
                        path,
                        "state",
                    )
                    .unwrap_or_default();

                    if received_state != expected_state {
                        write_oauth_browser_response(
                            &mut stream,
                            false,
                        );

                        let _ = app.emit(
                            "youtube-oauth-result",
                            "error:OAuth state stemte ikke. Innloggingen ble stoppet av sikkerhetshensyn."
                        );

                        break;
                    }

                    if let Some(error) = oauth_error {
                        let description = oauth_query_parameter(
                            path,
                            "error_description",
                        )
                        .unwrap_or(error);

                        write_oauth_browser_response(
                            &mut stream,
                            false,
                        );

                        let _ = app.emit(
                            "youtube-oauth-result",
                            format!(
                                "error:{}",
                                description
                            )
                        );

                        break;
                    }

                    if let Some(code) = code {
                        write_oauth_browser_response(
                            &mut stream,
                            true,
                        );

                        let _ = app.emit(
                            "youtube-oauth-result",
                            format!(
                                "ok:{}",
                                code
                            )
                        );

                        break;
                    }
                }
                Err(error)
                    if error.kind()
                        == std::io::ErrorKind::WouldBlock =>
                {
                    thread::sleep(
                        Duration::from_millis(50)
                    );
                }
                Err(error) => {
                    let _ = app.emit(
                        "youtube-oauth-result",
                        format!(
                            "error:Kunne ikke ta imot YouTube OAuth callback: {}",
                            error
                        )
                    );

                    break;
                }
            }
        }
    });

    Ok(port)
}

fn write_kick_oauth_browser_response(
    stream: &mut std::net::TcpStream,
    success: bool,
) {
    let (title, message) = if success {
        (
            "FyFlade - Kick connected",
            "Kick authorization was received. You can close this browser tab and return to FyFlade.",
        )
    } else {
        (
            "FyFlade - Kick login failed",
            "FyFlade could not complete Kick authorization. Return to FyFlade to see the error.",
        )
    };

    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{}</title></head><body style=\"margin:0;background:#101115;color:#eee;font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;min-height:100vh\"><main style=\"max-width:560px;padding:32px;text-align:center\"><div style=\"font-size:42px;color:#53fc18\">{}</div><h1 style=\"font-size:22px\">{}</h1><p style=\"color:#aeb3bb;line-height:1.6\">{}</p></main></body></html>",
        title,
        if success { "✓" } else { "×" },
        title,
        message,
    );

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
        body.as_bytes().len(),
        body,
    );

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[tauri::command]
fn start_kick_oauth_listener(
    app: tauri::AppHandle,
    expected_state: String,
) -> Result<u16, String> {
    if expected_state.len() < 20 {
        return Err(
            "OAuth state var ugyldig.".to_string()
        );
    }

    // Kick-appen er registrert med den faste callbacken:
    // http://localhost:17171/kick/callback
    // Redirect-URLen er fortsatt http://localhost:17171/kick/callback,
    // men vi binder eksplisitt til IPv4-loopback. Dette er mer stabilt på
    // Windows enn å la `localhost` velge mellom IPv4 og IPv6.
    let listener = TcpListener::bind(
        "127.0.0.1:17171"
    )
    .map_err(|error| {
        format!(
            "Kunne ikke starte Kick OAuth-listener på port 17171: {}. Lukk eventuell gammel FyFlade-instans og prøv igjen.",
            error
        )
    })?;

    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;

    thread::spawn(move || {
        let deadline =
            Instant::now() + Duration::from_secs(300);

        loop {
            if Instant::now() >= deadline {
                let _ = app.emit(
                    "kick-oauth-result",
                    "error:Kick-innloggingen gikk ut på tid. Prøv igjen."
                );

                break;
            }

            match listener.accept() {
                Ok((mut stream, _address)) => {
                    let mut request_line = String::new();

                    if let Ok(cloned) = stream.try_clone() {
                        let mut reader = BufReader::new(cloned);
                        let _ = reader.read_line(&mut request_line);
                    }

                    let path = request_line
                        .split_whitespace()
                        .nth(1)
                        .unwrap_or("");

                    let path_only = path
                        .split('?')
                        .next()
                        .unwrap_or("");

                    // Ignorer favicon eller andre lokale forespørsler.
                    if path_only != "/kick/callback" {
                        let response = b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n";
                        let _ = stream.write_all(response);
                        let _ = stream.flush();
                        continue;
                    }

                    let code = oauth_query_parameter(
                        path,
                        "code",
                    );

                    let oauth_error = oauth_query_parameter(
                        path,
                        "error",
                    );

                    if code.is_none() && oauth_error.is_none() {
                        write_kick_oauth_browser_response(
                            &mut stream,
                            false,
                        );

                        let _ = app.emit(
                            "kick-oauth-result",
                            "error:Kick callback manglet authorization code."
                        );

                        break;
                    }

                    let received_state = oauth_query_parameter(
                        path,
                        "state",
                    )
                    .unwrap_or_default();

                    if received_state != expected_state {
                        write_kick_oauth_browser_response(
                            &mut stream,
                            false,
                        );

                        let _ = app.emit(
                            "kick-oauth-result",
                            "error:OAuth state stemte ikke. Innloggingen ble stoppet av sikkerhetshensyn."
                        );

                        break;
                    }

                    if let Some(error) = oauth_error {
                        let description = oauth_query_parameter(
                            path,
                            "error_description",
                        )
                        .unwrap_or(error);

                        write_kick_oauth_browser_response(
                            &mut stream,
                            false,
                        );

                        let _ = app.emit(
                            "kick-oauth-result",
                            format!(
                                "error:Kick OAuth avviste innloggingen: {}",
                                description
                            )
                        );

                        break;
                    }

                    if let Some(code) = code {
                        write_kick_oauth_browser_response(
                            &mut stream,
                            true,
                        );

                        let _ = app.emit(
                            "kick-oauth-result",
                            format!(
                                "ok:{}",
                                code
                            )
                        );

                        break;
                    }
                }
                Err(error)
                    if error.kind()
                        == std::io::ErrorKind::WouldBlock =>
                {
                    thread::sleep(
                        Duration::from_millis(50)
                    );
                }
                Err(error) => {
                    let _ = app.emit(
                        "kick-oauth-result",
                        format!(
                            "error:Kunne ikke ta imot Kick OAuth callback: {}",
                            error
                        )
                    );

                    break;
                }
            }
        }
    });

    Ok(17171)
}


// ---------------------------------------------------------
// KICK WEBHOOK RECEIVER
// ---------------------------------------------------------

fn kick_tunnel_runtime(
) -> &'static Mutex<KickTunnelRuntime> {
    KICK_TUNNEL_RUNTIME.get_or_init(
        || Mutex::new(KickTunnelRuntime::default())
    )
}

fn kick_tunnel_snapshot() -> KickTunnelStatus {
    kick_tunnel_runtime()
        .lock()
        .map(|runtime| runtime.status.clone())
        .unwrap_or_else(|_| KickTunnelStatus {
            status: "error".to_string(),
            public_url: String::new(),
            webhook_url: String::new(),
            error: "Kunne ikke lese tunnelstatus.".to_string(),
        })
}

fn emit_kick_tunnel_status(
    app: &tauri::AppHandle,
    status: &KickTunnelStatus,
) {
    let _ = app.emit(
        "kick-tunnel-status",
        status.clone(),
    );
}

fn set_kick_tunnel_error(
    app: &tauri::AppHandle,
    message: String,
) -> KickTunnelStatus {
    let status = KickTunnelStatus {
        status: "error".to_string(),
        public_url: String::new(),
        webhook_url: String::new(),
        error: message,
    };

    if let Ok(mut runtime) = kick_tunnel_runtime().lock() {
        runtime.status = status.clone();
    }

    emit_kick_tunnel_status(app, &status);
    status
}

fn find_cloudflared_executable() -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    for variable in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Some(directory) = std::env::var_os(variable) {
            candidates.push(
                PathBuf::from(directory)
                    .join("cloudflared")
                    .join("cloudflared.exe")
            );
        }
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        candidates.push(
            PathBuf::from(&local_app_data)
                .join("Microsoft")
                .join("WinGet")
                .join("Links")
                .join("cloudflared.exe")
        );
        candidates.push(
            PathBuf::from(local_app_data)
                .join("cloudflared")
                .join("cloudflared.exe")
        );
    }

    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            candidates.push(directory.join("cloudflared.exe"));
            candidates.push(directory.join("cloudflared"));
        }
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| {
            "cloudflared er ikke installert. Installer Cloudflare Tunnel og start FyFlade på nytt."
                .to_string()
        })
}

fn quick_tunnel_url_from_line(line: &str) -> Option<String> {
    const SUFFIX: &str = ".trycloudflare.com";

    let suffix_start = line.find(SUFFIX)?;
    let url_start = line[..suffix_start].rfind("https://")?;
    let url_end = suffix_start + SUFFIX.len();
    let url = line.get(url_start..url_end)?.trim();

    if url.is_empty() {
        None
    } else {
        Some(url.to_string())
    }
}

fn monitor_cloudflared_output<R>(
    reader: R,
    app: tauri::AppHandle,
) where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        for line in BufReader::new(reader).lines().map_while(Result::ok) {
            let Some(public_url) = quick_tunnel_url_from_line(&line) else {
                continue;
            };

            let webhook_url = format!(
                "{}/kick/webhook",
                public_url.trim_end_matches('/')
            );

            let status = KickTunnelStatus {
                status: "ready".to_string(),
                public_url,
                webhook_url,
                error: String::new(),
            };

            let should_emit = if let Ok(mut runtime) =
                kick_tunnel_runtime().lock()
            {
                if runtime.status.webhook_url == status.webhook_url
                    && runtime.status.status == "ready"
                {
                    false
                } else {
                    runtime.status = status.clone();
                    true
                }
            } else {
                false
            };

            if should_emit {
                emit_kick_tunnel_status(&app, &status);
            }
        }
    });
}

fn monitor_cloudflared_process(
    app: tauri::AppHandle,
) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(500));

        let finished = if let Ok(mut runtime) =
            kick_tunnel_runtime().lock()
        {
            let result = runtime
                .child
                .as_mut()
                .map(|child| child.try_wait());

            match result {
                Some(Ok(Some(exit_status))) => {
                    runtime.child = None;

                    let message = if runtime.status.status == "ready" {
                        format!(
                            "Cloudflare-tunnelen stoppet ({exit_status}). Start FyFlade på nytt."
                        )
                    } else {
                        format!(
                            "Cloudflare-tunnelen kunne ikke starte ({exit_status})."
                        )
                    };

                    runtime.status = KickTunnelStatus {
                        status: "error".to_string(),
                        public_url: String::new(),
                        webhook_url: String::new(),
                        error: message,
                    };

                    Some(runtime.status.clone())
                }
                Some(Err(error)) => {
                    runtime.child = None;
                    runtime.status = KickTunnelStatus {
                        status: "error".to_string(),
                        public_url: String::new(),
                        webhook_url: String::new(),
                        error: format!(
                            "Kunne ikke lese Cloudflare-tunnelprosessen: {error}"
                        ),
                    };

                    Some(runtime.status.clone())
                }
                Some(Ok(None)) => None,
                None => return,
            }
        } else {
            return;
        };

        if let Some(status) = finished {
            emit_kick_tunnel_status(&app, &status);
            return;
        }
    });
}

#[tauri::command]
fn get_kick_webhook_tunnel_status() -> KickTunnelStatus {
    kick_tunnel_snapshot()
}

#[tauri::command]
fn start_kick_webhook_tunnel(
    app: tauri::AppHandle,
) -> Result<KickTunnelStatus, String> {
    if let Ok(mut runtime) = kick_tunnel_runtime().lock() {
        let is_running = runtime
            .child
            .as_mut()
            .map(|child| matches!(child.try_wait(), Ok(None)))
            .unwrap_or(false);

        if is_running {
            return Ok(runtime.status.clone());
        }

        runtime.child = None;
        runtime.status = KickTunnelStatus {
            status: "starting".to_string(),
            public_url: String::new(),
            webhook_url: String::new(),
            error: String::new(),
        };
    }

    let executable = match find_cloudflared_executable() {
        Ok(executable) => executable,
        Err(error) => {
            set_kick_tunnel_error(&app, error.clone());
            return Err(error);
        }
    };

    let mut command = Command::new(executable);
    command
        .arg("tunnel")
        .arg("--no-autoupdate")
        .arg("--url")
        .arg(format!(
            "http://127.0.0.1:{}",
            KICK_WEBHOOK_PORT_NUMBER
        ))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000);

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            let message = format!(
                "Kunne ikke starte cloudflared automatisk: {error}"
            );
            set_kick_tunnel_error(&app, message.clone());
            return Err(message);
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let status = KickTunnelStatus {
        status: "starting".to_string(),
        public_url: String::new(),
        webhook_url: String::new(),
        error: String::new(),
    };

    if let Ok(mut runtime) = kick_tunnel_runtime().lock() {
        runtime.child = Some(child);
        runtime.status = status.clone();
    }

    emit_kick_tunnel_status(&app, &status);

    if let Some(stdout) = stdout {
        monitor_cloudflared_output(stdout, app.clone());
    }

    if let Some(stderr) = stderr {
        monitor_cloudflared_output(stderr, app.clone());
    }

    monitor_cloudflared_process(app);

    Ok(status)
}

fn stop_kick_webhook_tunnel() {
    if let Ok(mut runtime) = kick_tunnel_runtime().lock() {
        if let Some(mut child) = runtime.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        runtime.status = KickTunnelStatus::default();
    }
}

fn write_kick_webhook_response(
    stream: &mut std::net::TcpStream,
    status: &str,
    body: &str,
) {
    let response = format!(
        "HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
        status,
        body.as_bytes().len(),
        body,
    );

    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

fn header_value(
    headers: &[(String, String)],
    name: &str,
) -> String {
    headers
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case(name))
        .map(|(_, value)| value.clone())
        .unwrap_or_default()
}

fn read_kick_chunked_body(
    reader: &mut BufReader<std::net::TcpStream>,
    max_bytes: usize,
) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();

    loop {
        let mut size_line = String::new();
        reader
            .read_line(&mut size_line)
            .map_err(|error| error.to_string())?;

        let size_text = size_line
            .trim_end_matches(|c| c == '\r' || c == '\n')
            .split(';')
            .next()
            .unwrap_or("")
            .trim();

        let size = usize::from_str_radix(size_text, 16)
            .map_err(|_| "Invalid chunk size.".to_string())?;

        if size == 0 {
            loop {
                let mut trailer = String::new();
                reader
                    .read_line(&mut trailer)
                    .map_err(|error| error.to_string())?;

                if trailer == "\r\n" || trailer == "\n" || trailer.is_empty() {
                    break;
                }
            }

            break;
        }

        if body.len().saturating_add(size) > max_bytes {
            return Err("Webhook body too large.".to_string());
        }

        let start = body.len();
        body.resize(start + size, 0);
        reader
            .read_exact(&mut body[start..])
            .map_err(|error| error.to_string())?;

        let mut ending = [0u8; 2];
        reader
            .read_exact(&mut ending)
            .map_err(|error| error.to_string())?;

        if ending != *b"\r\n" {
            return Err("Invalid chunk ending.".to_string());
        }
    }

    Ok(body)
}

fn handle_kick_webhook_connection(
    mut stream: std::net::TcpStream,
    app: tauri::AppHandle,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(8)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(8)));

    let cloned = match stream.try_clone() {
        Ok(cloned) => cloned,
        Err(_) => {
            write_kick_webhook_response(
                &mut stream,
                "500 Internal Server Error",
                "FyFlade could not read the request.",
            );
            return;
        }
    };

    let mut reader = BufReader::new(cloned);
    let mut request_line = String::new();

    if reader.read_line(&mut request_line).is_err() {
        write_kick_webhook_response(
            &mut stream,
            "400 Bad Request",
            "Invalid request.",
        );
        return;
    }

    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or("");
    let path = request_parts.next().unwrap_or("");
    let path_only = path.split('?').next().unwrap_or("");

    if path_only != "/kick/webhook" {
        write_kick_webhook_response(
            &mut stream,
            "404 Not Found",
            "Not found.",
        );
        return;
    }

    let mut headers: Vec<(String, String)> = Vec::new();

    loop {
        let mut line = String::new();

        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim_end_matches(|c| c == '\r' || c == '\n');

                if trimmed.is_empty() {
                    break;
                }

                if let Some((name, value)) = trimmed.split_once(':') {
                    headers.push((
                        name.trim().to_string(),
                        value.trim().to_string(),
                    ));
                }
            }
            Err(_) => {
                write_kick_webhook_response(
                    &mut stream,
                    "400 Bad Request",
                    "Invalid headers.",
                );
                return;
            }
        }
    }

    if method == "GET" || method == "HEAD" {
        write_kick_webhook_response(
            &mut stream,
            "200 OK",
            "FyFlade Kick webhook ready",
        );
        return;
    }

    if method != "POST" {
        write_kick_webhook_response(
            &mut stream,
            "405 Method Not Allowed",
            "Method not allowed.",
        );
        return;
    }

    let content_length = header_value(&headers, "content-length")
        .parse::<usize>()
        .unwrap_or(0);

    let transfer_encoding = header_value(&headers, "transfer-encoding")
        .to_lowercase();

    const MAX_WEBHOOK_BYTES: usize = 2 * 1024 * 1024;

    let body_bytes = if transfer_encoding.contains("chunked") {
        match read_kick_chunked_body(
            &mut reader,
            MAX_WEBHOOK_BYTES,
        ) {
            Ok(body) if !body.is_empty() => body,
            _ => {
                write_kick_webhook_response(
                    &mut stream,
                    "400 Bad Request",
                    "Could not read chunked webhook body.",
                );
                return;
            }
        }
    } else {
        if content_length == 0 || content_length > MAX_WEBHOOK_BYTES {
            write_kick_webhook_response(
                &mut stream,
                "400 Bad Request",
                "Missing or invalid Content-Length.",
            );
            return;
        }

        let mut body = vec![0u8; content_length];

        if reader.read_exact(&mut body).is_err() {
            write_kick_webhook_response(
                &mut stream,
                "400 Bad Request",
                "Could not read webhook body.",
            );
            return;
        }

        body
    };

    let body = String::from_utf8_lossy(&body_bytes).into_owned();
    let event_type = header_value(&headers, "kick-event-type");
    let message_id = header_value(&headers, "kick-event-message-id");
    let timestamp = header_value(&headers, "kick-event-message-timestamp");
    let signature = header_value(&headers, "kick-event-signature");

    // Svar raskt 200 slik at Kick ikke behøver å retrye mens frontend behandler eventet.
    write_kick_webhook_response(
        &mut stream,
        "200 OK",
        "ok",
    );

    if event_type.is_empty()
        || message_id.is_empty()
        || timestamp.is_empty()
        || signature.is_empty()
    {
        return;
    }

    let _ = app.emit(
        "kick-webhook-event",
        vec![
            event_type,
            message_id,
            timestamp,
            signature,
            body,
        ],
    );
}

#[tauri::command]
fn start_kick_webhook_listener(
    app: tauri::AppHandle,
) -> Result<u16, String> {
    if let Some(port) = KICK_WEBHOOK_PORT.get() {
        return Ok(*port);
    }

    let listener = TcpListener::bind((
        "127.0.0.1",
        KICK_WEBHOOK_PORT_NUMBER,
    ))
    .map_err(|error| {
        format!(
            "Kunne ikke starte Kick webhook-listener på port {}: {}. Lukk eventuell gammel FyFlade-instans og prøv igjen.",
            KICK_WEBHOOK_PORT_NUMBER,
            error
        )
    })?;

    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;

    let _ = KICK_WEBHOOK_PORT.set(KICK_WEBHOOK_PORT_NUMBER);

    thread::spawn(move || loop {
        match listener.accept() {
            Ok((stream, _address)) => {
                let app_for_request = app.clone();

                thread::spawn(move || {
                    handle_kick_webhook_connection(
                        stream,
                        app_for_request,
                    );
                });
            }
            Err(error)
                if error.kind()
                    == std::io::ErrorKind::WouldBlock =>
            {
                thread::sleep(
                    Duration::from_millis(40)
                );
            }
            Err(error) => {
                let _ = app.emit(
                    "kick-webhook-listener-error",
                    error.to_string(),
                );

                break;
            }
        }
    });

    Ok(KICK_WEBHOOK_PORT_NUMBER)
}

fn kick_viewer_window_label(
    broadcaster_user_id: &str,
    slug: &str,
) -> String {
    let clean_id: String = broadcaster_user_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect();

    if !clean_id.is_empty() {
        return format!("kick-viewer-{}", clean_id);
    }

    let hash = slug.as_bytes().iter().fold(
        0xcbf29ce484222325_u64,
        |value, byte| {
            value
                .wrapping_mul(0x100000001b3)
                ^ u64::from(*byte)
        },
    );

    format!("kick-viewer-{:x}", hash)
}

#[cfg(target_os = "windows")]
fn create_kick_viewer_window(
    app: &tauri::AppHandle,
    label: &str,
    slug: &str,
) -> Result<(), String> {
    let url = tauri::Url::parse(
        &format!("https://kick.com/{}", slug)
    )
    .map_err(|error| error.to_string())?;

    // Kick's public webhook delivery can stop even while the subscription is
    // reported as active. This small hidden viewer follows the same realtime
    // socket as kick.com and forwards only text frames to Fyflate.
    let initialization_script = r#"
        (() => {
          if (window.__fyflateKickBridgeInstalled) return;
          window.__fyflateKickBridgeInstalled = true;

          const NativeWebSocket = window.WebSocket;
          if (typeof NativeWebSocket !== 'function') return;

          function FyflateWebSocket(url, protocols) {
            const socket = protocols === undefined
              ? new NativeWebSocket(url)
              : new NativeWebSocket(url, protocols);

            if (String(url || '').includes('websockets.kick.com')) {
              socket.addEventListener('message', (event) => {
                if (typeof event.data !== 'string') return;
                try {
                  window.chrome.webview.postMessage({
                    fyflateKickBridge: true,
                    data: event.data,
                  });
                } catch (_) {}
              });
            }

            return socket;
          }

          Object.setPrototypeOf(FyflateWebSocket, NativeWebSocket);
          FyflateWebSocket.prototype = NativeWebSocket.prototype;
          window.WebSocket = FyflateWebSocket;
        })();
    "#;

    let window = tauri::WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::External(url),
    )
    .title("FyFlade Kick viewer")
    .visible(false)
    .focused(false)
    .skip_taskbar(true)
    .decorations(false)
    .shadow(false)
    .inner_size(2.0, 2.0)
    .initialization_script(initialization_script)
    .build()
    .map_err(|error| error.to_string())?;

    let app_for_events = app.clone();
    let slug_for_events = slug.to_string();

    window
        .with_webview(move |webview| unsafe {
            let Ok(core_webview) =
                webview.controller().CoreWebView2()
            else {
                return;
            };

            let event_app = app_for_events.clone();
            let event_slug = slug_for_events.clone();
            let handler =
                WebMessageReceivedEventHandler::create(
                    Box::new(move |_sender, args| {
                        if let Some(args) = args {
                            let mut raw_json = PWSTR::null();

                            if args
                                .WebMessageAsJson(&mut raw_json)
                                .is_ok()
                            {
                                let json =
                                    CoTaskMemPWSTR::from(raw_json)
                                        .to_string();

                                if let Ok(message) =
                                    serde_json::from_str::<
                                        KickViewerBridgeMessage,
                                    >(&json)
                                {
                                    if message.fyflate_kick_bridge
                                        && !message.data.is_empty()
                                    {
                                        let _ = event_app.emit(
                                            "kick-viewer-frame",
                                            vec![
                                                event_slug.clone(),
                                                message.data,
                                            ],
                                        );
                                    }
                                }
                            }
                        }

                        Ok(())
                    }),
                );

            let mut token = 0;
            let _ = core_webview.add_WebMessageReceived(
                &handler,
                &mut token,
            );
        })
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn sync_kick_viewer_channels(
    app: tauri::AppHandle,
    channels: Vec<KickViewerChannel>,
) -> Result<usize, String> {
    let mut desired = HashMap::<String, String>::new();

    for channel in channels.into_iter().take(12) {
        let slug: String = channel
            .slug
            .trim()
            .to_lowercase()
            .chars()
            .filter(|character| {
                character.is_ascii_alphanumeric()
                    || matches!(character, '_' | '-')
            })
            .collect();

        if slug.is_empty() {
            continue;
        }

        desired.insert(
            kick_viewer_window_label(
                &channel.broadcaster_user_id,
                &slug,
            ),
            slug,
        );
    }

    let current = kick_viewer_windows()
        .lock()
        .map_err(|error| error.to_string())?
        .clone();

    for label in current.keys() {
        if !desired.contains_key(label) {
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.close();
            }

            if let Ok(mut windows) = kick_viewer_windows().lock() {
                windows.remove(label);
            }
        }
    }

    for (label, slug) in &desired {
        if current.get(label) == Some(slug)
            && app.get_webview_window(label).is_some()
        {
            continue;
        }

        #[cfg(target_os = "windows")]
        create_kick_viewer_window(
            &app,
            label,
            slug,
        )?;

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (&app, label, slug);
        }

        kick_viewer_windows()
            .lock()
            .map_err(|error| error.to_string())?
            .insert(
                label.clone(),
                slug.clone(),
            );
    }

    Ok(desired.len())
}

// ---------------------------------------------------------
// OBS DOCK - LOKAL, REN CHATVISNING
// ---------------------------------------------------------

fn write_obs_dock_response(
    stream: &mut std::net::TcpStream,
    status: &str,
    content_type: &str,
    body: &[u8],
) {
    let headers = format!(
        "HTTP/1.1 {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'\r\nCross-Origin-Resource-Policy: same-origin\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nConnection: close\r\n\r\n",
        status,
        content_type,
        body.len(),
    );

    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
}

fn handle_obs_dock_connection(
    mut stream: std::net::TcpStream,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let cloned = match stream.try_clone() {
        Ok(cloned) => cloned,
        Err(_) => return,
    };
    let mut reader = BufReader::new(cloned);
    let mut request_line = String::new();

    if reader.read_line(&mut request_line).is_err() {
        return;
    }

    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or("");
    let path = request_parts.next().unwrap_or("");
    let path_only = path.split('?').next().unwrap_or("");

    if method != "GET" && method != "HEAD" {
        write_obs_dock_response(
            &mut stream,
            "405 Method Not Allowed",
            "text/plain; charset=utf-8",
            b"Method not allowed.",
        );
        return;
    }

    if path_only == "/state" {
        let state = obs_dock_state()
            .lock()
            .map(|value| value.clone())
            .unwrap_or_else(|_| "{\"enabled\":false}".to_string());
        let body = if method == "HEAD" {
            &[][..]
        } else {
            state.as_bytes()
        };

        write_obs_dock_response(
            &mut stream,
            "200 OK",
            "application/json; charset=utf-8",
            body,
        );
        return;
    }

    if path_only == "/" || path_only == "/obs-dock" {
        let html = include_str!("../obs-dock.html");
        let body = if method == "HEAD" {
            &[][..]
        } else {
            html.as_bytes()
        };

        write_obs_dock_response(
            &mut stream,
            "200 OK",
            "text/html; charset=utf-8",
            body,
        );
        return;
    }

    if path_only == "/obs-overlay" {
        let html = include_str!("../obs-overlay.html");
        let body = if method == "HEAD" {
            &[][..]
        } else {
            html.as_bytes()
        };

        write_obs_dock_response(
            &mut stream,
            "200 OK",
            "text/html; charset=utf-8",
            body,
        );
        return;
    }

    if path_only == "/favicon.ico" {
        write_obs_dock_response(
            &mut stream,
            "204 No Content",
            "image/x-icon",
            b"",
        );
        return;
    }

    write_obs_dock_response(
        &mut stream,
        "404 Not Found",
        "text/plain; charset=utf-8",
        b"Not found.",
    );
}

#[tauri::command]
fn start_obs_dock_server() -> Result<u16, String> {
    if let Some(port) = OBS_DOCK_PORT.get() {
        return Ok(*port);
    }

    let listener = TcpListener::bind((
        "127.0.0.1",
        OBS_DOCK_PORT_NUMBER,
    ))
    .map_err(|error| {
        format!(
            "Could not start the FyFlade OBS dock on port {}: {}",
            OBS_DOCK_PORT_NUMBER,
            error
        )
    })?;

    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;

    let _ = OBS_DOCK_PORT.set(OBS_DOCK_PORT_NUMBER);

    thread::spawn(move || loop {
        match listener.accept() {
            Ok((stream, address)) => {
                if !address.ip().is_loopback() {
                    continue;
                }

                thread::spawn(move || {
                    handle_obs_dock_connection(stream);
                });
            }
            Err(error)
                if error.kind()
                    == std::io::ErrorKind::WouldBlock =>
            {
                thread::sleep(Duration::from_millis(40));
            }
            Err(_) => break,
        }
    });

    Ok(OBS_DOCK_PORT_NUMBER)
}

#[tauri::command]
fn update_obs_dock_state(
    state_json: String,
) -> Result<(), String> {
    const MAX_OBS_DOCK_STATE_BYTES: usize = 2 * 1024 * 1024;

    if state_json.len() > MAX_OBS_DOCK_STATE_BYTES {
        return Err("OBS dock state is too large.".to_string());
    }

    serde_json::from_str::<serde_json::Value>(&state_json)
        .map_err(|error| error.to_string())?;

    let mut state = obs_dock_state()
        .lock()
        .map_err(|_| "OBS dock state is unavailable.".to_string())?;
    *state = state_json;

    Ok(())
}

// ---------------------------------------------------------
// CHAT HISTORY
// ---------------------------------------------------------

fn current_time_ms() -> Result<u64, String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;

    Ok(duration.as_millis() as u64)
}

fn sanitize_path_part(
    value: &str,
) -> String {
    let cleaned: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
            {
                character
            } else {
                '_'
            }
        })
        .collect();

    if cleaned.is_empty() {
        "unknown".to_string()
    } else {
        cleaned
    }
}

fn chat_history_root(
    app: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    let mut path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    path.push("chat_history");

    fs::create_dir_all(&path)
        .map_err(|error| error.to_string())?;

    Ok(path)
}

fn channel_history_file(
    app: &tauri::AppHandle,
    platform: &str,
    channel: &str,
) -> Result<PathBuf, String> {
    let mut path =
        chat_history_root(app)?;

    path.push(
        sanitize_path_part(
            &platform.to_lowercase(),
        ),
    );

    path.push(
        sanitize_path_part(
            &channel.to_lowercase(),
        ),
    );

    fs::create_dir_all(&path)
        .map_err(|error| error.to_string())?;

    path.push("recent_chat.log");

    Ok(path)
}

fn parse_history_line(
    line: &str,
) -> Option<(u64, String)> {
    let (timestamp, payload) =
        line.split_once('\t')?;

    let timestamp_ms =
        timestamp.parse::<u64>().ok()?;

    Some((
        timestamp_ms,
        payload.to_string(),
    ))
}

fn load_valid_history_lines(
    file_path: &Path,
    max_age_ms: Option<u64>,
) -> Result<Vec<(u64, String)>, String> {
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let file =
        File::open(file_path)
            .map_err(
                |error|
                    error.to_string()
            )?;

    let reader =
        BufReader::new(file);

    let now =
        current_time_ms()?;

    let cutoff = history_cutoff(now, max_age_ms);

    let mut valid =
        Vec::new();

    for line_result in reader.lines() {
        let line =
            match line_result {
                Ok(line) => line,
                Err(_) => continue,
            };

        let Some(
            (
                timestamp_ms,
                payload,
            )
        ) = parse_history_line(
            &line
        )
        else {
            continue;
        };

        if timestamp_ms >= cutoff
            && timestamp_ms <= now
        {
            valid.push((
                timestamp_ms,
                payload,
            ));
        }
    }

    Ok(valid)
}

fn rewrite_history_file(
    file_path: &Path,
    messages: &[(u64, String)],
) -> Result<(), String> {
    if messages.is_empty() {
        if file_path.exists() {
            let _ =
                fs::remove_file(
                    file_path
                );
        }

        return Ok(());
    }

    let mut file =
        File::create(file_path)
            .map_err(
                |error|
                    error.to_string()
            )?;

    for (
        timestamp_ms,
        payload,
    ) in messages
    {
        writeln!(
            file,
            "{}\t{}",
            timestamp_ms,
            payload
        )
        .map_err(
            |error|
                error.to_string()
        )?;
    }

    Ok(())
}

fn clean_single_history_file(
    file_path: &Path,
    max_age_ms: Option<u64>,
) -> Result<(), String> {
    let valid =
        load_valid_history_lines(
            file_path,
            max_age_ms,
        )?;

    rewrite_history_file(
        file_path,
        &valid,
    )
}

fn clean_history_directory(
    directory: &Path,
    max_age_ms: Option<u64>,
) -> Result<(), String> {
    if !directory.exists() {
        return Ok(());
    }

    for entry_result in
        fs::read_dir(directory)
            .map_err(
                |error|
                    error.to_string()
            )?
    {
        let entry =
            match entry_result {
                Ok(entry) => entry,
                Err(_) => continue,
            };

        let path =
            entry.path();

        if path.is_dir() {
            clean_history_directory(
                &path,
                max_age_ms,
            )?;

            let is_empty =
                fs::read_dir(&path)
                    .map(
                        |mut entries|
                            entries.next()
                                .is_none()
                    )
                    .unwrap_or(false);

            if is_empty {
                let _ =
                    fs::remove_dir(
                        &path
                    );
            }

            continue;
        }

        if path
            .file_name()
            .and_then(
                |name|
                    name.to_str()
            )
            == Some(
                "recent_chat.log"
            )
        {
            clean_single_history_file(
                &path,
                max_age_ms,
            )?;
        }
    }

    Ok(())
}

#[tauri::command]
fn save_chat_message(
    app: tauri::AppHandle,
    platform: String,
    channel: String,
    timestamp_ms: u64,
    payload_json: String,
    max_age_ms: Option<u64>,
) -> Result<(), String> {
    let now =
        current_time_ms()?;

    let cutoff = history_cutoff(now, max_age_ms);

    // Ikke lagre meldinger som allerede er eldre enn valgt periode.
    if timestamp_ms < cutoff {
        return Ok(());
    }

    let file_path =
        channel_history_file(
            &app,
            &platform,
            &channel,
        )?;

    let mut file =
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(
                |error|
                    error.to_string()
            )?;

    writeln!(
        file,
        "{}\t{}",
        timestamp_ms,
        payload_json
    )
    .map_err(
        |error|
            error.to_string()
    )?;

    Ok(())
}

#[tauri::command]
fn load_chat_history(
    app: tauri::AppHandle,
    platform: String,
    channel: String,
    max_age_ms: Option<u64>,
) -> Result<Vec<String>, String> {
    let file_path =
        channel_history_file(
            &app,
            &platform,
            &channel,
        )?;

    let valid =
        load_valid_history_lines(
            &file_path,
            max_age_ms,
        )?;

    // Når chatten åpnes rydder vi samtidig fysisk bort alt eldre enn valgt periode.
    rewrite_history_file(
        &file_path,
        &valid,
    )?;

    Ok(
        valid
            .into_iter()
            .map(
                |(_, payload)|
                    payload
            )
            .collect()
    )
}

#[tauri::command]
fn cleanup_chat_history(
    app: tauri::AppHandle,
    max_age_ms: Option<u64>,
) -> Result<(), String> {
    let root =
        chat_history_root(
            &app
        )?;

    clean_history_directory(
        &root,
        max_age_ms,
    )
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchHistoryRow {
    platform: String,
    channel: String,
    timestamp_ms: u64,
    payload_json: String,
}

// A bounded, read-only snapshot of the existing history, never a second database.
fn collect_search_history(root: &Path, now: u64, limit: usize, max_age_ms: Option<u64>) -> Result<Vec<SearchHistoryRow>, String> {
    use std::cmp::Reverse;
    use std::collections::BinaryHeap;
    let cutoff = history_cutoff(now, max_age_ms);
    let mut latest = BinaryHeap::new();
    for platform in ["twitch", "kick", "youtube"] {
        let directory = root.join(platform);
        if !directory.exists() { continue; }
        if fs::symlink_metadata(&directory).map_err(|e| e.to_string())?.file_type().is_symlink() { continue; }
        for entry in fs::read_dir(&directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() { continue; }
            let path = entry.path().join("recent_chat.log");
            if !path.exists() { continue; }
            if fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_symlink() { continue; }
            let file = match File::open(path) { Ok(file) => file, Err(_) => continue };
            let channel = entry.file_name().to_string_lossy().into_owned();
            for line in BufReader::new(file).lines().map_while(Result::ok) {
                if line.len() > 16_384 { continue; }
                let Some((timestamp, payload)) = parse_history_line(&line) else { continue; };
                if timestamp < cutoff || timestamp > now { continue; }
                let Ok(value) = serde_json::from_str::<serde_json::Value>(&payload) else { continue; };
                if value.get("kind").and_then(|v| v.as_str()) != Some("chat") { continue; }
                latest.push(Reverse((timestamp, platform.to_string(), channel.clone(), payload)));
                if latest.len() > limit { latest.pop(); }
            }
        }
    }
    let mut rows: Vec<_> = latest.into_iter().map(|Reverse((timestamp_ms, platform, channel, payload_json))| SearchHistoryRow { timestamp_ms, platform, channel, payload_json }).collect();
    rows.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
    Ok(rows)
}

#[tauri::command]
async fn load_search_chat_history(app: tauri::AppHandle, max_age_ms: Option<u64>) -> Result<Vec<SearchHistoryRow>, String> {
    let root = chat_history_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || collect_search_history(&root, current_time_ms()?, 5000, max_age_ms))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn check_chat_history_storage(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let root =
        chat_history_root(
            &app
        )?;

    let marker =
        root.join(
            ".fyflate-storage-check"
        );

    {
        let mut file =
            OpenOptions::new()
                .create(true)
                .truncate(true)
                .write(true)
                .open(&marker)
                .map_err(
                    |error|
                        error.to_string()
                )?;

        file.write_all(
            b"ok"
        )
        .map_err(
            |error|
                error.to_string()
        )?;
    }

    let readable =
        fs::read_to_string(
            &marker
        )
        .map(
            |value|
                value == "ok"
        )
        .map_err(
            |error|
                error.to_string()
        );

    let _ =
        fs::remove_file(
            &marker
        );

    readable
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatHistoryStorageEntry {
    platform: String,
    channel: String,
    bytes: u64,
    message_count: u64,
}

#[tauri::command]
fn list_chat_history_storage(
    app: tauri::AppHandle,
) -> Result<Vec<ChatHistoryStorageEntry>, String> {
    let root = chat_history_root(&app)?;
    let mut result = Vec::new();

    for platform_entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let platform_entry = match platform_entry { Ok(entry) => entry, Err(_) => continue };
        let platform_path = platform_entry.path();
        if !platform_entry.file_type().map_err(|error| error.to_string())?.is_dir() { continue; }
        if fs::symlink_metadata(&platform_path).map_err(|error| error.to_string())?.file_type().is_symlink() { continue; }
        let platform = platform_entry.file_name().to_string_lossy().into_owned();

        for channel_entry in fs::read_dir(&platform_path).map_err(|error| error.to_string())? {
            let channel_entry = match channel_entry { Ok(entry) => entry, Err(_) => continue };
            let channel_path = channel_entry.path();
            if !channel_entry.file_type().map_err(|error| error.to_string())?.is_dir() { continue; }
            if fs::symlink_metadata(&channel_path).map_err(|error| error.to_string())?.file_type().is_symlink() { continue; }
            let file_path = channel_path.join("recent_chat.log");
            if !file_path.exists() { continue; }
            if fs::symlink_metadata(&file_path).map_err(|error| error.to_string())?.file_type().is_symlink() { continue; }

            let bytes = fs::metadata(&file_path).map(|metadata| metadata.len()).unwrap_or(0);
            let message_count = File::open(&file_path)
                .map(BufReader::new)
                .map(|reader| reader.lines().map_while(Result::ok).filter(|line| parse_history_line(line).is_some()).count() as u64)
                .unwrap_or(0);

            result.push(ChatHistoryStorageEntry {
                platform: platform.clone(),
                channel: channel_entry.file_name().to_string_lossy().into_owned(),
                bytes,
                message_count,
            });
        }
    }

    result.sort_by(|left, right| right.bytes.cmp(&left.bytes));
    Ok(result)
}

#[tauri::command]
fn clear_all_chat_history(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let root = chat_history_root(&app)?;
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = match entry { Ok(entry) => entry, Err(_) => continue };
        let path = entry.path();
        if fs::symlink_metadata(&path).map_err(|error| error.to_string())?.file_type().is_symlink() { continue; }
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
        } else if path.file_name().and_then(|name| name.to_str()) != Some(".fyflate-storage-check") {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn clear_channel_chat_history(
    app: tauri::AppHandle,
    platform: String,
    channel: String,
) -> Result<(), String> {
    let file_path =
        channel_history_file(
            &app,
            &platform,
            &channel,
        )?;

    if file_path.exists() {
        fs::remove_file(
            file_path
        )
        .map_err(
            |error|
                error.to_string()
        )?;
    }

    Ok(())
}


// ---------------------------------------------------------
// YOUTUBE LIVE CHAT STREAM (gRPC streamList)
// ---------------------------------------------------------

fn youtube_message_type_name(
    value: i32,
) -> &'static str {
    match value {
        1 => "textMessageEvent",
        2 => "tombstone",
        3 => "fanFundingEvent",
        4 => "chatEndedEvent",
        5 => "sponsorOnlyModeStartedEvent",
        6 => "sponsorOnlyModeEndedEvent",
        7 => "newSponsorEvent",
        10 => "userBannedEvent",
        15 => "superChatEvent",
        16 => "superStickerEvent",
        17 => "memberMilestoneChatEvent",
        18 => "membershipGiftingEvent",
        19 => "giftMembershipReceivedEvent",
        20 => "pollEvent",
        21 => "giftEvent",
        _ => "unknown",
    }
}

fn youtube_stream_payload_json(
    response:
        youtube_live_chat::LiveChatMessageListResponse,
) -> String {
    let items =
        response
            .items
            .into_iter()
            .map(
                |item| {
                    let snippet =
                        item.snippet.map(
                            |snippet| {
                                serde_json::json!({
                                    "type":
                                        youtube_message_type_name(
                                            snippet.r#type.unwrap_or(0)
                                        ),
                                    "liveChatId":
                                        snippet.live_chat_id.unwrap_or_default(),
                                    "authorChannelId":
                                        snippet.author_channel_id.unwrap_or_default(),
                                    "publishedAt":
                                        snippet.published_at.unwrap_or_default(),
                                    "displayMessage":
                                        snippet.display_message.unwrap_or_default(),
                                    "textMessageDetails":
                                        snippet.text_message_details.map(
                                            |details| {
                                                serde_json::json!({
                                                    "messageText":
                                                        details.message_text.unwrap_or_default(),
                                                })
                                            }
                                        ),
                                })
                            }
                        );

                    let author_details =
                        item.author_details.map(
                            |author| {
                                serde_json::json!({
                                    "channelId":
                                        author.channel_id.unwrap_or_default(),
                                    "channelUrl":
                                        author.channel_url.unwrap_or_default(),
                                    "displayName":
                                        author.display_name.unwrap_or_default(),
                                    "profileImageUrl":
                                        author.profile_image_url.unwrap_or_default(),
                                    "isVerified":
                                        author.is_verified.unwrap_or(false),
                                    "isChatOwner":
                                        author.is_chat_owner.unwrap_or(false),
                                    "isChatSponsor":
                                        author.is_chat_sponsor.unwrap_or(false),
                                    "isChatModerator":
                                        author.is_chat_moderator.unwrap_or(false),
                                })
                            }
                        );

                    serde_json::json!({
                        "id":
                            item.id.unwrap_or_default(),
                        "snippet":
                            snippet,
                        "authorDetails":
                            author_details,
                    })
                }
            )
            .collect::<Vec<_>>();

    serde_json::json!({
        "nextPageToken":
            response.next_page_token.unwrap_or_default(),
        "offlineAt":
            response.offline_at.unwrap_or_default(),
        "items":
            items,
    })
    .to_string()
}

fn emit_youtube_stream_error(
    app: &tauri::AppHandle,
    tab_id: &str,
    generation: u64,
    message: String,
) {
    let _ =
        app.emit(
            "youtube-livechat-stream-error",
            vec![
                tab_id.to_string(),
                generation.to_string(),
                message,
            ],
        );
}

fn emit_youtube_stream_status(
    app: &tauri::AppHandle,
    tab_id: &str,
    generation: u64,
    last_status: &mut Option<&'static str>,
    status: &'static str,
) {
    if *last_status == Some(status) ||
        !youtube_stream_is_current(
            tab_id,
            generation,
        )
    {
        return;
    }

    *last_status =
        Some(status);

    let _ =
        app.emit(
            "youtube-livechat-stream-status",
            vec![
                tab_id.to_string(),
                generation.to_string(),
                status.to_string(),
            ],
        );
}

async fn run_youtube_chat_stream(
    app: tauri::AppHandle,
    tab_id: String,
    live_chat_id: String,
    access_token: String,
    generation: u64,
    initial_page_token: String,
) {
    use tonic::transport::{
        Channel,
        ClientTlsConfig,
    };

    use youtube_live_chat::{
        v3_data_live_chat_message_service_client::
            V3DataLiveChatMessageServiceClient,
        LiveChatMessageListRequest,
    };

    let mut last_status =
        None;

    emit_youtube_stream_status(
        &app,
        &tab_id,
        generation,
        &mut last_status,
        "connecting",
    );

    let endpoint =
        match Channel::from_static(
            "https://youtube.googleapis.com"
        )
        .tls_config(
            ClientTlsConfig::new()
                .with_webpki_roots()
        ) {
            Ok(endpoint) =>
                endpoint
                    .http2_keep_alive_interval(
                        Duration::from_secs(30)
                    )
                    .keep_alive_timeout(
                        Duration::from_secs(10)
                    )
                    .keep_alive_while_idle(
                        true
                    ),
            Err(error) => {
                emit_youtube_stream_error(
                    &app,
                    &tab_id,
                    generation,
                    format!(
                        "YOUTUBE_STREAM_TLS: {error}"
                    ),
                );
                return;
            }
        };

    let channel =
        match endpoint.connect().await {
            Ok(channel) =>
                channel,
            Err(error) => {
                emit_youtube_stream_error(
                    &app,
                    &tab_id,
                    generation,
                    format!(
                        "YOUTUBE_STREAM_CONNECT: {error}"
                    ),
                );
                return;
            }
        };

    let mut client =
        V3DataLiveChatMessageServiceClient::new(
            channel
        );

    let mut page_token =
        initial_page_token;

    let mut reconnect_attempt:
        u32 = 0;

    loop {
        if !youtube_stream_is_current(
            &tab_id,
            generation,
        ) {
            return;
        }

        let request_message =
            LiveChatMessageListRequest {
                live_chat_id:
                    Some(
                        live_chat_id.clone()
                    ),
                hl:
                    None,
                profile_image_size:
                    Some(48),
                max_results:
                    None,
                page_token:
                    if page_token.is_empty() {
                        None
                    } else {
                        Some(
                            page_token.clone()
                        )
                    },
                part:
                    vec![
                        "id".to_string(),
                        "snippet".to_string(),
                        "authorDetails".to_string(),
                    ],
            };

        let mut request =
            tonic::Request::new(
                request_message
            );

        let auth =
            match format!(
                "Bearer {}",
                access_token
            )
            .parse() {
                Ok(value) =>
                    value,
                Err(error) => {
                    emit_youtube_stream_error(
                        &app,
                        &tab_id,
                        generation,
                        format!(
                            "YOUTUBE_STREAM_AUTH_HEADER: {error}"
                        ),
                    );
                    return;
                }
            };

        request.metadata_mut().insert(
            "authorization",
            auth,
        );

        let _ =
            app.emit(
                "youtube-quota-consumed",
                vec![
                    "1".to_string(),
                    "liveChatMessages.streamList".to_string(),
                ],
            );

        let response =
            client
                .stream_list(
                    request
                )
                .await;

        let mut stream =
            match response {
                Ok(response) => {
                    emit_youtube_stream_status(
                        &app,
                        &tab_id,
                        generation,
                        &mut last_status,
                        "connected",
                    );
                    response.into_inner()
                }
                Err(status) => {
                    let code =
                        status.code();

                    if code ==
                        tonic::Code::Unauthenticated
                    {
                        emit_youtube_stream_error(
                            &app,
                            &tab_id,
                            generation,
                            format!(
                                "AUTH_EXPIRED: {}",
                                status.message()
                            ),
                        );
                        return;
                    }

                    if matches!(
                        code,
                        tonic::Code::Unavailable
                            | tonic::Code::DeadlineExceeded
                            | tonic::Code::Internal
                            | tonic::Code::Unknown
                    ) {
                        emit_youtube_stream_status(
                            &app,
                            &tab_id,
                            generation,
                            &mut last_status,
                            "reconnecting",
                        );

                        reconnect_attempt =
                            reconnect_attempt
                                .saturating_add(1);

                        let delay_ms =
                            1_000_u64
                                .saturating_mul(
                                    1_u64 << reconnect_attempt
                                        .saturating_sub(1)
                                        .min(5)
                                )
                                .min(30_000);

                        let _ =
                            tauri::async_runtime::spawn_blocking(
                                move || {
                                    std::thread::sleep(
                                        Duration::from_millis(
                                            delay_ms
                                        )
                                    );
                                }
                            )
                            .await;

                        continue;
                    }

                    emit_youtube_stream_error(
                        &app,
                        &tab_id,
                        generation,
                        format!(
                            "YOUTUBE_STREAM_GRPC_{:?}: {}",
                            code,
                            status.message()
                        ),
                    );
                    return;
                }
            };

        loop {
            if !youtube_stream_is_current(
                &tab_id,
                generation,
            ) {
                return;
            }

            match stream.message().await {
                Ok(Some(response)) => {
                    reconnect_attempt =
                        0;

                    if let Some(
                        next
                    ) =
                        response.next_page_token
                            .clone()
                    {
                        if !next.is_empty() {
                            page_token =
                                next;
                        }
                    }

                    let offline =
                        response.offline_at
                            .as_deref()
                            .map(
                                |value|
                                    !value.is_empty()
                            )
                            .unwrap_or(false);

                    let payload =
                        youtube_stream_payload_json(
                            response
                        );

                    let _ =
                        app.emit(
                            "youtube-livechat-stream",
                            vec![
                                tab_id.clone(),
                                generation.to_string(),
                                payload,
                            ],
                        );

                    if offline {
                        return;
                    }
                }

                Ok(None) => {
                    // Google can close a healthy stream. Reconnect using
                    // the last nextPageToken so no chat messages are lost.
                    break;
                }

                Err(status) => {
                    let code =
                        status.code();

                    if code ==
                        tonic::Code::Unauthenticated
                    {
                        emit_youtube_stream_error(
                            &app,
                            &tab_id,
                            generation,
                            format!(
                                "AUTH_EXPIRED: {}",
                                status.message()
                            ),
                        );
                        return;
                    }

                    if matches!(
                        code,
                        tonic::Code::Unavailable
                            | tonic::Code::DeadlineExceeded
                            | tonic::Code::Internal
                            | tonic::Code::Unknown
                    ) {
                        break;
                    }

                    emit_youtube_stream_error(
                        &app,
                        &tab_id,
                        generation,
                        format!(
                            "YOUTUBE_STREAM_GRPC_{:?}: {}",
                            code,
                            status.message()
                        ),
                    );
                    return;
                }
            }
        }

        if !youtube_stream_is_current(
            &tab_id,
            generation,
        ) {
            return;
        }

        emit_youtube_stream_status(
            &app,
            &tab_id,
            generation,
            &mut last_status,
            "reconnecting",
        );

        reconnect_attempt =
            reconnect_attempt
                .saturating_add(1);

        let delay_ms =
            750_u64
                .saturating_mul(
                    1_u64 << reconnect_attempt
                        .saturating_sub(1)
                        .min(5)
                )
                .min(30_000);

        // Gradual backoff protects against tight reconnect loops and quota churn.
        let _ =
            tauri::async_runtime::spawn_blocking(
                move || {
                    std::thread::sleep(
                        Duration::from_millis(
                            delay_ms
                        )
                    );
                }
            )
            .await;
    }
}

#[tauri::command]
fn start_youtube_chat_stream(
    app: tauri::AppHandle,
    tab_id: String,
    live_chat_id: String,
    access_token: String,
    generation: u64,
    page_token: Option<String>,
) -> Result<u64, String> {
    if tab_id.trim().is_empty() {
        return Err(
            "YouTube stream mangler tabId.".to_string()
        );
    }

    if live_chat_id.trim().is_empty() {
        return Err(
            "YouTube stream mangler liveChatId.".to_string()
        );
    }

    if access_token.trim().is_empty() {
        return Err(
            "YouTube stream mangler access token.".to_string()
        );
    }

    set_youtube_stream_generation(
        &tab_id,
        generation,
    );

    tauri::async_runtime::spawn(
        run_youtube_chat_stream(
            app,
            tab_id,
            live_chat_id,
            access_token,
            generation,
            page_token.unwrap_or_default(),
        )
    );

    Ok(generation)
}

#[tauri::command]
fn stop_youtube_chat_stream(
    tab_id: String,
) -> Result<(), String> {
    invalidate_youtube_stream(
        &tab_id
    );

    Ok(())
}


// ---------------------------------------------------------
// TEST COMMAND
// ---------------------------------------------------------

#[tauri::command]
fn greet(
    name: &str,
) -> String {
    format!(
        "Hello, {}! You've been greeted from Rust!",
        name
    )
}

#[tauri::command]
fn get_distribution_mode() -> String {
    std::env::current_exe()
        .ok()
        .map(|path| distribution_mode_for_executable(&path))
        .unwrap_or("installed")
        .to_string()
}

fn distribution_mode_for_executable(executable: &Path) -> &'static str {
    if executable
        .parent()
        .map(|parent| parent.join("FyFlade-portable.marker").is_file())
        .unwrap_or(false)
    {
        "portable"
    } else {
        "installed"
    }
}

#[cfg(test)]
mod distribution_mode_tests {
    use super::distribution_mode_for_executable;
    use std::fs;

    #[test]
    fn marker_switches_the_application_to_portable_mode() {
        let test_directory = std::env::temp_dir().join(format!(
            "fyflade-distribution-test-{}",
            std::process::id()
        ));
        let executable = test_directory.join("FyFlade.exe");
        fs::create_dir_all(&test_directory).expect("create test directory");

        assert_eq!(distribution_mode_for_executable(&executable), "installed");
        fs::write(test_directory.join("FyFlade-portable.marker"), "test")
            .expect("write marker");
        assert_eq!(distribution_mode_for_executable(&executable), "portable");

        fs::remove_dir_all(test_directory).expect("remove test directory");
    }
}

// ---------------------------------------------------------
// START FYFLADE
// ---------------------------------------------------------

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_updater::Builder::new().build()
        )
        .plugin(
            tauri_plugin_process::init()
        )
        .plugin(
            tauri_plugin_http::init()
        )
        .plugin(
            tauri_plugin_opener::init()
        )
        .invoke_handler(
            tauri::generate_handler![
                greet,
                get_distribution_mode,
                save_twitch_refresh_token,
                load_twitch_refresh_token,
                delete_twitch_refresh_token,
                save_youtube_refresh_token,
                load_youtube_refresh_token,
                delete_youtube_refresh_token,
                save_youtube_client_secret,
                load_youtube_client_secret,
                delete_youtube_client_secret,
                start_youtube_oauth_listener,
                start_youtube_chat_stream,
                stop_youtube_chat_stream,
                save_kick_refresh_token,
                load_kick_refresh_token,
                delete_kick_refresh_token,
                save_kick_client_secret,
                load_kick_client_secret,
                delete_kick_client_secret,
                start_kick_oauth_listener,
                start_kick_webhook_listener,
                sync_kick_viewer_channels,
                get_kick_webhook_tunnel_status,
                start_kick_webhook_tunnel,
                start_obs_dock_server,
                update_obs_dock_state,
                save_chat_message,
                load_chat_history,
                load_search_chat_history,
                cleanup_chat_history,
                check_chat_history_storage,
                list_chat_history_storage,
                clear_all_chat_history,
                clear_channel_chat_history,
                start_party_audio_capture,
                stop_party_audio_capture
            ],
        )
        .build(
            tauri::generate_context!()
        )
        .expect(
            "error while building tauri application"
        )
        .run(
            |_app_handle, event| {
                if let tauri::RunEvent::Exit = event {
                    stop_kick_webhook_tunnel();
                    let _ = stop_party_audio_capture();
                }
            }
        );
}
