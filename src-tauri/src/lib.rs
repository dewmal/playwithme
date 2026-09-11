use serde_json::{Map, Value, json};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::Manager;

const APP_DIRECTORY: &str = ".presenta";

fn ensure_app_layout(app: &Path, root: &Path) -> Result<PathBuf, String> {
    for directory in ["outputs", "sessions", "exports"] {
        fs::create_dir_all(app.join(directory)).map_err(|e| e.to_string())?;
    }
    let settings = app.join("settings.json");
    if !settings.exists() {
        fs::write(
            settings,
            serde_json::to_string_pretty(&json!({
                "formatVersion": 1,
                "project": root.to_string_lossy(),
                "presentation": "presentation.md",
                "assets": "assets"
            }))
            .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(app.to_path_buf())
}

fn ensure_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if !path.is_dir() {
        return Err("The selected presentation folder does not exist".into());
    }
    Ok(path)
}

fn validate_presentation_file(presentation_file: &str) -> Result<&str, String> {
    let path = Path::new(presentation_file);
    let is_safe_relative_path = !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    let is_markdown = path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case("md"));
    if presentation_file.is_empty() || !is_safe_relative_path || !is_markdown {
        return Err(
            "Presentation files must be safe Markdown paths inside the project folder".into(),
        );
    }
    Ok(presentation_file)
}

fn presentation_state_folder(settings: &Path, presentation_file: &str) -> PathBuf {
    if presentation_file == "presentation.md" {
        settings.to_path_buf()
    } else {
        settings.join("presentations").join(presentation_file)
    }
}

fn settings_path(settings_folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(settings_folder);
    if settings_folder.trim().is_empty() || !path.is_absolute() {
        return Err("The project settings location must be an absolute path".into());
    }
    Ok(path)
}

fn project_storage_name(root: &Path) -> String {
    let name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("project");
    let safe: String = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    let mut hasher = DefaultHasher::new();
    root.to_string_lossy().hash(&mut hasher);
    format!("{}-{:016x}", safe.trim_matches('-'), hasher.finish())
}

fn home_settings_folder() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .ok_or("Could not determine the user home folder")?;
    Ok(PathBuf::from(home).join(APP_DIRECTORY))
}

#[tauri::command]
fn settings_home_folder() -> Result<String, String> {
    Ok(home_settings_folder()?.to_string_lossy().into_owned())
}

#[tauri::command]
fn settings_cache_folder(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_cache_dir()
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn resolve_settings_folder(
    app: tauri::AppHandle,
    folder: String,
    mode: String,
    custom_root: Option<String>,
) -> Result<String, String> {
    let root = ensure_folder(&folder)?;
    let settings = match mode.as_str() {
        "project" => root.join(APP_DIRECTORY),
        "home" => home_settings_folder()?
            .join("projects")
            .join(project_storage_name(&root)),
        "cache" => app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("projects")
            .join(project_storage_name(&root)),
        "custom" => {
            let base = custom_root
                .filter(|value| !value.trim().is_empty())
                .ok_or("Choose a custom settings folder")?;
            let base = PathBuf::from(base);
            if !base.is_absolute() {
                return Err("The custom settings folder must be an absolute path".into());
            }
            base.join("projects").join(project_storage_name(&root))
        }
        _ => return Err("Unknown project settings location".into()),
    };
    Ok(settings.to_string_lossy().into_owned())
}

fn collect_presentations(
    root: &Path,
    directory: &Path,
    presentations: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if file_type.is_dir() {
            if !name.starts_with('.') && name != "node_modules" {
                collect_presentations(root, &entry.path(), presentations)?;
            }
            continue;
        }
        let path = entry.path();
        let is_markdown = path
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("md"));
        if !file_type.is_file() || !is_markdown {
            continue;
        }
        let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;
        let relative = relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        presentations.push(relative);
    }
    Ok(())
}

#[tauri::command]
fn list_presentations(folder: String) -> Result<Vec<String>, String> {
    let root = ensure_folder(&folder)?;
    let mut presentations = Vec::new();
    collect_presentations(&root, &root, &mut presentations)?;
    presentations.sort_by_key(|name| (name != "presentation.md", name.to_lowercase()));
    Ok(presentations)
}

