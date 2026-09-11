import { AudioLines, Camera, ExternalLink, Maximize2, Mic, Move, Play, RotateCcw, ShieldAlert, VideoOff, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CameraLayout } from "../types";

type Props = {
  microphones: MediaDeviceInfo[];
  selectedDeviceId: string;
  selectedDeviceLabel: string;
  waveform: number[];
  inputLevel: number;
  cameras: MediaDeviceInfo[];
  selectedCameraId: string;
  selectedCameraLabel: string;
  cameraStream: MediaStream | null;
  cameraEnabled: boolean;
  cameraLayout: CameraLayout;
  cameraPermission: "prompt" | "granted" | "denied" | "unavailable";
  cameraError: string;
  permission: "prompt" | "granted" | "denied" | "unavailable";
  error: string;
  busy: boolean;
  close: () => void;
  select: (deviceId: string) => void;
  selectCamera: (deviceId: string) => void;
  toggleCamera: () => void;
  setCameraLayout: (layout: CameraLayout) => void;
  start: () => void;
  retry: () => void;
  openSettings: () => void;
};

export function MicrophoneDialog({ microphones, selectedDeviceId, selectedDeviceLabel, waveform, inputLevel, cameras, selectedCameraId, selectedCameraLabel, cameraStream, cameraEnabled, cameraLayout, cameraPermission, cameraError, permission, error, busy, close, select, selectCamera, toggleCamera, setCameraLayout, start, retry, openSettings }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!video.current) return;
    video.current.srcObject = cameraStream;
    if (cameraStream) video.current.play().catch(() => undefined);
    return () => { if (video.current) video.current.srcObject = null; };
  }, [cameraStream]);
  const points = waveform.map((value, index) => `${(index / (waveform.length - 1)) * 100},${20 - value * 17}`).join(" ");
  const hearingInput = inputLevel > 0.025;
  const cameraPosition = (horizontal: "left" | "right", vertical: "top" | "bottom", size = cameraLayout.size) => {
    const margin = 0.035;
    setCameraLayout({ size, x: horizontal === "left" ? margin : 1 - size - margin, y: vertical === "top" ? margin : 1 - size - margin });
  };
  const selectedCorner = `${cameraLayout.y < 0.5 ? "top" : "bottom"}-${cameraLayout.x < 0.5 ? "left" : "right"}`;
  const cameraSize = (size: number) => cameraPosition(cameraLayout.x < 0.5 ? "left" : "right", cameraLayout.y < 0.5 ? "top" : "bottom", size);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="microphone-dialog" role="dialog" aria-modal="true" aria-labelledby="microphone-title">
      <header>
        <span className="microphone-icon"><Camera /></span>
        <div><span className="eyebrow">Recording setup</span><h2 id="microphone-title">Camera & microphone</h2><p>Preview your camera and check that the waveform moves.</p></div>
        <button onClick={close} aria-label="Close microphone setup"><X /></button>
      </header>

      {(permission === "denied" || permission === "unavailable") && <div className="microphone-permission-alert" role="alert">
        <ShieldAlert /><span><b>{permission === "denied" ? "Microphone permission required" : "Microphone unavailable"}</b><small>{error}</small></span>
        {permission === "denied" && <button onClick={openSettings}><ExternalLink /> Open System Settings</button>}
      </div>}

      <div className={`camera-setup-preview${cameraEnabled ? "" : " disabled"}`}>
        {cameraEnabled && cameraStream ? <video ref={video} autoPlay muted playsInline /> : <div><VideoOff /><b>{cameraEnabled ? "Camera unavailable" : "Camera is off"}</b><small>{cameraEnabled ? cameraError : "Your recording will contain slides and audio only."}</small></div>}
        <button onClick={toggleCamera} disabled={busy}><span>{cameraEnabled ? <VideoOff /> : <Camera />}</span>{cameraEnabled ? "Turn camera off" : "Turn camera on"}</button>
      </div>

      {cameraEnabled && cameraPermission === "granted" && <><label className="microphone-select-label camera-label" htmlFor="camera-select">Camera</label>
      <select id="camera-select" value={selectedCameraId} onChange={(event) => selectCamera(event.target.value)} disabled={busy || !cameras.length}>
        {!cameras.length && <option value="">Finding cameras…</option>}
        {cameras.map((device, index) => <option value={device.deviceId} key={device.deviceId || index}>{device.label || `Camera ${index + 1}`}</option>)}
      </select></>}

      {cameraEnabled && <div className="camera-layout-controls">
        <div><span><Move /> Position</span><div className="camera-position-grid">
          {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((position) => {
            const [vertical, horizontal] = position.split("-") as ["top" | "bottom", "left" | "right"];
            return <button type="button" key={position} className={selectedCorner === position ? "active" : ""} onClick={() => cameraPosition(horizontal, vertical)} aria-label={position.replace("-", " ")}><i /></button>;
          })}
        </div></div>
        <div><span><Maximize2 /> Size</span><div className="camera-size-options">
          {([{ label: "Small", size: 0.14 }, { label: "Medium", size: 0.1875 }, { label: "Large", size: 0.28 }] as const).map((option) => <button type="button" key={option.label} className={Math.abs(cameraLayout.size - option.size) < 0.02 ? "active" : ""} onClick={() => cameraSize(option.size)}>{option.label}</button>)}
        </div></div>
        <small>You can drag the camera directly on the slide after recording starts.</small>
      </div>}

      <label className="microphone-select-label" htmlFor="microphone-select"><Mic /> Microphone</label>
      <select id="microphone-select" value={selectedDeviceId} onChange={(event) => select(event.target.value)} disabled={busy || permission !== "granted" || !microphones.length}>
        {!microphones.length && <option value="">Finding microphones…</option>}
        {microphones.map((device, index) => <option value={device.deviceId} key={device.deviceId || index}>{device.label || `Microphone ${index + 1}`}</option>)}
      </select>

      <div className={`microphone-monitor${hearingInput ? " active" : ""}`}>
        <div className="waveform" aria-label={hearingInput ? "Microphone input detected" : "No microphone input detected"}>
          <span className="wave-center" />
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
        </div>
        <div className="input-status"><AudioLines /><span><b>{hearingInput ? "Input detected" : "Waiting for sound"}</b><small>{selectedDeviceLabel}</small></span><i><em style={{ width: `${Math.max(3, inputLevel * 100)}%` }} /></i></div>
      </div>

      <footer><span>{cameraEnabled ? `Camera: ${selectedCameraLabel}` : "Camera is off"}. Choose your microphone, then speak to test it.</span><span className="microphone-actions">{permission !== "granted" && <button className="retry-microphone" onClick={retry} disabled={busy}><RotateCcw /> Try again</button>}<button onClick={start} disabled={busy || permission !== "granted" || !microphones.length}><Play /> Start recording</button></span></footer>
    </section>
  </div>;
}
