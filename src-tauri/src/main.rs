#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod terminal;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Manager, State};
use tokio::sync::oneshot;
struct Bridge {
    stdin: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    pending: Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>,
    seq: AtomicU64,
}
impl Bridge {
    fn new() -> Self {
        Self {
            stdin: Mutex::new(None),
            child: Mutex::new(None),
            pending: Mutex::new(HashMap::new()),
            seq: AtomicU64::new(1),
        }
    }
    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.seq.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id, tx);
        let line = serde_json::to_string(&json!({"id":id,"method":method,"params":params}))
            .map_err(|e| e.to_string())?;
        let result = {
            let mut input = self.stdin.lock().unwrap();
            match input.as_mut(){Some(s)=>writeln!(s,"{}",line).and_then(|_|s.flush()).map_err(|e|e.to_string()),None=>Err("Worker is not running. Set a Node 22+ executable in Connections, then restart the app.".into())}
        };
        if let Err(e) = result {
            self.pending.lock().unwrap().remove(&id);
            return Err(e);
        }
        match tokio::time::timeout(Duration::from_secs(180), rx).await {
            Ok(Ok(result)) => result,
            _ => {
                self.pending.lock().unwrap().remove(&id);
                Err("Worker request timed out. Check the connection and try again.".into())
            }
        }
    }
    fn stop(&self) {
        self.stdin.lock().unwrap().take();
        if let Some(mut c) = self.child.lock().unwrap().take() {
            for _ in 0..25 {
                if matches!(c.try_wait(), Ok(Some(_))) {
                    return;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}
fn secret(name: &str) -> Result<keyring::Entry, String> {
    if !["cline", "parallel", "composio"].contains(&name) {
        return Err("Unknown credential".into());
    }
    keyring::Entry::new("ai.clinebrain.desktop", name).map_err(|e| e.to_string())
}
fn secrets() -> Value {
    let mut m = serde_json::Map::new();
    for name in ["cline", "parallel", "composio"] {
        if let Ok(entry) = secret(name) {
            if let Ok(value) = entry.get_password() {
                m.insert(name.into(), Value::String(value));
            }
        }
    }
    Value::Object(m)
}
#[tauri::command]
async fn worker_request(
    bridge: State<'_, Arc<Bridge>>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let allowed = [
        "snapshot",
        "settings.save",
        "connections.probe",
        "connections.link",
        "brain.save",
        "run.start",
        "document.start",
        "run.cancel",
        "proposal.edit",
        "proposal.publish",
        "automation.save",
    ];
    if !allowed.contains(&method.as_str()) {
        return Err("Command not allowed".into());
    }
    bridge.request(&method, params).await
}
#[tauri::command]
async fn credential_save(
    bridge: State<'_, Arc<Bridge>>,
    name: String,
    value: String,
) -> Result<(), String> {
    let entry = secret(&name)?;
    if value.is_empty() {
        let _ = entry.delete_credential();
    } else {
        entry.set_password(&value).map_err(|e| e.to_string())?;
    }
    bridge
        .request("secrets.update", json!({name:value}))
        .await?;
    Ok(())
}
#[tauri::command]
async fn credential_status() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let s = secrets();
        json!({"cline":s.get("cline").is_some(),"parallel":s.get("parallel").is_some(),"composio":s.get("composio").is_some()})
    }).await.map_err(|e| e.to_string())
}
fn native_config(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap().join("native.json")
}
#[tauri::command]
fn native_paths(app: tauri::AppHandle) -> Value {
    let config = std::fs::read_to_string(native_config(&app))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or(json!({}));
    json!({"nodePath":config.get("nodePath").and_then(Value::as_str).map(String::from).or_else(find_node),"dataDir":app.path().app_data_dir().ok()})
}
#[tauri::command]
fn native_node_save(app: tauri::AppHandle, path: String) -> Result<(), String> {
    if !PathBuf::from(&path).is_absolute() {
        return Err("Choose an absolute executable path".into());
    }
    validate_node(&path)?;
    let dest = native_config(&app);
    std::fs::create_dir_all(dest.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(dest, json!({"nodePath":path}).to_string()).map_err(|e| e.to_string())
}
fn validate_node(path: &str) -> Result<(), String> {
    let out = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;
    let version = String::from_utf8_lossy(&out.stdout);
    let major = version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    if !out.status.success() || major < 22 {
        return Err("Node.js 22 or later is required".into());
    }
    Ok(())
}
fn find_node() -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut paths = vec![
        "/opt/homebrew/bin/node".to_string(),
        "/usr/local/bin/node".into(),
        format!("{home}/.proto/shims/node"),
    ];
    if let Ok(out) = Command::new("/bin/zsh")
        .args(["-lc", "command -v node"])
        .output()
    {
        paths.push(String::from_utf8_lossy(&out.stdout).trim().into());
    }
    paths
        .into_iter()
        .find(|p| !p.is_empty() && validate_node(p).is_ok())
}
fn launch(app: &tauri::AppHandle, bridge: Arc<Bridge>) -> Result<(), String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let cfg = std::fs::read_to_string(native_config(app))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok());
    let node = cfg
        .as_ref()
        .and_then(|v| v.get("nodePath"))
        .and_then(Value::as_str)
        .map(String::from)
        .or_else(find_node)
        .ok_or("Node.js 22+ not found. Configure it in Connections.")?;
    let script = if cfg!(debug_assertions) {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/worker.cjs")
    } else {
        app.path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("resources/worker.cjs")
    };
    let mut child = Command::new(&node)
        .arg("--disable-warning=ExperimentalWarning")
        .arg(&script)
        .arg(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Cannot start Node worker: {e}"))?;
    *bridge.stdin.lock().unwrap() = child.stdin.take();
    let stdout = child.stdout.take().unwrap();
    *bridge.child.lock().unwrap() = Some(child);
    let app_handle = app.clone();
    let b = bridge.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(v) = serde_json::from_str::<Value>(&line) {
                if let Some(id) = v.get("id").and_then(Value::as_u64) {
                    if let Some(tx) = b.pending.lock().unwrap().remove(&id) {
                        let result = match v.get("error").and_then(Value::as_str) {
                            Some(e) => Err(e.to_owned()),
                            None => Ok(v.get("result").cloned().unwrap_or(Value::Null)),
                        };
                        let _ = tx.send(result);
                    }
                } else {
                    let _ = app_handle.emit("brain-event", v);
                }
            }
        }
        for (_, tx) in b.pending.lock().unwrap().drain() {
            let _ = tx.send(Err("Worker stopped unexpectedly. Restart the app.".into()));
        }
        let _ = app_handle.emit(
            "brain-event",
            json!({"type":"worker-error","message":"Worker stopped. Restart the app."}),
        );
    });
    let b = bridge.clone();
    tauri::async_runtime::spawn(async move {
        let _ = b.request("init", json!({"secrets":secrets()})).await;
    });
    Ok(())
}
fn main() {
    let bridge = Arc::new(Bridge::new());
    let b = bridge.clone();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(bridge)
        .manage(terminal::Terminals::default())
        .invoke_handler(tauri::generate_handler![
            worker_request,
            credential_save,
            credential_status,
            native_paths,
            native_node_save,
            terminal::terminal_start,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close
        ])
        .setup(move |app| {
            if let Err(e) = launch(app.handle(), b.clone()) {
                eprintln!("{e}");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to build ClineBrain");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            handle.state::<terminal::Terminals>().stop_all();
            handle.state::<Arc<Bridge>>().stop();
        }
    });
}
