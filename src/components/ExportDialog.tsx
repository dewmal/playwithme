import { Check, FileDown, Film, Layers3, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { exportPdf } from "../lib/export";
import { exportVideo } from "../lib/native";
import { useAppStore } from "../store";

export function ExportDialog({ close, videoPath, processingStatus }: { close: () => void; videoPath: string | null; processingStatus: string | null }) {
  const presentationFile = useAppStore((state) => state.presentationFile);
  const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const run = async (steps: boolean) => { setBusy(steps ? "steps" : "final"); setMessage(""); setError(""); try { await exportPdf(steps); setMessage("Export completed successfully."); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); } };
  const runVideo = async () => { if (!videoPath) return; setBusy("video"); setMessage(""); setError(""); try { if (await exportVideo(videoPath, presentationFile)) setMessage("Video exported successfully."); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(null); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="export-dialog">
    <header><div><span className="eyebrow">Publish</span><h2>Export your story</h2><p>Frozen outputs and annotations are included exactly as shown.</p></div><button onClick={close}><X /></button></header>
    <div className="export-grid">
      <button className="export-card" onClick={() => run(false)} disabled={!!busy}><span className="export-icon coral"><FileDown /></span><span><b>Final-state PDF</b><small>One polished page per slide</small></span>{busy === "final" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <button className="export-card" onClick={() => run(true)} disabled={!!busy}><span className="export-icon yellow"><Layers3 /></span><span><b>Step-by-step PDF</b><small>One page for every reveal</small></span>{busy === "steps" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <button className={`export-card${videoPath ? "" : " disabled"}`} onClick={runVideo} disabled={!!busy || !videoPath}><span className="export-icon dark"><Film /></span><span><b>Session video</b><small>{processingStatus ?? (videoPath ? "Choose an MP4 name and destination" : "Saved as MP4 when a recorded session ends")}</small></span>{processingStatus || busy === "video" ? <LoaderCircle className="spin" /> : videoPath ? <span className="arrow">→</span> : <em>Record first</em>}</button>
    </div>
    {message && <div className="success"><Check /> {message}</div>}
    {error && <div className="export-error">{error}</div>}
  </section></div>;
}
