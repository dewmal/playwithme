use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn ensure_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if !path.is_dir() {
        return Err("The selected presentation folder does not exist".into());
    }
    Ok(path)
}

#[tauri::command]
fn load_presentation(folder: String) -> Result<String, String> {
    let root = ensure_folder(&folder)?;
    fs::read_to_string(root.join("presentation.md"))
        .map_err(|e| format!("Could not read presentation.md: {e}"))
}

#[tauri::command]
fn load_drawings(folder: String) -> Result<Value, String> {
    let root = ensure_folder(&folder)?;
    let path = root.join("drawings").join("drawings.json");
    if !path.exists() {
        return Ok(Value::Array(vec![]));
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_presentation(folder: String, markdown: String) -> Result<(), String> {
    let root = ensure_folder(&folder)?;
    let presentation = root.join("presentation.md");
    if presentation.exists() {
        return Err("This folder already contains a presentation.md file".into());
    }
    fs::write(presentation, markdown)
        .map_err(|e| format!("Could not create presentation.md: {e}"))?;
    for directory in ["assets", "sessions", "exports", "drawings", "outputs"] {
        fs::create_dir_all(root.join(directory)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn save_presentation(
    folder: String,
    markdown: String,
    drawings: Value,
    outputs: Value,
) -> Result<(), String> {
    let root = ensure_folder(&folder)?;
    fs::write(root.join("presentation.md"), markdown).map_err(|e| e.to_string())?;
    let drawings_dir = root.join("drawings");
    fs::create_dir_all(&drawings_dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&drawings).map_err(|e| e.to_string())?;
    fs::write(drawings_dir.join("drawings.json"), json).map_err(|e| e.to_string())?;
    let outputs_dir = root.join("outputs");
    fs::create_dir_all(&outputs_dir).map_err(|e| e.to_string())?;
    if let Some(items) = outputs.as_object() {
        for (cell_id, output) in items {
            let safe_id: String = cell_id
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
                .collect();
            fs::write(
                outputs_dir.join(format!("{safe_id}.json")),
                serde_json::to_string_pretty(output).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn save_session(
    folder: String,
    session: Value,
    audio_bytes: Option<Vec<u8>>,
    video_bytes: Option<Vec<u8>>,
) -> Result<Option<String>, String> {
    let root = ensure_folder(&folder)?;
    let id = session
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Session has no id")?;
    if id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("Invalid session id".into());
    }
    let session_dir = root.join("sessions").join(id);
    let outputs_dir = session_dir.join("outputs");
    fs::create_dir_all(&outputs_dir).map_err(|e| e.to_string())?;
    fs::write(
        session_dir.join("session.json"),
        serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if let Some(drawings) = session.get("drawings") {
        fs::write(
            session_dir.join("drawings.json"),
            serde_json::to_string_pretty(drawings).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(outputs) = session.get("outputs").and_then(Value::as_object) {
        for (cell_id, output) in outputs {
            let safe_id: String = cell_id
                .chars()
                .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
                .collect();
            fs::write(
                outputs_dir.join(format!("{safe_id}.json")),
                serde_json::to_string_pretty(output).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if let Some(bytes) = audio_bytes {
        fs::write(session_dir.join("narration.webm"), bytes).map_err(|e| e.to_string())?;
    }
    let video_path = if let Some(bytes) = video_bytes {
        let capture = session_dir.join("capture.webm");
        fs::write(&capture, bytes).map_err(|e| e.to_string())?;
        let exports_dir = root.join("exports");
        fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;
        let output = exports_dir.join(format!("{id}.mp4"));
        run_ffmpeg(&capture, &output)?;
        Some(output.to_string_lossy().into_owned())
    } else {
        None
    };
    Ok(video_path)
}

fn run_ffmpeg(input: &Path, output: &Path) -> Result<(), String> {
    for program in ["ffmpeg", "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"] {
        let result = Command::new(program)
            .args(["-y", "-i"])
            .arg(input)
            .args([
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-movflags", "+faststart",
            ])
            .arg(output)
            .status();
        match result {
            Ok(status) if status.success() => return Ok(()),
            Ok(_) => return Err("FFmpeg failed to encode the recorded session".into()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(format!("FFmpeg could not start: {error}")),
        }
    }
    Err("FFmpeg was not found. Install FFmpeg and record the session again".into())
}

#[tauri::command]
fn write_binary(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = Path::new(&path);
    if target.extension().and_then(|value| value.to_str()) != Some("pdf") {
        return Err("Only PDF export is allowed".into());
    }
    fs::write(target, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_video(source: String, target: String) -> Result<(), String> {
    let source = PathBuf::from(source);
    let target = PathBuf::from(target);
    let is_mp4 = |path: &Path| path.extension().and_then(|value| value.to_str()).is_some_and(|value| value.eq_ignore_ascii_case("mp4"));
    if !source.is_file() || !is_mp4(&source) || !is_mp4(&target) {
        return Err("Expected an existing MP4 recording and an MP4 destination".into());
    }
    if source == target { return Ok(()); }
    fs::copy(source, target).map(|_| ()).map_err(|e| format!("Could not export the video: {e}"))
}

#[tauri::command]
fn transcode_video(input: String, output: String) -> Result<(), String> {
    let source = Path::new(&input);
    let target = Path::new(&output);
    if source.extension().and_then(|v| v.to_str()) != Some("webm")
        || target.extension().and_then(|v| v.to_str()) != Some("mp4")
    {
        return Err("Expected a WebM input and MP4 output".into());
    }
    run_ffmpeg(source, target)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_presentation,
            load_drawings,
            create_presentation,
            save_presentation,
            save_session,
            write_binary,
            copy_video,
            transcode_video
        ])
        .run(tauri::generate_context!())
        .expect("error while running Presenta");
}
