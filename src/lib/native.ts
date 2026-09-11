import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CellOutput, Drawing, SessionData } from "../types";

export interface PresentationProject { folder: string; presentations: string[] }
export interface OpenedPresentation extends PresentationProject {
  presentationFile: string; markdown: string; drawings: Drawing[]; outputs: Record<string, CellOutput>;
}

export async function choosePresentationProject(): Promise<PresentationProject | null> {
  if (!isTauri()) return null;
  const folder = await open({ directory: true, multiple: false, title: "Open presentation folder" });
  if (!folder) return null;
  const presentations = await invoke<string[]>("list_presentations", { folder });
  return { folder, presentations };
}

export async function openPresentation(folder: string, presentationFile: string, presentations?: string[]): Promise<OpenedPresentation> {
  const markdown = await invoke<string>("load_presentation", { folder, presentationFile });
  const drawings = await invoke<Drawing[]>("load_drawings", { folder, presentationFile }).catch(() => []);
  const outputs = await invoke<Record<string, CellOutput>>("load_outputs", { folder, presentationFile }).catch(() => ({}));
  return { folder, presentationFile, presentations: presentations ?? await invoke<string[]>("list_presentations", { folder }), markdown, drawings, outputs };
}

export async function createPresentation(markdown: string, projectFolder?: string | null) {
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
  await invoke("create_presentation", { folder, presentationFile, markdown });
  const presentations = await invoke<string[]>("list_presentations", { folder });
  return { folder, presentationFile, presentations, markdown, drawings: [] as Drawing[], outputs: {} as Record<string, CellOutput> };
}

export async function savePresentation(folder: string | null, presentationFile: string | null, markdown: string, drawings: Drawing[], outputs: Record<string, CellOutput>) {
  if (!folder || !presentationFile || !isTauri()) {
    localStorage.setItem("presenta:draft", JSON.stringify({ markdown, drawings, outputs })); return;
  }
  await invoke("save_presentation", { folder, presentationFile, markdown, drawings, outputs });
}

export async function saveSession(folder: string | null, presentationFile: string | null, session: SessionData, audio?: Blob, video?: Blob) {
  if (!folder || !isTauri()) {
    localStorage.setItem(`presenta:session:${session.id}`, JSON.stringify(session)); return null;
  }
  const audioBytes = audio ? Array.from(new Uint8Array(await audio.arrayBuffer())) : null;
  const videoBytes = video ? Array.from(new Uint8Array(await video.arrayBuffer())) : null;
  return invoke<string | null>("save_session", { folder, presentationFile, session, audioBytes, videoBytes });
}

export async function exportVideo(source: string) {
  if (!isTauri()) return false;
  const filename = source.split(/[\\/]/).at(-1) ?? "presentation.mp4";
  const output = await save({ title: "Export session video", defaultPath: filename, filters: [{ name: "MP4 video", extensions: ["mp4"] }] });
  if (!output) return false;
  await invoke("copy_video", { source, target: output });
  return true;
}

export async function choosePdfPath() {
  if (!isTauri()) return null;
  return save({ title: "Export presentation", defaultPath: "presentation.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
}
