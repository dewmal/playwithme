import { Check, FileDown, Film, Layers3, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { exportPdf } from "../lib/export";

export function ExportDialog({ close }: { close: () => void }) {
  const [busy, setBusy] = useState<string | null>(null); const [done, setDone] = useState(false);
  const run = async (steps: boolean) => { setBusy(steps ? "steps" : "final"); try { await exportPdf(steps); setDone(true); } finally { setBusy(null); } };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section className="export-dialog">
    <header><div><span className="eyebrow">Publish</span><h2>Export your story</h2><p>Frozen outputs and annotations are included exactly as shown.</p></div><button onClick={close}><X /></button></header>
    <div className="export-grid">
      <button className="export-card" onClick={() => run(false)} disabled={!!busy}><span className="export-icon coral"><FileDown /></span><span><b>Final-state PDF</b><small>One polished page per slide</small></span>{busy === "final" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <button className="export-card" onClick={() => run(true)} disabled={!!busy}><span className="export-icon yellow"><Layers3 /></span><span><b>Step-by-step PDF</b><small>One page for every reveal</small></span>{busy === "steps" ? <LoaderCircle className="spin" /> : <span className="arrow">→</span>}</button>
      <div className="export-card disabled"><span className="export-icon dark"><Film /></span><span><b>Session video</b><small>Saved as MP4 when a recorded session ends</small></span><em>Record first</em></div>
    </div>
    {done && <div className="success"><Check /> Export completed successfully.</div>}
  </section></div>;
}
