import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleStop, Code2, Download, FolderOpen, Fullscreen, Menu, Mic, Play, Save, Sparkles } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { SlideCanvas } from "./components/SlideCanvas";
import { DrawingToolbar } from "./components/DrawingToolbar";
import { SourcePanel } from "./components/SourcePanel";
import { ExportDialog } from "./components/ExportDialog";
import { useAppStore } from "./store";
import { openPresentation, savePresentation } from "./lib/native";
import { useRecorder } from "./hooks/useRecorder";

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function App() {
  const store = useAppStore(); const [source, setSource] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [toast, setToast] = useState("");
  const recorder = useRecorder();
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const openDeck = async () => { const result = await openPresentation(); if (!result) { notify("Folder opening is available in the desktop app"); return; } store.loadDeck(result.folder, result.markdown); useAppStore.setState({ drawings: result.drawings }); notify("Presentation loaded"); };
  const saveDeck = async () => { await savePresentation(store.folder, store.markdown, store.drawings, store.outputs); notify(store.folder ? "Saved to presentation folder" : "Draft saved locally"); };
  const togglePresent = async () => { const presenting = store.mode === "present"; store.setMode(presenting ? "edit" : "present"); if (!presenting) await document.documentElement.requestFullscreen?.().catch(() => undefined); else if (document.fullscreenElement) await document.exitFullscreen(); };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("textarea, input, .cm-editor")) return;
      if (event.key === " " || event.key === "ArrowRight") { event.preventDefault(); store.next(); }
      else if (event.key === "ArrowLeft") store.previous();
      else if (event.key.toLowerCase() === "d") store.setTool("pen");
      else if (event.key.toLowerCase() === "l") store.setTool("laser");
      else if (event.key.toLowerCase() === "e") store.setTool("eraser");
      else if (event.key.toLowerCase() === "f") togglePresent();
      else if (event.key.toLowerCase() === "r") document.querySelector<HTMLButtonElement>(".code-cell .cell-bar button")?.click();
      else if (event.key === "Escape") store.setTool("select");
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });

  useEffect(() => {
    if (!store.folder) return;
    const timeout = window.setTimeout(() => savePresentation(store.folder, store.markdown, store.drawings, store.outputs).catch(() => undefined), 800);
    return () => window.clearTimeout(timeout);
  }, [store.folder, store.markdown, store.drawings, store.outputs]);

  return <div className={`app mode-${store.mode}`}>
    {store.sidebarOpen && store.mode === "edit" && <Sidebar />}
    <main className="workspace">
      <header className="topbar">
        <div className="top-left">{!store.sidebarOpen && <button onClick={() => store.setSidebar(true)} title="Show slides"><Menu /></button>}<span className="deck-name">{store.folder?.split(/[\\/]/).at(-1) ?? "Untitled presentation"}</span><span className="save-state"><i /> Saved</span></div>
        <div className="top-actions">
          <button onClick={openDeck}><FolderOpen /> Open</button><button onClick={saveDeck}><Save /> Save</button><button onClick={() => setSource(!source)} className={source ? "active" : ""}><Code2 /> Source</button>
          <button onClick={() => setExportOpen(true)}><Download /> Export</button>
          <button className="present-button" onClick={togglePresent}><Play /> Present <ChevronDown /></button>
        </div>
      </header>
      <section className="workspace-body"><SlideCanvas />{source && store.mode === "edit" && <SourcePanel close={() => setSource(false)} />}</section>
      <DrawingToolbar />
      <footer className="controlbar">
        <div className="shortcut-hint"><Sparkles /> <span><kbd>Space</kbd> next step</span><span><kbd>D</kbd> draw</span><span><kbd>R</kbd> run</span></div>
        <div className="nav-controls"><button onClick={store.previous} disabled={store.slideIndex === 0 && store.step === 0}><ChevronLeft /></button><strong>{store.slideIndex + 1}</strong><span>/ {store.slides.length}</span><button onClick={store.next} disabled={store.slideIndex === store.slides.length - 1 && store.step === store.slides.at(-1)!.steps.length - 1}><ChevronRight /></button></div>
        <div className="session-controls">
          {store.recording ? <button className="recording" onClick={() => recorder.stop().then(() => notify("Session saved"))}><CircleStop /><b>REC</b> {clock(recorder.elapsed)}</button> : <button onClick={() => recorder.start().catch(() => notify("Microphone access was not granted"))}><Mic /> Record</button>}
          <button onClick={togglePresent} title="Fullscreen"><Fullscreen /></button>
        </div>
      </footer>
    </main>
    {exportOpen && <ExportDialog close={() => setExportOpen(false)} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
