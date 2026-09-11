import { create } from "zustand";
import type { CellOutput, Drawing, Slide, TimelineEvent, Tool } from "./types";
import { parseSlides, setSlideBackground as updateSlideBackground } from "./lib/slides";
import { SAMPLE_MARKDOWN } from "./lib/sample";

type Mode = "edit" | "present";
export type Theme = "light" | "dark";

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("presenta-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface AppState {
  folder: string | null; presentationFile: string | null; presentationFiles: string[]; markdown: string; slides: Slide[]; slideIndex: number; step: number;
  mode: Mode; theme: Theme; sidebarOpen: boolean; tool: Tool; color: string; width: number;
  drawings: Drawing[]; redoStack: Drawing[]; outputs: Record<string, CellOutput>;
  recording: boolean; recordingPaused: boolean; recordStarted: number | null; recordPausedAt: number | null; events: TimelineEvent[];
  setMarkdown: (value: string) => void; setSlideBackground: (color: string | null) => void; loadDeck: (folder: string | null, presentationFile: string | null, presentationFiles: string[], markdown: string) => void;
  addSlide: () => void; goTo: (index: number, step?: number) => void; next: () => void; previous: () => void;
  setMode: (mode: Mode) => void; setTheme: (theme: Theme) => void; setSidebar: (open: boolean) => void; setTool: (tool: Tool) => void;
  setColor: (color: string) => void; setWidth: (width: number) => void;
  addDrawing: (drawing: Drawing) => void; undo: () => void; redo: () => void; clearSlide: () => void;
  setOutput: (output: CellOutput) => void; startRecording: () => void; pauseRecording: () => void; resumeRecording: () => void; stopRecording: () => void; addEvent: (event: Omit<TimelineEvent, "time">) => void;
}

function timedEvent(start: number | null, event: Omit<TimelineEvent, "time">): TimelineEvent {
  return { ...event, time: start ? (performance.now() - start) / 1000 : 0 };
}

export const useAppStore = create<AppState>((set, get) => ({
  folder: null, presentationFile: null, presentationFiles: [], markdown: SAMPLE_MARKDOWN, slides: parseSlides(SAMPLE_MARKDOWN), slideIndex: 0, step: 0,
  mode: "edit", theme: initialTheme(), sidebarOpen: true, tool: "select", color: "#ff4d67", width: 4,
  drawings: [], redoStack: [], outputs: {}, recording: false, recordingPaused: false, recordStarted: null, recordPausedAt: null, events: [],
  setMarkdown: (markdown) => set((state) => {
    const slides = parseSlides(markdown);
    return { markdown, slides, slideIndex: Math.min(state.slideIndex, Math.max(0, slides.length - 1)), step: 0 };
  }),
  setSlideBackground: (color) => set((state) => {
    const markdown = updateSlideBackground(state.markdown, state.slideIndex, color);
    return { markdown, slides: parseSlides(markdown) };
  }),
  loadDeck: (folder, presentationFile, presentationFiles, markdown) => set({ folder, presentationFile, presentationFiles, markdown, slides: parseSlides(markdown), slideIndex: 0, step: 0, drawings: [], outputs: {} }),
  addSlide: () => {
    const current = get();
    const content = "# Untitled slide\n\nStart writing your presentation.";
    const markdown = current.markdown.trim()
      ? `${current.markdown.trimEnd()}\n\n---\n\n${content}\n`
      : `${content}\n`;
    const slides = parseSlides(markdown);
    set({ markdown, slides, slideIndex: slides.length - 1, step: 0 });
    get().addEvent({ type: "slide", slide: slides.length - 1 });
  },
  goTo: (slideIndex, step = 0) => {
    set({ slideIndex, step }); get().addEvent({ type: "slide", slide: slideIndex });
  },
  next: () => {
    const s = get(); const slide = s.slides[s.slideIndex];
    if (!slide) return;
    if (s.step < slide.steps.length - 1) { set({ step: s.step + 1 }); s.addEvent({ type: "step", step: s.step + 1, slide: s.slideIndex }); }
    else if (s.slideIndex < s.slides.length - 1) { set({ slideIndex: s.slideIndex + 1, step: 0 }); s.addEvent({ type: "slide", slide: s.slideIndex + 1 }); }
  },
  previous: () => {
    const s = get();
    if (s.step > 0) set({ step: s.step - 1 });
    else if (s.slideIndex > 0) { const i = s.slideIndex - 1; set({ slideIndex: i, step: s.slides[i].steps.length - 1 }); }
    get().addEvent({ type: "navigate-back", slide: get().slideIndex, step: get().step });
  },
  setMode: (mode) => set({ mode }),
  setTheme: (theme) => { window.localStorage.setItem("presenta-theme", theme); set({ theme }); },
  setSidebar: (sidebarOpen) => set({ sidebarOpen }), setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }), setWidth: (width) => set({ width }),
  addDrawing: (drawing) => { set((s) => ({ drawings: [...s.drawings, drawing], redoStack: [] })); get().addEvent({ type: "drawing", slide: get().slideIndex, data: drawing }); },
  undo: () => set((s) => { const mine = [...s.drawings]; const last = mine.pop(); return last ? { drawings: mine, redoStack: [...s.redoStack, last] } : s; }),
  redo: () => set((s) => { const redoStack = [...s.redoStack]; const last = redoStack.pop(); return last ? { drawings: [...s.drawings, last], redoStack } : s; }),
  clearSlide: () => { const id = get().slides[get().slideIndex]?.id; set((s) => ({ drawings: s.drawings.filter((d) => d.slideId !== id) })); get().addEvent({ type: "drawing-clear", slide: get().slideIndex }); },
  setOutput: (output) => { set((s) => ({ outputs: { ...s.outputs, [output.cellId]: output } })); get().addEvent({ type: "cell-output", cell: output.cellId, data: output }); },
  startRecording: () => { const now = performance.now(); set({ recording: true, recordingPaused: false, recordStarted: now, recordPausedAt: null, events: [{ time: 0, type: "slide", slide: get().slideIndex }] }); },
  pauseRecording: () => { const s = get(); if (s.recording && !s.recordingPaused) set({ recordingPaused: true, recordPausedAt: performance.now() }); },
  resumeRecording: () => {
    const s = get();
    if (!s.recording || !s.recordingPaused) return;
    const now = performance.now();
    const pausedFor = s.recordPausedAt === null ? 0 : now - s.recordPausedAt;
    const recordStarted = s.recordStarted === null ? null : s.recordStarted + pausedFor;
    const resumedState: TimelineEvent = { time: recordStarted === null ? 0 : (now - recordStarted) / 1000, type: "slide", slide: s.slideIndex, step: s.step };
    set({ recordingPaused: false, recordPausedAt: null, recordStarted, events: [...s.events, resumedState] });
  },
  stopRecording: () => set({ recording: false, recordingPaused: false, recordPausedAt: null }),
  addEvent: (event) => { const s = get(); if (s.recording && !s.recordingPaused) set({ events: [...s.events, timedEvent(s.recordStarted, event)] }); },
}));
