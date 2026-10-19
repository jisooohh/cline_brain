use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{ipc::Channel, State};

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TerminalEvent {
    Data { bytes: Vec<u8> },
    Exit { code: Option<u32> },
}
struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    pid: Option<u32>,
    exited: Arc<AtomicBool>,
}
impl Session {
    fn stop(&mut self) {
        if self.exited.load(Ordering::Acquire) {
            return;
        }
        #[cfg(unix)]
        if let Some(pid) = self.pid {
            unsafe {
                libc::kill(-(pid as i32), libc::SIGHUP);
            }
        }
        let _ = self.killer.kill();
    }
}
#[derive(Default)]
pub struct Terminals {
    sessions: Mutex<HashMap<u64, Session>>,
    seq: AtomicU64,
}
impl Terminals {
    pub fn stop_all(&self) {
        for (_, mut session) in self.sessions.lock().unwrap().drain() {
            session.stop();
        }
    }
}
fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.clamp(2, 500),
        cols: cols.clamp(2, 500),
        pixel_width: 0,
        pixel_height: 0,
    }
}
#[tauri::command]
pub fn terminal_start(
    state: State<'_, Terminals>,
    on_event: Channel<TerminalEvent>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<u64, String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.len() >= 8 {
        return Err("Close a terminal before opening another (maximum 8).".into());
    }
    let root = cwd.unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()));
    if !std::path::Path::new(&root).is_absolute() || !std::path::Path::new(&root).is_dir() {
        return Err("Select an existing absolute folder path.".into());
    }
    let pair = native_pty_system()
        .openpty(size(cols, rows))
        .map_err(|e| e.to_string())?;
    let shell = std::env::var("SHELL")
        .ok()
        .filter(|s| std::path::Path::new(s).is_absolute() && std::path::Path::new(s).is_file())
        .unwrap_or_else(|| "/bin/zsh".into());
    let mut command = CommandBuilder::new(shell);
    command.arg("-l");
    command.cwd(root);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    command.env("TERM_PROGRAM", "ClineBrain");
    // Match a normal user terminal; service credentials are never injected by the app.
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    let id = state.seq.fetch_add(1, Ordering::Relaxed) + 1;
    let exited = Arc::new(AtomicBool::new(false));
    sessions.insert(
        id,
        Session {
            master: pair.master,
            writer,
            killer: child.clone_killer(),
            pid: child.process_id(),
            exited: exited.clone(),
        },
    );
    std::thread::spawn(move || {
        let mut bytes = [0u8; 16384];
        loop {
            match reader.read(&mut bytes) {
                Ok(0) => break,
                Ok(n) => {
                    if on_event
                        .send(TerminalEvent::Data {
                            bytes: bytes[..n].to_vec(),
                        })
                        .is_err()
                    {
                        let _ = child.kill();
                        break;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
        let code = child.wait().ok().map(|s| s.exit_code());
        exited.store(true, Ordering::Release);
        let _ = on_event.send(TerminalEvent::Exit { code });
    });
    Ok(id)
}
#[tauri::command]
pub fn terminal_write(state: State<'_, Terminals>, id: u64, data: String) -> Result<(), String> {
    if data.len() > 1024 * 1024 {
        return Err("Paste exceeds 1 MB.".into());
    }
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions.get_mut(&id).ok_or("Terminal is closed")?;
    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn terminal_resize(
    state: State<'_, Terminals>,
    id: u64,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state
        .sessions
        .lock()
        .unwrap()
        .get(&id)
        .ok_or("Terminal is closed")?
        .master
        .resize(size(cols, rows))
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn terminal_close(state: State<'_, Terminals>, id: u64) {
    if let Some(mut session) = state.sessions.lock().unwrap().remove(&id) {
        session.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_pty_preserves_directory_unicode_and_size() {
        let pair = native_pty_system().openpty(size(91, 27)).unwrap();
        let mut command = CommandBuilder::new("/bin/zsh");
        command.args([
            "-f",
            "-c",
            "test -t 0 && cd /tmp && printf 'PTY_OK:한글\\n'; pwd; stty size",
        ]);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let mut output = String::new();
        let _ = reader.read_to_string(&mut output);
        assert!(child.wait().unwrap().success());
        assert!(output.contains("PTY_OK:한글"), "{output}");
        assert!(output.contains("/tmp"), "{output}");
        assert!(output.contains("27 91"), "{output}");
    }
}
