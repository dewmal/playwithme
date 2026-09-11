import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { Check, LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { pythonKernel } from "../lib/python";
import { useAppStore } from "../store";

interface Props { id: string; initialCode: string; theme: "light" | "dark" }

export function CodeCell({ id, initialCode, theme }: Props) {
  const [code, setCode] = useState(initialCode.trim());
  const [running, setRunning] = useState(false);
  const output = useAppStore((s) => s.outputs[id]);
  const setOutput = useAppStore((s) => s.setOutput);
  const addEvent = useAppStore((s) => s.addEvent);

  useEffect(() => setCode(initialCode.trim()), [initialCode]);
  const run = async () => {
    setRunning(true); addEvent({ type: "run-cell", cell: id });
    try { setOutput(await pythonKernel.run(id, code)); }
    catch (error) { setOutput({ cellId: id, kind: "error", data: String(error), timestamp: Date.now() }); }
    finally { setRunning(false); }
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