#[tauri::command]
fn load_presentation(folder: String, presentation_file: String) -> Result<String, String> {
    let root = ensure_folder(&folder)?;
    let name = validate_presentation_file(&presentation_file)?;
    fs::read_to_string(root.join(name)).map_err(|e| format!("Could not read {name}: {e}"))
}

#[tauri::command]
fn load_project_image(folder: String, source: String) -> Result<Vec<u8>, String> {
    let root = ensure_folder(&folder)?
        .canonicalize()
        .map_err(|e| format!("Could not resolve the presentation folder: {e}"))?;
    let relative = Path::new(&source);
    let is_safe_relative_path = !relative.as_os_str().is_empty()
        && !relative.is_absolute()
        && relative
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    let is_image = relative
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "avif" | "gif" | "jpeg" | "jpg" | "png" | "svg" | "webp"
            )
        });
    if !is_safe_relative_path || !is_image {
        return Err("Images must be safe relative paths inside the presentation project".into());
    }
    let image = root
        .join(relative)
        .canonicalize()
        .map_err(|e| format!("Could not resolve image {source}: {e}"))?;
    if !image.starts_with(&root) || !image.is_file() {
        return Err("The image must be a file inside the presentation project".into());
    }
    fs::read(image).map_err(|e| format!("Could not read image {source}: {e}"))
}

