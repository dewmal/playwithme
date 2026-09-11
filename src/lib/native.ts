import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CellOutput, Drawing, SessionData } from "../types";

export async function openPresentation() {
  if (!isTauri()) return null;
  const folder = await open({ directory: true, multiple: false, title: "Open presentation folder" });
  if (!folder) return null;
  const markdown = await invoke<string>("load_presentation", { folder });
  const drawings = await invoke<Drawing[]>("load_drawings", { folder }).catch(() => []);
  const outputs = await invoke<Record<string, CellOutput>>("load_outputs", { folder }).catch(() => ({}));
  return { folder, markdown, drawings, outputs };
}

export async function createPresentation(markdown: string) {
  if (!isTauri()) throw new Error("New presentations are available in the desktop app");
  const folder = await open({ directory: true, multiple: false, title: "Choose or create a folder for the new presentation" });
  if (!folder) return null;
  await invoke("create_presentation", { folder, markdown });
  return { folder, markdown, drawings: [] as Drawing[], outputs: {} as Record<string, CellOutput> };
}

export async function savePresentation(folder: string | null, markdown: string, drawings: Drawing[], outputs: Record<string, CellOutput>) {
  if (!folder || !isTauri()) {
    localStorage.setItem("presenta:draft", JSON.stringify({ markdown, drawings, outputs })); return;
  }
  await invoke("save_presentation", { folder, markdown, drawings, outputs });
}

export async function saveSession(folder: string | null, session: SessionData, audio?: Blob, video?: Blob) {
  if (!folder || !isTauri()) {
    localStorage.setItem(`presenta:session:${session.id}`, JSON.stringify(session)); return null;
  }
  const audioBytes = audio ? Array.from(new Uint8Array(await audio.arrayBuffer())) : null;
  const videoBytes = video ? Array.from(new Uint8Array(await video.arrayBuffer())) : null;
  return invoke<string | null>("save_session", { folder, session, audioBytes, videoBytes });
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
