import { Circle, Eraser, Highlighter, MousePointer2, MoveUpRight, Pencil, Redo2, RotateCcw, Square, Trash2, Type } from "lucide-react";
import { useAppStore } from "../store";
import type { Tool } from "../types";

const tools: [Tool, React.ReactNode, string][] = [
  ["select", <MousePointer2 />, "Select (Esc)"], ["pen", <Pencil />, "Pen (D)"], ["highlighter", <Highlighter />, "Highlighter"],
  ["arrow", <MoveUpRight />, "Arrow"], ["rectangle", <Square />, "Rectangle"], ["circle", <Circle />, "Circle"], ["text", <Type />, "Text"], ["eraser", <Eraser />, "Eraser (E)"],
];

export function DrawingToolbar() {
  const { tool, setTool, color, setColor, width, setWidth, undo, redo, clearSlide } = useAppStore();
  return <div className="drawing-toolbar">
    {tools.map(([id, icon, label]) => <button key={id} className={tool === id ? "active" : ""} onClick={() => setTool(id)} title={label}>{icon}</button>)}
    <span className="tool-separator" />
    <label className="color-well" title="Ink color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><span style={{ background: color }} /></label>
    <label className="stroke-size" title="Stroke width"><input type="range" min="2" max="14" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
    <span className="tool-separator" />
    <button onClick={undo} title="Undo"><RotateCcw /></button><button onClick={redo} title="Redo"><Redo2 /></button><button onClick={clearSlide} title="Clear slide"><Trash2 /></button>
  </div>;
}
