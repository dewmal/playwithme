import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CellOutput, Drawing, SessionData } from "../types";

export async function openPresentation() {
  if (!isTauri()) return null;
  const folder = await open({ directory: true, multiple: false, title: "Open presentation folder" });
  if (!folder) return null;
  const markdown = await invoke<string>("load_presentation", { folder });
  const drawings = await invoke<Drawing[]>("load_drawings", { folder }).catch(() => []);
  return { folder, markdown, drawings };
}

export async function savePresentation(folder: string | null, markdown: string, drawings: Drawing[], outputs: Record<string, CellOutput>) {
  if (!folder || !isTauri()) {
    localStorage.setItem("presenta:draft", JSON.stringify({ markdown, drawings, outputs })); return;
  }
  await invoke("save_presentation", { folder, markdown, drawings, outputs });
}

export async function saveSession(folder: string | null, session: SessionData, audio?: Blob, video?: Blob) {
  if (!folder || !isTauri()) {
    localStorage.setItem(`presenta:session:${session.id}`, JSON.stringify(session)); return;
  }
  const audioBytes = audio ? Array.from(new Uint8Array(await audio.arrayBuffer())) : null;
  const videoBytes = video ? Array.from(new Uint8Array(await video.arrayBuffer())) : null;
  await invoke("save_session", { folder, session, audioBytes, videoBytes });
}

export async function choosePdfPath() {
  if (!isTauri()) return null;
  return save({ title: "Export presentation", defaultPath: "presentation.pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] });
}
