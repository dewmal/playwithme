import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CellOutput, Drawing, SessionData } from "../types";

export type SettingsLocation = { mode: "project" | "home" | "cache" | "custom"; customRoot?: string };
export interface PresentationProject { folder: string; settingsFolder: string; presentations: string[] }
export interface OpenedPresentation extends PresentationProject {
  presentationFile: string; markdown: string; drawings: Drawing[]; outputs: Record<string, CellOutput>;
}

export async function resolveSettingsFolder(folder: string, location: SettingsLocation): Promise<string> {
  if (!isTauri()) return "";
  return invoke<string>("resolve_settings_folder", { folder, mode: location.mode, customRoot: location.customRoot ?? null });
}

export async function chooseSettingsRoot(): Promise<string | null> {
  if (!isTauri()) return null;
  return open({ directory: true, multiple: false, title: "Choose Presenta settings folder" });
}

export async function settingsHomeFolder(): Promise<string> {
  if (!isTauri()) return "~/.presenta";
  return invoke<string>("settings_home_folder");
}

export async function settingsCacheFolder(): Promise<string> {
  if (!isTauri()) return "OS cache/Presenta";
  return invoke<string>("settings_cache_folder");
}

export async function choosePresentationProject(location: SettingsLocation): Promise<PresentationProject | null> {
  if (!isTauri()) return null;
  const folder = await open({ directory: true, multiple: false, title: "Open presentation folder" });
  if (!folder) return null;
  const presentations = await invoke<string[]>("list_presentations", { folder });
  const settingsFolder = await resolveSettingsFolder(folder, location);
  return { folder, settingsFolder, presentations };
}

export async function openPresentation(folder: string, settingsFolder: string, presentationFile: string, presentations?: string[]): Promise<OpenedPresentation> {
  const markdown = await invoke<string>("load_presentation", { folder, presentationFile });
  const drawings = await invoke<Drawing[]>("load_drawings", { folder, settingsFolder, presentationFile }).catch(() => []);
  const outputs = await invoke<Record<string, CellOutput>>("load_outputs", { folder, settingsFolder, presentationFile }).catch(() => ({}));
  return { folder, settingsFolder, presentationFile, presentations: presentations ?? await invoke<string[]>("list_presentations", { folder }), markdown, drawings, outputs };
}

export async function createPresentation(markdown: string, location: SettingsLocation, projectFolder?: string | null, currentSettingsFolder?: string | null) {
  if (!isTauri()) throw new Error("New presentations are available in the desktop app");
  const defaultPath = projectFolder ? `${projectFolder.replace(/[\\/]+$/, "")}/presentation.md` : "presentation.md";
  const selected = await save({ title: "Create presentation", defaultPath, filters: [{ name: "Markdown presentation", extensions: ["md"] }] });
  if (!selected) return null;
  const target = /\.md$/i.test(selected) ? selected : `${selected}.md`;
  const normalizedTarget = target.replace(/\\/g, "/");
  const normalizedProject = projectFolder?.replace(/\\/g, "/").replace(/\/+$/, "");
  const insideCurrentProject = normalizedProject && normalizedTarget.startsWith(`${normalizedProject}/`);
  const separator = normalizedTarget.lastIndexOf("/");
  if (separator < 0) throw new Error("Choose a presentation inside a project folder");
  const folder = insideCurrentProject ? normalizedProject : normalizedTarget.slice(0, separator);
  const presentationFile = insideCurrentProject ? normalizedTarget.slice(normalizedProject.length + 1) : normalizedTarget.slice(separator + 1);
  const settingsFolder = insideCurrentProject && currentSettingsFolder ? currentSettingsFolder : await resolveSettingsFolder(folder, location);
  await invoke("create_presentation", { folder, settingsFolder, presentationFile, markdown });
  const presentations = await invoke<string[]>("list_presentations", { folder });
  return { folder, settingsFolder, presentationFile, presentations, markdown, drawings: [] as Drawing[], outputs: {} as Record<string, CellOutput> };
}

export async function savePresentation(folder: string | null, settingsFolder: string | null, presentationFile: string | null, markdown: string, drawings: Drawing[], outputs: Record<string, CellOutput>) {
  if (!folder || !settingsFolder || !presentationFile || !isTauri()) {
    localStorage.setItem("presenta:draft", JSON.stringify({ markdown, drawings, outputs })); return;
  }
  await invoke("save_presentation", { folder, settingsFolder, presentationFile, markdown, drawings, outputs });
}

export async function saveSession(folder: string | null, settingsFolder: string | null, presentationFile: string | null, session: SessionData, audio?: Blob, video?: Blob) {
  if (!folder || !settingsFolder || !isTauri()) {
    localStorage.setItem(`presenta:session:${session.id}`, JSON.stringify(session)); return null;
  }
  const audioBytes = audio ? Array.from(new Uint8Array(await audio.arrayBuffer())) : null;
  const videoBytes = video ? Array.from(new Uint8Array(await video.arrayBuffer())) : null;
  return invoke<string | null>("save_session", { folder, settingsFolder, presentationFile, session, audioBytes, videoBytes });
}

export async function openMicrophoneSettings() {
  if (!isTauri()) return false;
  await invoke("open_microphone_settings");
  return true;
}

export function exportFilename(presentationFile: string | null, extension: "pdf" | "mp4") {
  const filename = presentationFile?.split(/[\\/]/).at(-1)?.replace(/\.md$/i, "") || "presentation";
  return `${filename}.${extension}`;
}

export async function exportVideo(source: string, presentationFile: string | null) {
  if (!isTauri()) return false;
  const filename = exportFilename(presentationFile, "mp4");
  const output = await save({ title: "Export session video", defaultPath: filename, filters: [{ name: "MP4 video", extensions: ["mp4"] }] });
  if (!output) return false;
  await invoke("copy_video", { source, target: output });
  return true;
}

export async function choosePdfPath(presentationFile: string | null) {
  if (!isTauri()) return null;
  return save({ title: "Export presentation", defaultPath: exportFilename(presentationFile, "pdf"), filters: [{ name: "PDF", extensions: ["pdf"] }] });
}
