import { isValidElement, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Maximize2, Minimize2, Paintbrush } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { useAppStore } from "../store";
import { loadProjectImage } from "../lib/native";
import { backgroundTone, codeTheme, slideThemeStyle, visibleMarkdown } from "../lib/slides";
import { CodeCell } from "./CodeCell";
import { DrawingLayer } from "./DrawingLayer";
import { EChart } from "./EChart";
import { SlideMarkdown } from "./SlideMarkdown";
import type { CameraLayout } from "../types";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  return "";
}

const imageMimeTypes: Record<string, string> = {
  avif: "image/avif", gif: "image/gif", jpeg: "image/jpeg", jpg: "image/jpeg",
  png: "image/png", svg: "image/svg+xml", webp: "image/webp",
};

function ProjectImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const folder = useAppStore((state) => state.folder);
  const [resolvedSource, setResolvedSource] = useState(src);
  useEffect(() => {
    if (!src || !folder || !isTauri() || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(src)) {
      setResolvedSource(src);
      return;
    }
    let objectUrl: string | undefined;
    let active = true;
    const source = decodeURIComponent(src.split(/[?#]/, 1)[0]).replace(/^\.\//, "");
    setResolvedSource(undefined);
    loadProjectImage(folder, source).then((bytes) => {
      if (!active) return;
      const extension = source.split(".").at(-1)?.toLowerCase() ?? "";
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: imageMimeTypes[extension] }));
      setResolvedSource(objectUrl);
    }).catch(() => { if (active) setResolvedSource(src); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [folder, src]);
  return <img {...props} src={resolvedSource} />;
}

function CameraPreview({ stream, layout, move }: { stream: MediaStream; layout: CameraLayout; move: (layout: CameraLayout) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientX: 0, size: 0, slideWidth: 1 });
  const layoutBeforeFit = useRef<CameraLayout | null>(null);
  useEffect(() => {
    if (!video.current) return;
    video.current.srcObject = stream;
    video.current.play().catch(() => undefined);
    return () => { if (video.current) video.current.srcObject = null; };
  }, [stream]);
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const slide = event.currentTarget.parentElement;
    if (!slide) return;
    const bounds = slide.getBoundingClientRect();
    dragOffset.current = { x: (event.clientX - bounds.left) / bounds.width - layout.x, y: (event.clientY - bounds.top) / bounds.height - layout.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const slide = event.currentTarget.parentElement;
    if (!slide) return;
    const bounds = slide.getBoundingClientRect();
    move({ ...layout, x: (event.clientX - bounds.left) / bounds.width - dragOffset.current.x, y: (event.clientY - bounds.top) / bounds.height - dragOffset.current.y });
  };
  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 0.025 : 0.008;
    const offsets: Partial<Record<string, [number, number]>> = { ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount] };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    move({ ...layout, x: layout.x + offset[0], y: layout.y + offset[1] });
  };
  const beginResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const slide = event.currentTarget.parentElement?.parentElement;
    if (!slide) return;
    event.stopPropagation();
    resizeStart.current = { clientX: event.clientX, size: layout.size, slideWidth: slide.getBoundingClientRect().width };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.stopPropagation();
    move({ ...layout, size: resizeStart.current.size + (event.clientX - resizeStart.current.clientX) / resizeStart.current.slideWidth });
  };
  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    move({ ...layout, size: layout.size + direction * (event.shiftKey ? 0.04 : 0.01) });
  };
  const fittedToScreen = layout.size >= 0.999 && layout.x <= 0.001 && layout.y <= 0.001;
  const toggleFit = () => {
    if (fittedToScreen && layoutBeforeFit.current) {
      const previous = layoutBeforeFit.current;
      layoutBeforeFit.current = null;
      move(previous);
      return;
    }
    layoutBeforeFit.current = layout;
    move({ x: 0, y: 0, size: 1 });
  };
  return <div className="camera-preview" style={{ left: `${layout.x * 100}%`, top: `${layout.y * 100}%`, width: `${layout.size * 100}%` }} role="button" tabIndex={0} aria-label="Move camera preview" title="Drag to move camera" onPointerDown={beginDrag} onPointerMove={drag} onKeyDown={nudge}><video ref={video} autoPlay muted playsInline /><span>Drag to move · resize from the corner</span><button type="button" className="camera-fit-toggle" aria-label={fittedToScreen ? "Restore previous camera size" : "Fit camera to screen"} title={fittedToScreen ? "Restore previous size" : "Fit to screen"} onPointerDown={(event) => event.stopPropagation()} onClick={toggleFit}>{fittedToScreen ? <Minimize2 /> : <Maximize2 />}</button><button type="button" className="camera-resize-handle" aria-label="Resize camera preview" title="Drag to resize camera" onPointerDown={beginResize} onPointerMove={resize} onKeyDown={resizeWithKeyboard} /></div>;
}

