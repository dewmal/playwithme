import { isValidElement, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Paintbrush } from "lucide-react";
import { useAppStore } from "../store";
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

function CameraPreview({ stream, layout, move }: { stream: MediaStream; layout: CameraLayout; move: (layout: CameraLayout) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
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
  return <div className="camera-preview" style={{ left: `${layout.x * 100}%`, top: `${layout.y * 100}%`, width: `${layout.size * 100}%` }} role="button" tabIndex={0} aria-label="Move camera preview" title="Drag to move camera" onPointerDown={beginDrag} onPointerMove={drag} onKeyDown={nudge}><video ref={video} autoPlay muted playsInline /><span>Drag to move</span></div>;
}

export function SlideCanvas({ exportMode = false, forcedStep, cameraStream, showCamera = false, cameraLayout, moveCamera, notify }: { exportMode?: boolean; forcedStep?: number; cameraStream?: MediaStream | null; showCamera?: boolean; cameraLayout?: CameraLayout; moveCamera?: (layout: CameraLayout) => void; notify?: (message: string) => void }) {
  const { slides, slideIndex, step, mode, theme, applyCurrentSlideStyleToAll } = useAppStore(); const slide = slides[slideIndex];
  const resolvedCodeTheme = codeTheme(slide, theme);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const markdown = slide ? visibleMarkdown(slide, forcedStep ?? step) : "# No slides";
  const components = useMemo(() => ({
    pre(props: { children?: ReactNode }) {
      return isValidElement(props.children) && (props.children.type === CodeCell || props.children.type === EChart) ? props.children : <pre>{props.children}</pre>;
    },
    code(props: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(props.className ?? "");
      if (match?.[1] === "python") {
        const source = textFromNode(props.children);
        const hash = Array.from(source).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7).toString(36);
        const id = `${slide?.id ?? "slide"}-python-${hash}`;
        return exportMode ? <code className={props.className}>{props.children}</code> : <CodeCell id={id} initialCode={source} theme={resolvedCodeTheme} />;
      }
      if (match?.[1] === "echarts") {
        return <EChart source={textFromNode(props.children)} theme={resolvedCodeTheme} />;
      }
      return <code className={props.className}>{props.children}</code>;
    },
  }), [slide?.id, exportMode, resolvedCodeTheme]);

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
