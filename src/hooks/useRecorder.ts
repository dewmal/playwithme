import { useRef, useState } from "react";
import { useAppStore } from "../store";
import { saveSession } from "../lib/native";
import type { SessionData } from "../types";

export function useRecorder() {
  const recorder = useRef<MediaRecorder | null>(null); const videoRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]); const videoChunks = useRef<Blob[]>([]); const [elapsed, setElapsed] = useState(0); const timer = useRef<number>(0);
  const store = useAppStore();
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = []; recorder.current = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
    recorder.current.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const combined = new MediaStream([...display.getVideoTracks(), ...stream.getAudioTracks()]);
      videoChunks.current = []; videoRecorder.current = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
      videoRecorder.current.ondataavailable = (e) => { if (e.data.size) videoChunks.current.push(e.data); };
      videoRecorder.current.start(1000);
    } catch { videoRecorder.current = null; }
    recorder.current.start(1000); store.startRecording(); setElapsed(0);
    const started = Date.now(); timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
  };
  const stop = async () => {
    if (!recorder.current) return;
    const active = recorder.current; const audio = await new Promise<Blob>((resolve) => {
      active.onstop = () => resolve(new Blob(chunks.current, { type: active.mimeType })); active.stop(); active.stream.getTracks().forEach((t) => t.stop());
    });
    const video = videoRecorder.current ? await new Promise<Blob>((resolve) => {
      const activeVideo = videoRecorder.current!;
      activeVideo.onstop = () => resolve(new Blob(videoChunks.current, { type: activeVideo.mimeType })); activeVideo.stop(); activeVideo.stream.getTracks().forEach((t) => t.stop());
    }) : undefined;
    clearInterval(timer.current); store.stopRecording();
    const current = useAppStore.getState();
    const session: SessionData = { id: new Date().toISOString().replace(/[:.]/g, "-"), startedAt: new Date(Date.now() - elapsed * 1000).toISOString(), duration: elapsed, events: current.events, outputs: current.outputs, drawings: current.drawings };
    await saveSession(current.folder, session, audio, video); recorder.current = null; videoRecorder.current = null;
  };
  return { elapsed, start, stop };
}
