import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAppStore } from "../store";
import { saveSession } from "../lib/native";
import type { CameraLayout, SessionData } from "../types";

const VIDEO_WIDTH = 3840;
const VIDEO_HEIGHT = 2160;
const VIDEO_BIT_RATE = 24_000_000;
const EMPTY_WAVEFORM = Array.from({ length: 48 }, () => 0);
const DEFAULT_CAMERA_LAYOUT: CameraLayout = { x: 0.789, y: 0.771, size: 0.1875 };

export function useRecorder() {
  const recorder = useRef<MediaRecorder | null>(null);
  const videoRecorder = useRef<MediaRecorder | null>(null);
  const previewStream = useRef<MediaStream | null>(null);
  const cameraPreviewStream = useRef<MediaStream | null>(null);
  const cameraEnabledRef = useRef(true);
  const cameraLayoutRef = useRef<CameraLayout>(DEFAULT_CAMERA_LAYOUT);
  const audioContext = useRef<AudioContext | null>(null);
  const meterFrame = useRef(0);
  const chunks = useRef<Blob[]>([]);
  const videoChunks = useRef<Blob[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lastVideoPath, setLastVideoPath] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState("Default microphone");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedCameraLabel, setSelectedCameraLabel] = useState("Default camera");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraLayout, setCameraLayoutState] = useState<CameraLayout>(DEFAULT_CAMERA_LAYOUT);
  const [cameraPermission, setCameraPermission] = useState<"prompt" | "granted" | "denied" | "unavailable">("prompt");
  const [cameraError, setCameraError] = useState("");
  const [microphonePermission, setMicrophonePermission] = useState<"prompt" | "granted" | "denied" | "unavailable">("prompt");
  const [microphoneError, setMicrophoneError] = useState("");
  const [waveform, setWaveform] = useState<number[]>(EMPTY_WAVEFORM);
  const [inputLevel, setInputLevel] = useState(0);
  const timer = useRef<number>(0);
  const frameTimer = useRef<number>(0);
  const renderingFrames = useRef(false);
  const activeStartedAt = useRef(0);
  const accumulatedMs = useRef(0);
  const sessionStartedAt = useRef(0);
  const store = useAppStore();

  const updateElapsed = () => setElapsed(Math.floor((accumulatedMs.current + performance.now() - activeStartedAt.current) / 1000));
  const startTimer = () => { clearInterval(timer.current); timer.current = window.setInterval(updateElapsed, 250); };

  const stopMeter = () => {
    cancelAnimationFrame(meterFrame.current);
    meterFrame.current = 0;
    audioContext.current?.close().catch(() => undefined);
    audioContext.current = null;
    setInputLevel(0);
    setWaveform(EMPTY_WAVEFORM);
  };

  const stopPreview = () => {
    if (previewStream.current && previewStream.current !== recorder.current?.stream) previewStream.current.getTracks().forEach((track) => track.stop());
    previewStream.current = null;
    cameraPreviewStream.current?.getTracks().forEach((track) => track.stop());
    cameraPreviewStream.current = null;
    setCameraStream(null);
    stopMeter();
  };

  const startMeter = (stream: MediaStream) => {
    stopMeter();
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    context.createMediaStreamSource(stream).connect(analyser);
    audioContext.current = context;
    const values = new Uint8Array(analyser.frequencyBinCount);
    let lastUpdate = 0;
    const sample = (now: number) => {
      analyser.getByteTimeDomainData(values);
      if (now - lastUpdate > 45) {
        const step = values.length / EMPTY_WAVEFORM.length;
        const points = EMPTY_WAVEFORM.map((_, index) => (values[Math.floor(index * step)] - 128) / 128);
        const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length);
        setWaveform(points);
        setInputLevel(Math.min(1, rms * 4));
        lastUpdate = now;
      }
      meterFrame.current = requestAnimationFrame(sample);
    };
    context.resume().catch(() => undefined);
    meterFrame.current = requestAnimationFrame(sample);
  };

  const refreshMicrophones = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    setMicrophones(devices);
    return devices;
  };

  const refreshCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
    setCameras(devices);
    return devices;
  };

  const openMicrophone = async (deviceId = selectedDeviceId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermission("unavailable");
      setMicrophoneError("Microphone capture is not supported on this device.");
      throw new Error("Microphone capture is not supported on this device");
    }
    previewStream.current?.getTracks().forEach((track) => track.stop());
    stopMeter();
    const audio: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setMicrophonePermission(denied ? "denied" : "unavailable");
      setMicrophoneError(denied ? "Microphone access is blocked. Allow Presenta to use the microphone in System Settings, then try again." : error instanceof Error ? error.message : "The microphone could not be opened.");
      throw error;
    }
    setMicrophonePermission("granted");
    setMicrophoneError("");
    previewStream.current = stream;
    const devices = await refreshMicrophones();
    const track = stream.getAudioTracks()[0];
    const actualId = track.getSettings().deviceId ?? deviceId;
    const device = devices.find((item) => item.deviceId === actualId);
    setSelectedDeviceId(actualId ?? "");
    setSelectedDeviceLabel(device?.label || track.label || "Default microphone");
    startMeter(stream);
  };

  const openCamera = async (deviceId = selectedCameraId) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission("unavailable");
      setCameraError("Camera capture is not supported on this device.");
      throw new Error("Camera capture is not supported on this device");
    }
    cameraPreviewStream.current?.getTracks().forEach((track) => track.stop());
    cameraPreviewStream.current = null;
    setCameraStream(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      });
      cameraPreviewStream.current = stream;
      setCameraStream(stream);
      setCameraPermission("granted");
      setCameraError("");
      const devices = await refreshCameras();
      const track = stream.getVideoTracks()[0];
      const actualId = track.getSettings().deviceId ?? deviceId;
      const device = devices.find((item) => item.deviceId === actualId);
      setSelectedCameraId(actualId ?? "");
      setSelectedCameraLabel(device?.label || track.label || "Default camera");
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setCameraPermission(denied ? "denied" : "unavailable");
      setCameraError(denied ? "Camera access is blocked. Allow Presenta to use the camera, then try again." : error instanceof Error ? error.message : "The camera could not be opened.");
      throw error;
    }
  };

  const prepareMicrophone = async () => {
    setProcessingStatus("Checking recording devices…");
    try {
      await openMicrophone();
      if (cameraEnabledRef.current) await openCamera().catch(() => undefined);
    } finally { setProcessingStatus(null); }
  };

  const selectMicrophone = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setProcessingStatus("Switching microphone…");
    try { await openMicrophone(deviceId); } finally { setProcessingStatus(null); }
  };

  const selectCamera = async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    setProcessingStatus("Switching camera…");
    try { await openCamera(deviceId); } finally { setProcessingStatus(null); }
  };

  const toggleCamera = async () => {
    const enabled = !cameraEnabledRef.current;
    cameraEnabledRef.current = enabled;
    setCameraEnabled(enabled);
    if (enabled && !cameraPreviewStream.current) await openCamera();
  };

  const setCameraLayout = (layout: CameraLayout) => {
    const size = Math.min(0.34, Math.max(0.14, layout.size));
    const next = {
      size,
      x: Math.min(1 - size, Math.max(0, layout.x)),
      y: Math.min(1 - size, Math.max(0, layout.y)),
    };
    cameraLayoutRef.current = next;
    setCameraLayoutState(next);
  };

  useEffect(() => {
    const handleDeviceChange = () => { refreshMicrophones().catch(() => undefined); };
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
      previewStream.current?.getTracks().forEach((track) => track.stop());
      cameraPreviewStream.current?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(meterFrame.current);
      audioContext.current?.close().catch(() => undefined);
      clearInterval(timer.current);
      clearTimeout(frameTimer.current);
    };
  }, []);

  const createSlideStream = async (resetPresentation = false) => {
    const slide = document.querySelector<HTMLElement>(".slide-canvas");
    if (!slide) throw new Error("The presentation area is not available");
    const output = document.createElement("canvas"); output.width = VIDEO_WIDTH; output.height = VIDEO_HEIGHT;
    const context = output.getContext("2d");
    if (!context) throw new Error("Video rendering is not supported on this device");
    const camera = document.createElement("video");
    camera.muted = true; camera.playsInline = true;
    if (cameraPreviewStream.current) {
      camera.srcObject = cameraPreviewStream.current;
      await camera.play().catch(() => undefined);
    }
    renderingFrames.current = true;
    if (resetPresentation) store.resetForRecording();
    const renderFrame = async () => {
      if (!renderingFrames.current) return;
      try {
        if (camera.srcObject !== cameraPreviewStream.current) {
          camera.srcObject = cameraPreviewStream.current;
          if (cameraPreviewStream.current) camera.play().catch(() => undefined);
        }
        const bounds = slide.getBoundingClientRect();
        const renderScale = Math.max(VIDEO_WIDTH / bounds.width, VIDEO_HEIGHT / bounds.height);
        const frame = await html2canvas(slide, {
          scale: renderScale, backgroundColor: "#f4f0e8", useCORS: true, logging: false,
          onclone: (documentClone) => {
            const clonedSlide = documentClone.querySelector<HTMLElement>(".slide-canvas");
            if (!clonedSlide) return;
            clonedSlide.style.setProperty("box-shadow", "none", "important");
            clonedSlide.style.setProperty("background", "#f4f0e8", "important");
            documentClone.querySelector<HTMLElement>(".camera-preview")?.style.setProperty("display", "none", "important");
          },
        });
        context.fillStyle = "#f4f0e8";
        context.fillRect(0, 0, output.width, output.height);
        context.drawImage(frame, 0, 0, output.width, output.height);
        if (cameraEnabledRef.current && camera.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          const layout = cameraLayoutRef.current;
          const width = output.width * layout.size; const height = output.height * layout.size;
          const x = output.width * layout.x; const y = output.height * layout.y;
          const radius = Math.max(18, width * 0.053);
          context.save();
          context.beginPath();
          context.roundRect(x, y, width, height, radius);
          context.clip();
          context.translate(x + width, y);
          context.scale(-1, 1);
          context.drawImage(camera, 0, 0, width, height);
          context.restore();
          context.save();
          context.strokeStyle = "rgba(255,255,255,.9)"; context.lineWidth = 10;
          context.beginPath(); context.roundRect(x, y, width, height, radius); context.stroke(); context.restore();
        }
      } finally { if (renderingFrames.current) frameTimer.current = window.setTimeout(renderFrame, 100); }
    };
    await renderFrame();
    return output.captureStream(30);
  };

  const start = async (resetPresentation = false) => {
    if (!useAppStore.getState().folder) throw new Error("Create or open a presentation before recording");
    setProcessingStatus("Preparing recording…");
    let slideStream: MediaStream | null = null;
    let stream = previewStream.current;
    try {
      if (!stream || !stream.active) { await openMicrophone(); stream = previewStream.current; }
      if (!stream) throw new Error("The selected microphone is unavailable");
      if (cameraEnabledRef.current && !cameraPreviewStream.current) {
        cameraEnabledRef.current = false;
        setCameraEnabled(false);
      }
      slideStream = await createSlideStream(resetPresentation);
    } catch (error) {
      renderingFrames.current = false; clearTimeout(frameTimer.current); slideStream?.getTracks().forEach((track) => track.stop()); stopPreview(); setProcessingStatus(null);
      const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
      throw new Error(`Recording could not start${detail}`);
    }
    previewStream.current = stream;
    setLastVideoPath(null); chunks.current = [];
    recorder.current = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
    recorder.current.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    const combined = new MediaStream([...slideStream.getVideoTracks(), ...stream.getAudioTracks()]);
    videoChunks.current = [];
    videoRecorder.current = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm", videoBitsPerSecond: VIDEO_BIT_RATE, audioBitsPerSecond: 192_000 });
    videoRecorder.current.ondataavailable = (event) => { if (event.data.size) videoChunks.current.push(event.data); };
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
    clearInterval(timer.current); setElapsed(duration); setProcessingStatus("Finalizing recording…");
    try {
      const active = recorder.current;
      const audio = await new Promise<Blob>((resolve) => { active.onstop = () => resolve(new Blob(chunks.current, { type: active.mimeType })); active.stop(); active.stream.getTracks().forEach((track) => track.stop()); });
      const video = videoRecorder.current ? await new Promise<Blob>((resolve) => {
        const activeVideo = videoRecorder.current!;
        activeVideo.onstop = () => resolve(new Blob(videoChunks.current, { type: activeVideo.mimeType })); activeVideo.stop(); activeVideo.stream.getTracks().forEach((track) => track.stop());
      }) : undefined;
      previewStream.current = null;
      cameraPreviewStream.current?.getTracks().forEach((track) => track.stop()); cameraPreviewStream.current = null; setCameraStream(null);
      stopMeter(); store.stopRecording(); setPaused(false);
      const current = useAppStore.getState();
      const session: SessionData = { id: new Date().toISOString().replace(/[:.]/g, "-"), startedAt: new Date(sessionStartedAt.current).toISOString(), duration, events: current.events, outputs: current.outputs, drawings: current.drawings };
      setProcessingStatus(video ? "Encoding MP4…" : "Saving session…");
      const videoPath = await saveSession(current.folder, current.presentationFile, session, audio, video); setLastVideoPath(videoPath); return videoPath;
    } finally { recorder.current = null; videoRecorder.current = null; setProcessingStatus(null); }
  };

  return { elapsed, paused, lastVideoPath, processingStatus, microphones, selectedDeviceId, selectedDeviceLabel, microphonePermission, microphoneError, waveform, inputLevel, cameras, selectedCameraId, selectedCameraLabel, cameraStream, cameraEnabled, cameraLayout, cameraPermission, cameraError, prepareMicrophone, selectMicrophone, selectCamera, toggleCamera, setCameraLayout, cancelMicrophoneSetup: stopPreview, start, pause, resume, stop };
}
