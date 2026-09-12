import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { Check, LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { pythonKernel } from "../lib/python";
import { useAppStore } from "../store";

interface Props { id: string; slideId: string; initialCode: string; theme: "light" | "dark" }

export function CodeCell({ id, slideId, initialCode, theme }: Props) {
  const [code, setCode] = useState(initialCode.trim());
  const [running, setRunning] = useState(false);
  const runRevision = useRef(0);
  const output = useAppStore((s) => s.outputs[id]);
  const outputRevision = useAppStore((s) => s.outputRevision);
  const slideResetRevision = useAppStore((s) => s.slideResetRevisions[slideId] ?? 0);
  const setOutput = useAppStore((s) => s.setOutput);
  const addEvent = useAppStore((s) => s.addEvent);

  useEffect(() => setCode(initialCode.trim()), [initialCode]);
  useEffect(() => { runRevision.current += 1; setRunning(false); }, [outputRevision, slideResetRevision]);
  const run = async () => {
    const outputRevision = useAppStore.getState().outputRevision;
    const slideResetRevision = useAppStore.getState().slideResetRevisions[slideId] ?? 0;
    const currentRun = ++runRevision.current;
    setRunning(true); addEvent({ type: "run-cell", cell: id });
    try {
      const result = await pythonKernel.run(id, code);
      const current = useAppStore.getState();
      if (current.outputRevision === outputRevision && (current.slideResetRevisions[slideId] ?? 0) === slideResetRevision) setOutput(result);
    }
    catch (error) {
      const current = useAppStore.getState();
      if (current.outputRevision === outputRevision && (current.slideResetRevisions[slideId] ?? 0) === slideResetRevision) setOutput({ cellId: id, kind: "error", data: String(error), timestamp: Date.now() });
    }
    finally { if (runRevision.current === currentRun) setRunning(false); }
  };

  return <div className={`code-cell code-theme-${theme}`} data-cell-id={id}>
    <div className="cell-bar"><span><i /> Python</span><button onClick={run} disabled={running} title="Run cell (R)">
      {running ? <LoaderCircle className="spin" /> : <Play />} {running ? "Running…" : "Run"}
    </button></div>
    <CodeMirror value={code} onChange={setCode} extensions={[python()]} theme={theme} basicSetup={{ lineNumbers: true, foldGutter: false }} />
    {output && <div className={`cell-output ${output.kind}`}>
      <div className="output-label">{output.kind === "error" ? <TriangleAlert /> : <Check />} {output.kind === "error" ? "Error" : "Output"}</div>
      {output.kind === "html" ? <div className="rich-output" dangerouslySetInnerHTML={{ __html: output.data }} /> :
        output.kind === "image" ? <img src={output.data} alt="Python output" /> : <pre>{output.data}</pre>}
    </div>}
  </div>;
}
