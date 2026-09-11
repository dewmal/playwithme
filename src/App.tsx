import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CircleStop, Code2, Download, FilePlus2, FolderOpen, Fullscreen, LoaderCircle, Menu, Mic, PanelRight, Pause, Play, Save, Sparkles } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { SlideCanvas } from "./components/SlideCanvas";
import { DrawingToolbar } from "./components/DrawingToolbar";
import { SourcePanel } from "./components/SourcePanel";
import { ExportDialog } from "./components/ExportDialog";
import { HelpDialog } from "./components/HelpDialog";
import { useAppStore } from "./store";
import { choosePresentationProject, createPresentation, openPresentation, savePresentation } from "./lib/native";
import { PresentationPicker } from "./components/PresentationPicker";
import { useRecorder } from "./hooks/useRecorder";
import { NEW_PRESENTATION_MARKDOWN } from "./lib/sample";
import { PresenterPanel } from "./components/PresenterPanel";

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function App() {
  const store = useAppStore(); const [source, setSource] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false); const [presenterView, setPresenterView] = useState(false); const [toast, setToast] = useState(""); const [picker, setPicker] = useState<{ folder: string; presentations: string[] } | null>(null);
  const recorder = useRecorder();
  const notify = (message: string, duration = 2600) => { setToast(message); window.setTimeout(() => setToast(""), duration); };
  const newDeck = async () => {
    try {
      const result = await createPresentation(NEW_PRESENTATION_MARKDOWN, store.folder);
      if (!result) return;
      const current = useAppStore.getState();
      if (current.folder && current.presentationFile) await savePresentation(current.folder, current.presentationFile, current.markdown, current.drawings, current.outputs);
      store.loadDeck(result.folder, result.presentationFile, result.presentations, result.markdown); useAppStore.setState({ drawings: result.drawings, outputs: result.outputs }); notify("New presentation created");
    } catch (error) { notify(error instanceof Error ? error.message : String(error)); }
  };
  const loadDeck = async (folder: string, presentationFile: string, presentations: string[]) => {
    const current = useAppStore.getState();
    if (current.folder && current.presentationFile) await savePresentation(current.folder, current.presentationFile, current.markdown, current.drawings, current.outputs);
    const result = await openPresentation(folder, presentationFile, presentations);
    store.loadDeck(result.folder, result.presentationFile, result.presentations, result.markdown); useAppStore.setState({ drawings: result.drawings, outputs: result.outputs }); setPicker(null); notify(`${presentationFile} loaded`);
  };
  const openDeck = async () => { try { const project = await choosePresentationProject(); if (!project) { notify("Folder opening is available in the desktop app"); return; } if (!project.presentations.length) { notify("No Markdown presentations found in this folder"); return; } if (project.presentations.length === 1) await loadDeck(project.folder, project.presentations[0], project.presentations); else setPicker(project); } catch (error) { notify(error instanceof Error ? error.message : String(error), 6000); } };
  const saveDeck = async () => { await savePresentation(store.folder, store.presentationFile, store.markdown, store.drawings, store.outputs); notify(store.folder ? "Presentation saved" : "Draft saved locally"); };
  const startRecording = async () => { try { await recorder.start(); setSource(false); setPresenterView(true); } catch (error) { notify(error instanceof Error ? error.message : "Microphone access was not granted", 8000); } };
  const stopRecording = async () => { try { const videoPath = await recorder.stop(); notify(videoPath ? "Recording ready to export" : "No video was captured"); } catch (error) { notify(error instanceof Error ? error.message : String(error), 8000); } finally { setPresenterView(false); } };
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
    const timeout = window.setTimeout(() => savePresentation(store.folder, store.presentationFile, store.markdown, store.drawings, store.outputs).catch(() => undefined), 800);
    return () => window.clearTimeout(timeout);
  }, [store.folder, store.presentationFile, store.markdown, store.drawings, store.outputs]);

  return <div className={`app mode-${store.mode}${presenterView ? " presenter-view" : ""}`}>
    {store.sidebarOpen && store.mode === "edit" && !presenterView && <Sidebar choosePresentation={() => store.folder && store.presentationFiles.length > 1 && setPicker({ folder: store.folder, presentations: store.presentationFiles })} />}
    <main className="workspace">
      <header className="topbar">
        <div className="top-left">{!store.sidebarOpen && <button onClick={() => store.setSidebar(true)} title="Show slides"><Menu /></button>}<button className="deck-name" onClick={() => store.folder && store.presentationFiles.length > 1 && setPicker({ folder: store.folder, presentations: store.presentationFiles })}>{store.presentationFile?.split(/[\\/]/).at(-1)?.replace(/\.md$/i, "") ?? "Untitled presentation"}{store.presentationFiles.length > 1 && <ChevronDown />}</button><span className="save-state"><i /> Saved</span></div>
        <div className="top-actions">
          <button onClick={newDeck}><FilePlus2 /> New</button><button onClick={openDeck}><FolderOpen /> Open</button><button onClick={saveDeck}><Save /> Save</button><button onClick={() => setSource(!source)} className={source ? "active" : ""}><Code2 /> Source</button>
          <button onClick={() => setHelpOpen(true)}><CircleHelp /> Help</button><button onClick={() => setExportOpen(true)}><Download /> Export</button>
          <button className="present-button" onClick={togglePresent}><Play /> Present <ChevronDown /></button>
        </div>
      </header>
      <section className="workspace-body"><SlideCanvas />{source && store.mode === "edit" && !presenterView && <SourcePanel close={() => setSource(false)} />}{presenterView && <PresenterPanel elapsed={recorder.elapsed} paused={recorder.paused} close={() => setPresenterView(false)} />}</section>
      <DrawingToolbar />
      <footer className="controlbar">
        <div className="shortcut-hint"><Sparkles /> <span><kbd>Space</kbd> next step</span><span><kbd>D</kbd> draw</span><span><kbd>R</kbd> run</span></div>
        <div className="nav-controls"><button onClick={store.previous} disabled={store.slideIndex === 0 && store.step === 0}><ChevronLeft /></button><strong>{store.slideIndex + 1}</strong><span>/ {store.slides.length}</span><button onClick={store.next} disabled={store.slideIndex === store.slides.length - 1 && store.step === store.slides.at(-1)!.steps.length - 1}><ChevronRight /></button></div>
        <div className="session-controls">
          {recorder.processingStatus ? <button className="processing" disabled><LoaderCircle className="spin" /><b>{recorder.processingStatus}</b></button> : store.recording ? <><button className={presenterView ? "presenter-toggle active" : "presenter-toggle"} onClick={() => setPresenterView(!presenterView)} title="Toggle presenter view"><PanelRight /> Presenter</button><button className={recorder.paused ? "resume-recording" : "pause-recording"} onClick={recorder.paused ? recorder.resume : recorder.pause} title={recorder.paused ? "Resume recording" : "Pause recording"}>{recorder.paused ? <Play /> : <Pause />}{recorder.paused ? "Resume" : "Pause"}</button><button className={`recording${recorder.paused ? " paused" : ""}`} onClick={stopRecording}><CircleStop /><b>{recorder.paused ? "PAUSED" : "REC"}</b> {clock(recorder.elapsed)}</button></> : <button onClick={startRecording}><Mic /> Record</button>}
          <button onClick={togglePresent} title="Fullscreen"><Fullscreen /></button>
        </div>
      </footer>
    </main>
    {exportOpen && <ExportDialog close={() => setExportOpen(false)} videoPath={recorder.lastVideoPath} processingStatus={recorder.processingStatus} />}
    {helpOpen && <HelpDialog close={() => setHelpOpen(false)} />}
    {picker && <PresentationPicker folder={picker.folder} presentations={picker.presentations} current={store.folder === picker.folder ? store.presentationFile : null} close={() => setPicker(null)} select={(name) => loadDeck(picker.folder, name, picker.presentations).catch((error) => notify(error instanceof Error ? error.message : String(error), 6000))} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