#[tauri::command]
fn load_drawings(
    folder: String,
    settings_folder: String,
    presentation_file: String,
) -> Result<Value, String> {
    let root = ensure_folder(&folder)?;
    let settings = settings_path(&settings_folder)?;
    let name = validate_presentation_file(&presentation_file)?;
    let current = presentation_state_folder(&settings, name).join("drawings.json");
    let project_local =
        presentation_state_folder(&root.join(APP_DIRECTORY), name).join("drawings.json");
    let legacy = root.join("drawings").join("drawings.json");
    let path = if current.exists() {
        current
    } else if project_local.exists() {
        project_local
    } else {
        legacy
    };
    if !path.exists() {
        return Ok(Value::Array(vec![]));
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_outputs(
    folder: String,
    settings_folder: String,
    presentation_file: String,
) -> Result<Value, String> {
    let root = ensure_folder(&folder)?;
    let settings = settings_path(&settings_folder)?;
    let name = validate_presentation_file(&presentation_file)?;
    let current = presentation_state_folder(&settings, name).join("outputs");
    let project_local = presentation_state_folder(&root.join(APP_DIRECTORY), name).join("outputs");
    let legacy = root.join("outputs");
    let directory = if current.is_dir() {
        current
    } else if project_local.is_dir() {
        project_local
    } else {
        legacy
    };
    if !directory.is_dir() {
        return Ok(Value::Object(Map::new()));
    }

    let mut outputs = Map::new();
    for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let output: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
        let id = output
            .get("cellId")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .or_else(|| {
                path.file_stem()
                    .and_then(|value| value.to_str())
                    .map(str::to_owned)
            });
        if let Some(id) = id {
            outputs.insert(id, output);
        }
    }
    Ok(Value::Object(outputs))
}

#[tauri::command]
fn create_presentation(
    folder: String,
    settings_folder: String,
    presentation_file: String,
    markdown: String,
) -> Result<(), String> {
    let root = ensure_folder(&folder)?;
    let settings = settings_path(&settings_folder)?;
    let name = validate_presentation_file(&presentation_file)?;
    let presentation = root.join(name);
    if presentation.exists() {
        return Err(format!("This project already contains {name}"));
    }
    fs::write(presentation, markdown).map_err(|e| format!("Could not create {name}: {e}"))?;
    fs::create_dir_all(root.join("assets")).map_err(|e| e.to_string())?;
    ensure_app_layout(&settings, &root)?;
    Ok(())
}

#[tauri::command]
fn save_presentation(
    folder: String,
    settings_folder: String,
    presentation_file: String,
    markdown: String,
    drawings: Value,
    outputs: Value,
) -> Result<(), String> {
    let root = ensure_folder(&folder)?;
    let settings = settings_path(&settings_folder)?;
    let name = validate_presentation_file(&presentation_file)?;
    fs::write(root.join(name), markdown).map_err(|e| e.to_string())?;
    ensure_app_layout(&settings, &root)?;
    let app = presentation_state_folder(&settings, name);
    fs::create_dir_all(&app).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&drawings).map_err(|e| e.to_string())?;
    fs::write(app.join("drawings.json"), json).map_err(|e| e.to_string())?;
    let outputs_dir = app.join("outputs");
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
    settings_folder: String,
    presentation_file: Option<String>,
    session: Value,
    audio_bytes: Option<Vec<u8>>,
    video_bytes: Option<Vec<u8>>,
) -> Result<Option<String>, String> {
    let root = ensure_folder(&folder)?;
    let settings = settings_path(&settings_folder)?;
    if let Some(name) = presentation_file.as_deref() {
        validate_presentation_file(name)?;
    }
    let id = session
        .get("id")
        .and_then(Value::as_str)
        .ok_or("Session has no id")?;
    if id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("Invalid session id".into());
    }
    let app = ensure_app_layout(&settings, &root)?;
    let session_dir = app.join("sessions").join(id);
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
        let exports_dir = app.join("exports");
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
    for program in [
        "ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ] {
        let result = Command::new(program)
            .args(["-y", "-i"])
            .arg(input)
            .args([
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
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

fn recording_timeline_path(settings: &Path, presentation_file: &str) -> PathBuf {
    presentation_state_folder(settings, presentation_file).join("recording-timeline.json")
}

#[tauri::command]
fn load_recording_timeline(
    settings_folder: String,
    presentation_file: String,
) -> Result<Value, String> {
    validate_presentation_file(&presentation_file)?;
    let settings = settings_path(&settings_folder)?;
    let path = recording_timeline_path(&settings, &presentation_file);
    if !path.exists() {
        return Ok(Value::Null);
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_recording_timeline(
    settings_folder: String,
    presentation_file: String,
    timeline: Value,
) -> Result<(), String> {
    validate_presentation_file(&presentation_file)?;
    if !timeline.is_object() {
        return Err("The recording timeline is invalid".into());
    }
    let settings = settings_path(&settings_folder)?;
    let path = recording_timeline_path(&settings, &presentation_file);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        path,
        serde_json::to_string_pretty(&timeline).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn validated_recording_path(exports: &Path, value: &str) -> Result<PathBuf, String> {
    let allowed_root = exports.canonicalize().map_err(|error| error.to_string())?;
    let path = PathBuf::from(value)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let is_mp4 = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("mp4"));
    if !path.starts_with(allowed_root) || !is_mp4 {
        return Err("The recording is outside this project's exports folder".into());
    }
    Ok(path)
}

#[tauri::command]
fn load_recording_video(
    settings_folder: String,
    video_path: String,
) -> Result<tauri::ipc::Response, String> {
    let settings = settings_path(&settings_folder)?;
    let path = validated_recording_path(&settings.join("exports"), &video_path)?;
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn clear_recording_timeline(
    settings_folder: String,
    presentation_file: String,
) -> Result<(), String> {
    validate_presentation_file(&presentation_file)?;
    let settings = settings_path(&settings_folder)?;
    let manifest_path = recording_timeline_path(&settings, &presentation_file);
    if !manifest_path.exists() {
        return Ok(());
    }
    let manifest: Value = serde_json::from_str(
        &fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let exports = settings.join("exports");
    if let Some(files) = manifest.get("recordingFiles").and_then(Value::as_array) {
        for value in files.iter().filter_map(Value::as_str) {
            if let Ok(path) = validated_recording_path(&exports, value) {
                let session_id = path
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .map(str::to_owned);
                let _ = fs::remove_file(path);
                if let Some(session_id) = session_id {
                    let _ = fs::remove_dir_all(settings.join("sessions").join(session_id));
                }
            }
        }
    }
    if let Some(value) = manifest.get("videoPath").and_then(Value::as_str) {
        if let Ok(path) = validated_recording_path(&exports, value) {
            let _ = fs::remove_file(path);
        }
    }
    fs::remove_file(manifest_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn assemble_recording_sections(
    settings_folder: String,
    sources: Vec<String>,
    timeline_id: String,
) -> Result<String, String> {
    if sources.is_empty() {
        return Err("The recording timeline has no sections".into());
    }
    if timeline_id.is_empty()
        || !timeline_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Invalid recording timeline id".into());
    }
    let settings = settings_path(&settings_folder)?;
    let exports = settings.join("exports");
    fs::create_dir_all(&exports).map_err(|error| error.to_string())?;
    let allowed_root = exports.canonicalize().map_err(|error| error.to_string())?;
    let mut validated = Vec::with_capacity(sources.len());
    for source in sources {
        let canonical = PathBuf::from(source)
            .canonicalize()
            .map_err(|error| error.to_string())?;
        let is_mp4 = canonical
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("mp4"));
        if !canonical.starts_with(&allowed_root) || !is_mp4 {
            return Err("Recording sections must be MP4 files created by this project".into());
        }
        validated.push(canonical);
    }
    let list_path = exports.join(format!("{timeline_id}-sections.txt"));
    let list = validated
        .iter()
        .map(|path| format!("file '{}'", path.to_string_lossy().replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(&list_path, list).map_err(|error| error.to_string())?;
    let output = exports.join(format!("{timeline_id}.mp4"));
    let pending_output = exports.join(format!("{timeline_id}-building.mp4"));
    let _ = fs::remove_file(&pending_output);
    let mut last_error = "FFmpeg was not found. Install FFmpeg and try again".to_string();
    for program in [
        "ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ] {
        match Command::new(program)
            .args(["-y", "-f", "concat", "-safe", "0", "-i"])
            .arg(&list_path)
            .args([
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "192k",
                "-movflags",
                "+faststart",
            ])
            .arg(&pending_output)
            .status()
        {
            Ok(status) if status.success() => {
                let _ = fs::remove_file(&list_path);
                #[cfg(target_os = "windows")]
                if output.exists() {
                    fs::remove_file(&output).map_err(|error| error.to_string())?;
                }
                fs::rename(&pending_output, &output).map_err(|error| {
                    format!("Could not publish the assembled recording: {error}")
                })?;
                return Ok(output.to_string_lossy().into_owned());
            }
            Ok(_) => {
                last_error = "FFmpeg failed to assemble the recording sections".into();
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => {
                last_error = format!("FFmpeg could not start: {error}");
                break;
            }
        }
    }
    let _ = fs::remove_file(&list_path);
    let _ = fs::remove_file(&pending_output);
    Err(last_error)
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
    let is_mp4 = |path: &Path| {
        path.extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("mp4"))
    };
    if !source.is_file() || !is_mp4(&source) || !is_mp4(&target) {
        return Err("Expected an existing MP4 recording and an MP4 destination".into());
    }
    if source == target {
        return Ok(());
    }
    fs::copy(source, target)
        .map(|_| ())
        .map_err(|e| format!("Could not export the video: {e}"))
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

#[tauri::command]
fn open_microphone_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        command.arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
        return command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not open microphone settings: {error}"));
    }
    #[cfg(target_os = "windows")]
    {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", "", "ms-settings:privacy-microphone"]);
        return command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not open microphone settings: {error}"));
    }
    #[cfg(target_os = "linux")]
    {
        let mut command = Command::new("gnome-control-center");
        command.arg("privacy");
        return command
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Could not open microphone settings: {error}"));
    }
    #[allow(unreachable_code)]
    Err("Microphone settings are not available on this platform".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_presentations,
            settings_home_folder,
            settings_cache_folder,
            resolve_settings_folder,
            load_presentation,
            load_project_image,
            load_drawings,
            load_outputs,
            create_presentation,
            save_presentation,
            save_session,
            load_recording_timeline,
            save_recording_timeline,
            load_recording_video,
            clear_recording_timeline,
            assemble_recording_sections,
            write_binary,
            copy_video,
            transcode_video,
            open_microphone_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running Presenta");
}
