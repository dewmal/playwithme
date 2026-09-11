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
  const chunks = useRef<Blob[]>([]); const videoChunks = useRef<Blob[]>([]); const [elapsed, setElapsed] = useState(0); const [paused, setPaused] = useState(false); const [lastVideoPath, setLastVideoPath] = useState<string | null>(null); const [processingStatus, setProcessingStatus] = useState<string | null>(null); const timer = useRef<number>(0); const frameTimer = useRef<number>(0); const renderingFrames = useRef(false); const activeStartedAt = useRef(0); const accumulatedMs = useRef(0); const sessionStartedAt = useRef(0);
  const store = useAppStore();
  const updateElapsed = () => setElapsed(Math.floor((accumulatedMs.current + performance.now() - activeStartedAt.current) / 1000));
  const startTimer = () => { clearInterval(timer.current); timer.current = window.setInterval(updateElapsed, 250); };
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
    recorder.current.start(1000); store.startRecording(); accumulatedMs.current = 0; activeStartedAt.current = performance.now(); sessionStartedAt.current = Date.now(); setElapsed(0); setPaused(false); setProcessingStatus(null); startTimer();
  };
  const pause = () => {
    if (!recorder.current || recorder.current.state !== "recording") return;
    recorder.current.pause();
    if (videoRecorder.current?.state === "recording") videoRecorder.current.pause();
    accumulatedMs.current += performance.now() - activeStartedAt.current;
    clearInterval(timer.current); setElapsed(Math.floor(accumulatedMs.current / 1000)); setPaused(true); store.pauseRecording();
  };
  const resume = () => {
    if (!recorder.current || recorder.current.state !== "paused") return;
    recorder.current.resume();
    if (videoRecorder.current?.state === "paused") videoRecorder.current.resume();
    activeStartedAt.current = performance.now(); setPaused(false); store.resumeRecording(); startTimer();
  };
  const stop = async () => {
    if (!recorder.current) return;
    renderingFrames.current = false; clearTimeout(frameTimer.current);
    if (!paused) accumulatedMs.current += performance.now() - activeStartedAt.current;
    const duration = Math.floor(accumulatedMs.current / 1000);
    clearInterval(timer.current); setElapsed(duration);
    setProcessingStatus("Finalizing recording…");
    try {
      const active = recorder.current; const audio = await new Promise<Blob>((resolve) => {
        active.onstop = () => resolve(new Blob(chunks.current, { type: active.mimeType })); active.stop(); active.stream.getTracks().forEach((t) => t.stop());
      });
      const video = videoRecorder.current ? await new Promise<Blob>((resolve) => {
        const activeVideo = videoRecorder.current!;
        activeVideo.onstop = () => resolve(new Blob(videoChunks.current, { type: activeVideo.mimeType })); activeVideo.stop(); activeVideo.stream.getTracks().forEach((t) => t.stop());
      }) : undefined;
      store.stopRecording(); setPaused(false);
      const current = useAppStore.getState();
      const session: SessionData = { id: new Date().toISOString().replace(/[:.]/g, "-"), startedAt: new Date(sessionStartedAt.current).toISOString(), duration, events: current.events, outputs: current.outputs, drawings: current.drawings };
      setProcessingStatus(video ? "Encoding MP4…" : "Saving session…");
      const videoPath = await saveSession(current.folder, current.presentationFile, session, audio, video); setLastVideoPath(videoPath); return videoPath;
    } finally {
      recorder.current = null; videoRecorder.current = null; setProcessingStatus(null);
    }
  };
  return { elapsed, paused, lastVideoPath, processingStatus, start, pause, resume, stop };
}
