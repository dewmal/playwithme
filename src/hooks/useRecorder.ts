import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAppStore } from "../store";
import { saveSession } from "../lib/native";
import type { SessionData } from "../types";

const VIDEO_WIDTH = 3840;
const VIDEO_HEIGHT = 2160;
const VIDEO_BIT_RATE = 24_000_000;

export function useRecorder() {
  const recorder = useRef<MediaRecorder | null>(null); const videoRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]); const videoChunks = useRef<Blob[]>([]); const [elapsed, setElapsed] = useState(0); const [lastVideoPath, setLastVideoPath] = useState<string | null>(null); const [processingStatus, setProcessingStatus] = useState<string | null>(null); const timer = useRef<number>(0); const frameTimer = useRef<number>(0); const renderingFrames = useRef(false);
  const store = useAppStore();
  const createSlideStream = async () => {
    const slide = document.querySelector<HTMLElement>(".slide-canvas");
    if (!slide) throw new Error("The presentation area is not available");
    const output = document.createElement("canvas"); output.width = VIDEO_WIDTH; output.height = VIDEO_HEIGHT;
    const context = output.getContext("2d");
    if (!context) throw new Error("Video rendering is not supported on this device");
    renderingFrames.current = true;
    const renderFrame = async () => {
      if (!renderingFrames.current) return;
      try {
        const bounds = slide.getBoundingClientRect();
        const renderScale = Math.max(VIDEO_WIDTH / bounds.width, VIDEO_HEIGHT / bounds.height);
        const frame = await html2canvas(slide, {
          // Capture only the element's real bounds. Giving html2canvas a larger
          // width/height expands its viewport and records the surrounding stage.
          // Rendering at the output scale keeps text and drawings sharp in 4K.
          scale: renderScale,
          backgroundColor: "#f4f0e8", useCORS: true, logging: false,
          onclone: (documentClone) => {
            const clonedSlide = documentClone.querySelector<HTMLElement>(".slide-canvas");
            if (!clonedSlide) return;
            clonedSlide.style.setProperty("box-shadow", "none", "important");
            clonedSlide.style.setProperty("background", "#f4f0e8", "important");
          },
        });
        context.fillStyle = "#f4f0e8";
        context.fillRect(0, 0, output.width, output.height);
        context.drawImage(frame, 0, 0, output.width, output.height);
      } finally {
        if (renderingFrames.current) frameTimer.current = window.setTimeout(renderFrame, 100);
      }
    };
    await renderFrame();
    return output.captureStream(30);
  };
  const start = async () => {
    if (!useAppStore.getState().folder) throw new Error("Create or open a presentation before recording");
    setProcessingStatus("Preparing recording…");
    let slideStream: MediaStream | null = null; let stream: MediaStream | null = null;
    try {
      slideStream = await createSlideStream();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      renderingFrames.current = false; clearTimeout(frameTimer.current); slideStream?.getTracks().forEach((track) => track.stop()); stream?.getTracks().forEach((track) => track.stop()); setProcessingStatus(null);
      const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
      throw new Error(`Recording could not start${detail}`);
    }
    setLastVideoPath(null); chunks.current = []; recorder.current = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
    recorder.current.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    const combined = new MediaStream([...slideStream.getVideoTracks(), ...stream.getAudioTracks()]);
    videoChunks.current = []; videoRecorder.current = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm", videoBitsPerSecond: VIDEO_BIT_RATE, audioBitsPerSecond: 192_000 });
    videoRecorder.current.ondataavailable = (e) => { if (e.data.size) videoChunks.current.push(e.data); };
    videoRecorder.current.start(1000);
    recorder.current.start(1000); store.startRecording(); setElapsed(0); setProcessingStatus(null);
    const started = Date.now(); timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
  };
  const stop = async () => {
    if (!recorder.current) return;
    renderingFrames.current = false; clearTimeout(frameTimer.current);
    setProcessingStatus("Finalizing recording…");
    try {
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
      setProcessingStatus(video ? "Encoding MP4…" : "Saving session…");
      const videoPath = await saveSession(current.folder, session, audio, video); setLastVideoPath(videoPath); return videoPath;
    } finally {
      recorder.current = null; videoRecorder.current = null; setProcessingStatus(null);
    }
  };
  return { elapsed, lastVideoPath, processingStatus, start, stop };
}
