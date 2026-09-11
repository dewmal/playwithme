import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AudioLines, CirclePlay, Clock3, LoaderCircle, Maximize2, RotateCcw, Scissors, Trash2, X } from "lucide-react";
import { useAppStore } from "../store";
import type { RecordingSection } from "../types";
import { backgroundTone, codeTheme, slideThemeStyle, visibleMarkdown } from "../lib/slides";
import { SlideMarkdown } from "./SlideMarkdown";

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

interface PresenterPanelProps {
  elapsed: number;
  paused: boolean;
  recording: boolean;
  processing: boolean;
  microphone: string;
  inputLevel: number;
  sections: RecordingSection[];
  retakeSectionId: string | null;
  close: () => void;
  removeSection: (id: string) => void;
  replaySection: (id: string) => Promise<string | null>;
  clearSections: () => void;
  retakeSection: (id: string) => void;
}

export function PresenterPanel({ elapsed, paused, recording, processing, microphone, inputLevel, sections, retakeSectionId, close, removeSection, replaySection, clearSections, retakeSection }: PresenterPanelProps) {
  const { slides, slideIndex, theme } = useAppStore();
  const [playingSectionId, setPlayingSectionId] = useState<string | null>(null);
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null);
  const [loadingSectionId, setLoadingSectionId] = useState<string | null>(null);
  const playbackVideo = useRef<HTMLVideoElement | null>(null);
  const current = slides[slideIndex];
  const next = slides[slideIndex + 1];
  const playingSection = sections.find((section) => section.id === playingSectionId);

  useEffect(() => {
    if (recording || (playingSectionId && !playingSection)) {
      setPlayingSectionId(null);
      setPlayingPreviewUrl(null);
    }
  }, [recording, playingSectionId, playingSection]);

  useEffect(() => {
    if (!playingSectionId) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setPlayingSectionId(null); setPlayingPreviewUrl(null); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [playingSectionId]);

  const openPlayback = async (id: string) => {
    setLoadingSectionId(id);
    try {
      const previewUrl = await replaySection(id);
      if (previewUrl) { setPlayingSectionId(id); setPlayingPreviewUrl(previewUrl); }
    } finally { setLoadingSectionId(null); }
  };

  const closePlayback = () => { setPlayingSectionId(null); setPlayingPreviewUrl(null); };

  return <aside className="presenter-panel" aria-label="Presenter view">
    <header>
      <div><span className="eyebrow">Presenter view</span><strong>Slide {slideIndex + 1} of {slides.length}</strong></div>
      <span className="presenter-head-actions"><AudioLines aria-label="Audio input active" /><button onClick={close} title="Close presenter view" aria-label="Close presenter view"><X /></button></span>
    </header>

    <section className={`presenter-timer${paused ? " paused" : ""}${recording ? "" : " ready"}`} aria-label={recording ? `${paused ? "Paused" : "Recording"} at ${clock(elapsed)}` : "Ready to record"}>
      <span className="record-dot" />
      <div><small>{recording ? (paused ? "Paused" : "Recording") : "Ready to record"}</small><b>{recording ? clock(elapsed) : "Press Start below"}</b></div>
      <Clock3 />
    </section>

    <section className="presenter-microphone" title={microphone}>
      <span className="mini-meter">{Array.from({ length: 5 }, (_, index) => <i key={index} style={{ height: `${Math.max(3, Math.min(14, inputLevel * 22 * (index % 2 ? 1 : .72)))}px` }} />)}</span>
      <div><small>Microphone</small><b>{microphone}</b></div>
    </section>

    <section className="recording-timeline" aria-label="Recording timeline">
      <div className="timeline-heading"><h2>Recording timeline</h2><span className="timeline-summary"><span>{sections.length} {sections.length === 1 ? "section" : "sections"}</span>{sections.length > 0 && <button onClick={() => { if (window.confirm("Permanently delete every recording for this presentation?")) clearSections(); }} disabled={recording || processing}>Clear all</button>}</span></div>
      {sections.length ? <div className="timeline-sections">{sections.map((section, index) => <article className={retakeSectionId === section.id ? "selected" : ""} key={section.id}>
        <span className="section-index">{index + 1}</span>
        <div><b>Section {index + 1}</b><small>Slide {section.slide + 1} · {clock(section.duration)}</small></div>
        <button onClick={() => openPlayback(section.id)} disabled={recording || loadingSectionId !== null || (!section.previewUrl && !section.videoPath)} title={`Replay section ${index + 1}`} aria-label={`Replay section ${index + 1}`}>{loadingSectionId === section.id ? <LoaderCircle className="spin" /> : <CirclePlay />}</button>
        <button onClick={() => retakeSection(section.id)} disabled={recording || processing} title={`Re-record section ${index + 1}`} aria-label={`Re-record section ${index + 1}`}><RotateCcw /></button>
        <button onClick={() => removeSection(section.id)} disabled={recording || processing} title={`Remove section ${index + 1}`} aria-label={`Remove section ${index + 1}`}><Trash2 /></button>
      </article>)}</div> : <div className="timeline-empty"><Scissors /><span><b>Record in sections</b><small>Stop after each part. You can remove or re-record it later.</small></span></div>}
      {playingSection && playingPreviewUrl && <div className="section-playback-backdrop" role="presentation" onClick={closePlayback}>
        <div className="section-playback" role="dialog" aria-modal="true" aria-label={`Section ${sections.indexOf(playingSection) + 1} recorded preview`} onClick={(event) => event.stopPropagation()}>
          <header><span><b>Section {sections.indexOf(playingSection) + 1}</b><small>Recorded preview · {clock(playingSection.duration)}</small></span><span className="playback-actions"><button onClick={() => playbackVideo.current?.requestFullscreen()} title="Open fullscreen" aria-label="Open preview fullscreen"><Maximize2 /></button><button onClick={closePlayback} title="Close preview" aria-label="Close section preview"><X /></button></span></header>
          <video ref={playbackVideo} src={playingPreviewUrl} controls autoPlay playsInline />
        </div>
      </div>}
      {retakeSectionId && !recording && <p className="retake-notice"><RotateCcw /> Your next recording will replace the selected section.</p>}
    </section>

    <section className="presenter-notes">
      <h2>Speaker notes</h2>
      {current?.notes
        ? <div className="presenter-notes-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{current.notes}</ReactMarkdown></div>
        : <p className="presenter-empty">No notes for this slide. Add them after <code>???</code> in the source.</p>}
    </section>

    <section className="presenter-next">
      <h2>Up next</h2>
      {next ? <div className={`next-slide-preview ${backgroundTone(next.background)} code-theme-${codeTheme(next, theme)}`} style={slideThemeStyle(next)}>
        <div className="next-slide-content"><SlideMarkdown markdown={visibleMarkdown(next, next.steps.length - 1)} rich={false} /></div>
        <span>{String(slideIndex + 2).padStart(2, "0")}</span>
      </div> : <p className="presenter-empty">This is the final slide.</p>}
    </section>
  </aside>;
}
