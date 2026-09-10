import type { CellOutput } from "../types";

type Pending = { resolve: (value: CellOutput) => void; reject: (reason?: unknown) => void; cellId: string };

export class PythonKernel {
  private worker = new Worker(new URL("../workers/python.worker.ts", import.meta.url), { type: "module" });
  private pending = new Map<string, Pending>();
  ready = false;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: string; kind: CellOutput["kind"]; data: string }>) => {
      const task = this.pending.get(event.data.id);
      if (!task) return;
      this.ready = true;
      task.resolve({ cellId: task.cellId, kind: event.data.kind, data: event.data.data, timestamp: Date.now() });
      this.pending.delete(event.data.id);
    };
    this.worker.onerror = (event) => {
      for (const task of this.pending.values()) task.reject(new Error(event.message));
      this.pending.clear();
    };
  }

  run(cellId: string, code: string) {
    const id = crypto.randomUUID();
    return new Promise<CellOutput>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, cellId });
      this.worker.postMessage({ id, code });
    });
  }
}

export const pythonKernel = new PythonKernel();
