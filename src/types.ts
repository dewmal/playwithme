export type Tool = "select" | "pen" | "highlighter" | "arrow" | "rectangle" | "circle" | "text" | "laser" | "eraser";

export interface Slide { id: string; raw: string; steps: string[]; notes?: string }
export interface Point { x: number; y: number }
export interface Drawing {
  id: string; slideId: string; tool: Exclude<Tool, "select" | "laser" | "eraser">;
  color: string; width: number; points: Point[]; text?: string;
}
export interface CellOutput {
  cellId: string; kind: "text" | "html" | "image" | "error"; data: string; timestamp: number;
}
export interface TimelineEvent { time: number; type: string; slide?: number; step?: number; cell?: string; data?: unknown }
export interface SessionData {
  id: string; startedAt: string; duration: number; events: TimelineEvent[]; outputs: Record<string, CellOutput>; drawings: Drawing[];
}

export interface CameraLayout {
  /** Normalized against the slide, so preview and recorded output stay aligned. */
  x: number;
  y: number;
  size: number;
}