export function SlideCanvas({ exportMode = false, forcedStep, cameraStream, showCamera = false, cameraLayout, moveCamera, notify }: { exportMode?: boolean; forcedStep?: number; cameraStream?: MediaStream | null; showCamera?: boolean; cameraLayout?: CameraLayout; moveCamera?: (layout: CameraLayout) => void; notify?: (message: string) => void }) {
  const { slides, slideIndex, step, mode, theme, recording, slideResetRevisions, applyCurrentSlideStyleToAll } = useAppStore(); const slide = slides[slideIndex];
  const resolvedCodeTheme = codeTheme(slide, theme);
  const manualChartPlayback = !exportMode && (mode === "present" || recording);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const markdown = slide ? visibleMarkdown(slide, forcedStep ?? step) : "# No slides";
  const components = useMemo(() => ({
    img: ProjectImage,
    pre(props: { children?: ReactNode }) {
      return isValidElement(props.children) && (props.children.type === CodeCell || props.children.type === EChart) ? props.children : <pre>{props.children}</pre>;
    },
    code(props: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(props.className ?? "");
      if (match?.[1] === "python") {
        const source = textFromNode(props.children);
        const hash = Array.from(source).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7).toString(36);
        const slideId = slide?.id ?? "slide";
        const id = `${slideId}-python-${hash}`;
        return exportMode ? <code className={props.className}>{props.children}</code> : <CodeCell id={id} slideId={slideId} initialCode={source} theme={resolvedCodeTheme} />;
      }
      if (match?.[1] === "echarts") {
        const slideId = slide?.id ?? "slide";
        return <EChart source={textFromNode(props.children)} theme={resolvedCodeTheme} replayKey={`${slideId}-${slideResetRevisions[slideId] ?? 0}`} manualPlayback={manualChartPlayback} />;
      }
      return <code className={props.className}>{props.children}</code>;
    },
  }), [slide?.id, slideResetRevisions, exportMode, manualChartPlayback, resolvedCodeTheme]);

  useEffect(() => setMenu(null), [slideIndex, mode]);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("resize", close); };
  }, [menu]);

  const openMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (exportMode || mode !== "edit") return;
    event.preventDefault();
    setMenu({ x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 70) });
  };
  const applyToAll = () => {
    applyCurrentSlideStyleToAll();
    setMenu(null);
    notify?.("Slide theme applied to all slides");
  };

  return <div className="stage-shell">
    <article className={`slide-canvas ${backgroundTone(slide?.background)} code-theme-${resolvedCodeTheme}`} style={slideThemeStyle(slide)} data-slide-index={slideIndex} onContextMenu={openMenu}>
      <div className="slide-accent" />
      <div className="slide-content"><SlideMarkdown markdown={markdown} components={components} /></div>
      <div className="slide-folio">{String(slideIndex + 1).padStart(2, "0")} <span>/</span> {String(slides.length).padStart(2, "0")}</div>
      <DrawingLayer />
      {!exportMode && showCamera && cameraStream && cameraLayout && moveCamera && <CameraPreview stream={cameraStream} layout={cameraLayout} move={moveCamera} />}
    </article>
    {menu && <div className="slide-context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()}><button role="menuitem" onClick={applyToAll}><Paintbrush /><span><b>Apply theme to all slides</b><small>Copy fonts, colors, background, and code style</small></span></button></div>}
  </div>;
}
