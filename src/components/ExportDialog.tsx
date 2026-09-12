import { Check, FileDown, Film, Layers3, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { exportPdf, type ExportProgress } from "../lib/export";

export function ExportDialog({ close, sectionCount, processingStatus, exportRecording }: { close: () => void; sectionCount: number; processingStatus: string | null; exportRecording: (onProgress?: (percent: number, label: string) => void) => Promise<boolean> }) {
  const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const fail = (reason: unknown) => { setProgress(null); setError(reason instanceof Error ? reason.message : String(reason)); };
  const run = async (steps: boolean) => { setBusy(steps ? "steps" : "final"); setProgress(null); setMessage(""); setError(""); try { await exportPdf(steps, setProgress); setMessage("Export completed successfully."); } catch (reason) { fail(reason); } finally { setBusy(null); } };
  const runVideo = async () => { if (!sectionCount || processingStatus) return; setBusy("video"); setProgress(null); setMessage(""); setError(""); try { const exported = await exportRecording((percent, label) => setProgress({ percent, label })); if (exported) setMessage("Video exported successfully."); else setProgress(null); } catch (reason) { fail(reason); } finally { setBusy(null); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="export-dialog">
    <header><div><span className="eyebrow">Publish</span><h2>Export your story</h2><p>Frozen outputs and annotations are included exactly as shown.</p></div><button onClick={close}><X /></button></header>
    <div className="export-grid">
      <button className="export-card" onClick={() => run(false)} disabled={!!busy}><span className="export-icon coral"><FileDown /></span><span><b>Final-state PDF</b><small>One polished page per slide</small></span>{busy === "final" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <button className="export-card" onClick={() => run(true)} disabled={!!busy}><span className="export-icon yellow"><Layers3 /></span><span><b>Step-by-step PDF</b><small>One page for every reveal</small></span>{busy === "steps" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <button className={`export-card${sectionCount && !processingStatus ? "" : " disabled"}`} onClick={runVideo} disabled={!!busy || !!processingStatus || !sectionCount}><span className="export-icon dark"><Film /></span><span><b>Session video</b><small>{processingStatus ?? (sectionCount ? `Combine ${sectionCount} ${sectionCount === 1 ? "section" : "sections"} and export` : "Record sections before exporting")}</small></span>{processingStatus || busy === "video" ? <LoaderCircle className="spin" /> : sectionCount ? <span className="arrow">→</span> : <em>Record first</em>}</button>
    </div>
    {progress && <div className="export-progress" aria-live="polite">
      <div className="export-progress-copy"><span>{progress.label}</span><b>{progress.percent}%</b></div>
      <div className="export-progress-track" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ width: `${progress.percent}%` }} /></div>
    </div>}
    {message && <div className="success"><Check /> {message}</div>}
    {error && <div className="export-error">{error}</div>}
  </section></div>;
}
