import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAppStore } from "../store";
import { clearRecordingTimeline, exportRecordingSections, finalizeNativeRecording, loadRecordingPreview, loadRecordingTimeline, nativeRecordingAvailable, pauseNativeRecording, resumeNativeRecording, saveRecordingTimeline, saveSession, startNativeRecording, stopNativeRecording } from "../lib/native";
import type { CameraLayout, RecordingSection, SessionData } from "../types";

const VIDEO_WIDTH = 1920;
const VIDEO_HEIGHT = 1080;
const VIDEO_BIT_RATE = 8_000_000;
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
  const usingNativeCapture = useRef(false);
  const activeSessionId = useRef("");
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const assembledVideoPath = useRef<string | null>(null);
  const [sections, setSections] = useState<RecordingSection[]>([]);
  const sectionsRef = useRef<RecordingSection[]>([]);
  const [retakeSectionId, setRetakeSectionId] = useState<string | null>(null);
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
  const sectionStartedAt = useRef({ slide: 0, step: 0 });
  const timelineId = useRef(`timeline-${Date.now()}`);
  const recordingFiles = useRef<string[]>([]);
  const timelineMutation = useRef(false);
  const store = useAppStore();
  const deckKey = useRef("");

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
      if (usingNativeCapture.current) stopNativeRecording().catch(() => undefined);
      sectionsRef.current.forEach((section) => { if (section.previewUrl) URL.revokeObjectURL(section.previewUrl); });
    };
  }, []);

  useEffect(() => { sectionsRef.current = sections; }, [sections]);

  useEffect(() => {
    const nextKey = `${store.folder ?? ""}:${store.settingsFolder ?? ""}:${store.presentationFile ?? ""}`;
    if (nextKey === deckKey.current) return;
    sectionsRef.current.forEach((section) => { if (section.previewUrl) URL.revokeObjectURL(section.previewUrl); });
    sectionsRef.current = [];
    timelineMutation.current = false;
    deckKey.current = nextKey;
    timelineId.current = `timeline-${Date.now()}`;
    recordingFiles.current = [];
    setSections([]);
    setRetakeSectionId(null);
    assembledVideoPath.current = null;
    let cancelled = false;
    loadRecordingTimeline(store.settingsFolder, store.presentationFile).then(async (saved) => {
      if (cancelled || deckKey.current !== nextKey || !saved) return;
      timelineId.current = saved.timelineId || `timeline-${Date.now()}`;
      assembledVideoPath.current = saved.videoPath;
      recordingFiles.current = saved.recordingFiles?.length
        ? saved.recordingFiles
        : saved.sections.flatMap((section) => section.videoPath ? [section.videoPath] : []);
      sectionsRef.current = saved.sections;
      setSections(saved.sections);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [store.folder, store.settingsFolder, store.presentationFile]);

  const createSlideStream = async () => {
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
    const renderFrame = async () => {
      if (!renderingFrames.current) return;
      try {
        if (camera.srcObject !== cameraPreviewStream.current) {
          camera.srcObject = cameraPreviewStream.current;
          if (cameraPreviewStream.current) camera.play().catch(() => undefined);
        }
        const bounds = slide.getBoundingClientRect();
        const renderScale = Math.max(VIDEO_WIDTH / bounds.width, VIDEO_HEIGHT / bounds.height);
        const frameBackground = getComputedStyle(slide).backgroundColor;
        const frame = await html2canvas(slide, {
          scale: renderScale, backgroundColor: frameBackground, useCORS: true, logging: false,
          onclone: (documentClone) => {
            const clonedSlide = documentClone.querySelector<HTMLElement>(".slide-canvas");
            if (!clonedSlide) return;
            clonedSlide.style.setProperty("box-shadow", "none", "important");
            clonedSlide.querySelectorAll<HTMLElement>(".cm-activeLine, .cm-activeLineGutter").forEach((element) => {
              element.style.setProperty("background", "transparent", "important");
            });
            clonedSlide.querySelectorAll<HTMLElement>(".cm-cursor, .cm-dropCursor, .cm-selectionLayer").forEach((element) => {
              element.style.setProperty("display", "none", "important");
            });
            documentClone.querySelector<HTMLElement>(".camera-preview")?.style.setProperty("display", "none", "important");
          },
        });
        context.fillStyle = frameBackground;
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
    if (timelineMutation.current) throw new Error("Wait for the recording timeline to finish updating");
    if (!useAppStore.getState().folder) throw new Error("Create or open a presentation before recording");
    setProcessingStatus("Preparing recording…");
    let slideStream: MediaStream | null = null;
    let stream = previewStream.current;
    try {
      if (!stream || !stream.active) { await openMicrophone(); stream = previewStream.current; }
      if (!stream) throw new Error("The selected microphone is unavailable");
      if (cameraEnabledRef.current && !cameraPreviewStream.current) await openCamera().catch(() => {
        cameraEnabledRef.current = false;
        setCameraEnabled(false);
      });
      if (resetPresentation) {
        setProcessingStatus("Clearing previous recording…");
        const current = useAppStore.getState();
        await clearRecordingTimeline(current.settingsFolder, current.presentationFile);
        sectionsRef.current.forEach((section) => { if (section.previewUrl) URL.revokeObjectURL(section.previewUrl); });
        sectionsRef.current = [];
        recordingFiles.current = [];
        timelineId.current = `timeline-${Date.now()}`;
        setSections([]);
        setRetakeSectionId(null);
        assembledVideoPath.current = null;
        store.resetForRecording();
        // Let React commit the clean store state before html2canvas captures the
        // first frame. Without this paint boundary, old ink can enter the video.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }
      const state = useAppStore.getState();
      activeSessionId.current = new Date().toISOString().replace(/[:.]/g, "-");
      usingNativeCapture.current = !!state.settingsFolder && await nativeRecordingAvailable();
      if (usingNativeCapture.current) {
        const slide = document.querySelector<HTMLElement>(".slide-canvas");
        if (!slide) throw new Error("The presentation area is not available");
        const bounds = slide.getBoundingClientRect();
        // On macOS, Tauri's native window origin includes the title bar while
        // getBoundingClientRect() starts at the webview's content origin.
        // Move the native crop into the content area so window chrome is not
        // recorded above the slide (Retina capture makes this gap look 2x).
        const windowBorderX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
        const windowChromeY = Math.max(0, window.outerHeight - window.innerHeight);
        await startNativeRecording(state.settingsFolder!, activeSessionId.current, {
          x: bounds.left + windowBorderX,
          y: bounds.top + windowChromeY,
          width: bounds.width,
          height: bounds.height,
        });
      } else {
        slideStream = await createSlideStream();
      }
    } catch (error) {
      renderingFrames.current = false; clearTimeout(frameTimer.current); slideStream?.getTracks().forEach((track) => track.stop()); stopPreview(); setProcessingStatus(null);
      const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
      throw new Error(`Recording could not start${detail}`);
    }
    previewStream.current = stream;
    chunks.current = [];
    recorder.current = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
    recorder.current.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    videoChunks.current = [];
    if (slideStream) {
      const combined = new MediaStream([...slideStream.getVideoTracks(), ...stream.getAudioTracks()]);
      videoRecorder.current = new MediaRecorder(combined, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm", videoBitsPerSecond: VIDEO_BIT_RATE, audioBitsPerSecond: 192_000 });
      videoRecorder.current.ondataavailable = (event) => { if (event.data.size) videoChunks.current.push(event.data); };
      videoRecorder.current.start(1000);
    } else {
      videoRecorder.current = null;
    }
    const state = useAppStore.getState();
    sectionStartedAt.current = { slide: state.slideIndex, step: state.step };
    recorder.current.start(1000); store.startRecording(); accumulatedMs.current = 0; activeStartedAt.current = performance.now(); sessionStartedAt.current = Date.now(); setElapsed(0); setPaused(false); setProcessingStatus(null); startTimer();
  };

  const pause = () => {
    if (!recorder.current || recorder.current.state !== "recording") return;
    recorder.current.pause();
    if (videoRecorder.current?.state === "recording") videoRecorder.current.pause();
    if (usingNativeCapture.current) pauseNativeRecording().catch(() => undefined);
    accumulatedMs.current += performance.now() - activeStartedAt.current;
    clearInterval(timer.current); setElapsed(Math.floor(accumulatedMs.current / 1000)); setPaused(true); store.pauseRecording();
  };
  const resume = () => {
    if (!recorder.current || recorder.current.state !== "paused") return;
    recorder.current.resume();
    if (videoRecorder.current?.state === "paused") videoRecorder.current.resume();
    if (usingNativeCapture.current) resumeNativeRecording().catch(() => undefined);
    activeStartedAt.current = performance.now(); setPaused(false); store.resumeRecording(); startTimer();
  };
  const stop = async () => {
    if (!recorder.current || timelineMutation.current) return;
    timelineMutation.current = true;
    renderingFrames.current = false; clearTimeout(frameTimer.current);
    if (!paused) accumulatedMs.current += performance.now() - activeStartedAt.current;
    const duration = Math.floor(accumulatedMs.current / 1000);
    clearInterval(timer.current); setElapsed(duration); setProcessingStatus("Finalizing recording…");
    try {
      const active = recorder.current;
      const nativeCapture = usingNativeCapture.current ? stopNativeRecording() : Promise.resolve<string | null>(null);
      const audio = await new Promise<Blob>((resolve) => { active.onstop = () => resolve(new Blob(chunks.current, { type: active.mimeType })); active.stop(); active.stream.getTracks().forEach((track) => track.stop()); });
      const video = videoRecorder.current ? await new Promise<Blob>((resolve) => {
        const activeVideo = videoRecorder.current!;
        activeVideo.onstop = () => resolve(new Blob(videoChunks.current, { type: activeVideo.mimeType })); activeVideo.stop(); activeVideo.stream.getTracks().forEach((track) => track.stop());
      }) : undefined;
      previewStream.current = null;
      cameraPreviewStream.current?.getTracks().forEach((track) => track.stop()); cameraPreviewStream.current = null; setCameraStream(null);
      stopMeter(); store.stopRecording(); setPaused(false);
      const current = useAppStore.getState();
      const session: SessionData = { id: activeSessionId.current || new Date().toISOString().replace(/[:.]/g, "-"), startedAt: new Date(sessionStartedAt.current).toISOString(), duration, events: current.events, outputs: current.outputs, drawings: current.drawings };
      setProcessingStatus(video ? "Encoding MP4…" : "Saving session…");
      const nativeCapturePath = await nativeCapture;
      let videoPath = await saveSession(current.folder, current.settingsFolder, current.presentationFile, session, audio, video);
      if (nativeCapturePath && current.settingsFolder) {
        setProcessingStatus("Adding narration to native recording…");
        videoPath = await finalizeNativeRecording(current.settingsFolder, session.id, nativeCapturePath);
      }
      if (videoPath && !recordingFiles.current.includes(videoPath)) recordingFiles.current.push(videoPath);
      const previewUrl = video ? URL.createObjectURL(video) : null;
      const currentSections = sectionsRef.current;
      const replacedSection = retakeSectionId ? currentSections.find((item) => item.id === retakeSectionId) : null;
      if (replacedSection?.previewUrl) URL.revokeObjectURL(replacedSection.previewUrl);
      const section: RecordingSection = { id: retakeSectionId ?? `section-${Date.now()}`, duration, ...sectionStartedAt.current, videoPath, previewUrl };
      const next = retakeSectionId
        ? currentSections.map((item) => item.id === retakeSectionId ? section : item)
        : [...currentSections, section];
      sectionsRef.current = next;
      setSections(next);
      setRetakeSectionId(null);
      await saveRecordingTimeline(current.settingsFolder, current.presentationFile, { timelineId: timelineId.current, sections: next, recordingFiles: recordingFiles.current, videoPath: assembledVideoPath.current });
      return videoPath;
    } finally { recorder.current = null; videoRecorder.current = null; usingNativeCapture.current = false; activeSessionId.current = ""; timelineMutation.current = false; setProcessingStatus(null); }
  };

  const removeSection = async (id: string) => {
    if (timelineMutation.current) throw new Error("Wait for the recording timeline to finish updating");
    timelineMutation.current = true;
    const removed = sectionsRef.current.find((section) => section.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    const next = sectionsRef.current.filter((section) => section.id !== id);
    sectionsRef.current = next;
    setSections(next);
    if (retakeSectionId === id) setRetakeSectionId(null);
    try {
      const current = useAppStore.getState();
      await saveRecordingTimeline(current.settingsFolder, current.presentationFile, { timelineId: timelineId.current, sections: next, recordingFiles: recordingFiles.current, videoPath: assembledVideoPath.current });
    } finally { timelineMutation.current = false; setProcessingStatus(null); }
  };

  const replaySection = async (id: string) => {
    const section = sectionsRef.current.find((item) => item.id === id);
    if (!section) throw new Error("The recording section no longer exists");
    if (section.previewUrl) return section.previewUrl;
    if (!section.videoPath) throw new Error("This recording section has no video");
    const video = await loadRecordingPreview(useAppStore.getState().settingsFolder, section.videoPath);
    if (!video) throw new Error("Saved recording previews are available in the desktop app");
    const previewUrl = URL.createObjectURL(video);
    const next = sectionsRef.current.map((item) => item.id === id ? { ...item, previewUrl } : item);
    if (!next.some((item) => item.id === id)) {
      URL.revokeObjectURL(previewUrl);
      throw new Error("The recording section no longer exists");
    }
    sectionsRef.current = next;
    setSections(next);
    return previewUrl;
  };

  const clearAllSections = async () => {
    if (timelineMutation.current) throw new Error("Wait for the recording timeline to finish updating");
    timelineMutation.current = true;
    const current = useAppStore.getState();
    setProcessingStatus("Deleting recordings…");
    try {
      await clearRecordingTimeline(current.settingsFolder, current.presentationFile);
      sectionsRef.current.forEach((section) => { if (section.previewUrl) URL.revokeObjectURL(section.previewUrl); });
      sectionsRef.current = [];
      recordingFiles.current = [];
      timelineId.current = `timeline-${Date.now()}`;
      setSections([]);
      setRetakeSectionId(null);
      assembledVideoPath.current = null;
    } finally { timelineMutation.current = false; setProcessingStatus(null); }
  };

  const retakeSection = (id: string) => {
    if (timelineMutation.current) return;
    const section = sections.find((item) => item.id === id);
    if (!section) return;
    setRetakeSectionId(id);
    store.goTo(section.slide, section.step);
  };

  const exportRecording = async () => {
    if (timelineMutation.current) throw new Error("Wait for the recording timeline to finish updating");
    const current = useAppStore.getState();
    const sources = sectionsRef.current.flatMap((section) => section.videoPath ? [section.videoPath] : []);
    if (!sources.length) throw new Error("Record at least one section before exporting");
    if (sources.length !== sectionsRef.current.length) throw new Error("One or more recording sections are unavailable");
    timelineMutation.current = true;
    setProcessingStatus(sources.length > 1 ? "Combining recording sections…" : "Preparing recording export…");
    try {
      const assembled = await exportRecordingSections(current.settingsFolder, sources, timelineId.current, current.presentationFile);
      if (!assembled) return false;
      assembledVideoPath.current = assembled;
      await saveRecordingTimeline(current.settingsFolder, current.presentationFile, { timelineId: timelineId.current, sections: sectionsRef.current, recordingFiles: recordingFiles.current, videoPath: assembled, videoSources: sources });
      return true;
    } finally {
      timelineMutation.current = false;
      setProcessingStatus(null);
    }
  };

  return { elapsed, paused, processingStatus, sections, retakeSectionId, microphones, selectedDeviceId, selectedDeviceLabel, microphonePermission, microphoneError, waveform, inputLevel, cameras, selectedCameraId, selectedCameraLabel, cameraStream, cameraEnabled, cameraLayout, cameraPermission, cameraError, prepareMicrophone, selectMicrophone, selectCamera, toggleCamera, setCameraLayout, cancelMicrophoneSetup: stopPreview, start, pause, resume, stop, removeSection, replaySection, clearAllSections, retakeSection, exportRecording };
}
