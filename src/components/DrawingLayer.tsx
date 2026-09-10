import { useRef, useState } from "react";
import type { Drawing, Point } from "../types";
import { useAppStore } from "../store";

const VIEW_W = 1600;
const VIEW_H = 900;

function pointInSvg(svg: SVGSVGElement, event: React.PointerEvent): Point {
  const rect = svg.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * VIEW_W, y: ((event.clientY - rect.top) / rect.height) * VIEW_H };
}

function DrawingShape({ drawing }: { drawing: Drawing }) {
  const [start, ...rest] = drawing.points; const end = rest.at(-1) ?? start;
  const common = { stroke: drawing.color, strokeWidth: drawing.width, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, opacity: drawing.tool === "highlighter" ? .35 : 1, "data-drawing": drawing.id };
  if (!start) return null;
  if (drawing.tool === "pen" || drawing.tool === "highlighter") return <polyline {...common} points={drawing.points.map((p) => `${p.x},${p.y}`).join(" ")} />;
  if (drawing.tool === "arrow") return <line {...common} x1={start.x} y1={start.y} x2={end.x} y2={end.y} markerEnd="url(#arrowhead)" />;
  if (drawing.tool === "rectangle") return <rect {...common} x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)} width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)} />;
  if (drawing.tool === "circle") return <ellipse {...common} cx={(start.x + end.x) / 2} cy={(start.y + end.y) / 2} rx={Math.abs(end.x - start.x) / 2} ry={Math.abs(end.y - start.y) / 2} />;
  if (drawing.tool === "text") return <text x={start.x} y={start.y} fill={drawing.color} fontSize={drawing.width * 7} fontFamily="Inter, sans-serif" data-drawing={drawing.id}>{drawing.text}</text>;
  return null;
}

export function DrawingLayer() {
  const svgRef = useRef<SVGSVGElement>(null); const [draft, setDraft] = useState<Drawing | null>(null); const [laser, setLaser] = useState<Point | null>(null);
  const { slides, slideIndex, drawings, tool, color, width, addDrawing } = useAppStore();
  const slideId = slides[slideIndex]?.id;
  const visible = drawings.filter((d) => d.slideId === slideId);
  const active = tool !== "select";

  const down = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!active || !svgRef.current) return;
    const point = pointInSvg(svgRef.current, event); event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "laser") { setLaser(point); return; }
    if (tool === "eraser") {
      const id = (event.target as SVGElement).dataset.drawing;
      if (id) useAppStore.setState((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
      return;
    }
    if (tool === "text") {
      const text = window.prompt("Annotation text");
      if (text) addDrawing({ id: crypto.randomUUID(), slideId, tool: "text", color, width, points: [point], text });
      return;
    }
    setDraft({ id: crypto.randomUUID(), slideId, tool, color, width: tool === "highlighter" ? width * 4 : width, points: [point] });
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return; const point = pointInSvg(svgRef.current, event);
    if (tool === "laser" && event.buttons) setLaser(point);
    if (!draft) return;
    setDraft({ ...draft, points: draft.tool === "pen" || draft.tool === "highlighter" ? [...draft.points, point] : [draft.points[0], point] });
  };
  const up = () => { if (draft && draft.points.length > 1) addDrawing(draft); setDraft(null); setLaser(null); };

  return <svg ref={svgRef} className={`drawing-layer ${active ? "active" : ""} tool-${tool}`} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill={color} /></marker></defs>
    {visible.map((drawing) => <DrawingShape key={drawing.id} drawing={drawing} />)}
    {draft && <DrawingShape drawing={draft} />}
    {laser && <><circle className="laser-glow" cx={laser.x} cy={laser.y} r="26" /><circle className="laser-dot" cx={laser.x} cy={laser.y} r="7" /></>}
  </svg>;
}
