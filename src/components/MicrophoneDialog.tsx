import { AudioLines, ExternalLink, Mic, Play, RotateCcw, ShieldAlert, X } from "lucide-react";

type Props = {
  microphones: MediaDeviceInfo[];
  selectedDeviceId: string;
  selectedDeviceLabel: string;
  waveform: number[];
  inputLevel: number;
  permission: "prompt" | "granted" | "denied" | "unavailable";
  error: string;
  busy: boolean;
  close: () => void;
  select: (deviceId: string) => void;
  start: () => void;
  retry: () => void;
  openSettings: () => void;
};

export function MicrophoneDialog({ microphones, selectedDeviceId, selectedDeviceLabel, waveform, inputLevel, permission, error, busy, close, select, start, retry, openSettings }: Props) {
  const points = waveform.map((value, index) => `${(index / (waveform.length - 1)) * 100},${20 - value * 17}`).join(" ");
  const hearingInput = inputLevel > 0.025;

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="microphone-dialog" role="dialog" aria-modal="true" aria-labelledby="microphone-title">
      <header>
        <span className="microphone-icon"><Mic /></span>
        <div><span className="eyebrow">Recording input</span><h2 id="microphone-title">Choose a microphone</h2><p>Speak normally and check that the waveform moves.</p></div>
        <button onClick={close} aria-label="Close microphone setup"><X /></button>
      </header>

      {(permission === "denied" || permission === "unavailable") && <div className="microphone-permission-alert" role="alert">
        <ShieldAlert /><span><b>{permission === "denied" ? "Microphone permission required" : "Microphone unavailable"}</b><small>{error}</small></span>
        {permission === "denied" && <button onClick={openSettings}><ExternalLink /> Open System Settings</button>}
      </div>}

      <label className="microphone-select-label" htmlFor="microphone-select">Microphone</label>
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

      <footer><span>Tip: choose your external mic by name, then speak to test it.</span><span className="microphone-actions">{permission !== "granted" && <button className="retry-microphone" onClick={retry} disabled={busy}><RotateCcw /> Try again</button>}<button onClick={start} disabled={busy || permission !== "granted" || !microphones.length}><Play /> Start recording</button></span></footer>
    </section>
  </div>;
}
