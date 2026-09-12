import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { Check, LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { pythonKernel } from "../lib/python";
import { useAppStore } from "../store";

interface Props { id: string; slideId: string; initialCode: string; theme: "light" | "dark" }

function findInputPrompts(code: string) {
  const prompts: string[] = [];
  const pattern = /\binput\s*\(\s*(?:(["'])(.*?)\1\s*)?\)/g;
  for (const match of code.matchAll(pattern)) prompts.push(match[2] || `Input ${prompts.length + 1}`);
  return prompts;
}

export function CodeCell({ id, slideId, initialCode, theme }: Props) {
  const [code, setCode] = useState(initialCode.trim());
  const [inputs, setInputs] = useState<string[]>([]);
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [running, setRunning] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const runRevision = useRef(0);
  const output = useAppStore((s) => s.outputs[id]);
  const outputRevision = useAppStore((s) => s.outputRevision);
  const slideResetRevision = useAppStore((s) => s.slideResetRevisions[slideId] ?? 0);
  const setOutput = useAppStore((s) => s.setOutput);
  const addEvent = useAppStore((s) => s.addEvent);

  const inputPrompts = findInputPrompts(code);
  useEffect(() => setCode(initialCode.trim()), [initialCode]);
  useEffect(() => {
    setInputs((current) => inputPrompts.map((_, index) => current[index] ?? ""));
    setAwaitingInput(false);
  }, [code]);
  useEffect(() => { if (awaitingInput) firstInputRef.current?.focus(); }, [awaitingInput]);
  useEffect(() => { runRevision.current += 1; setRunning(false); setAwaitingInput(false); }, [outputRevision, slideResetRevision]);
  const execute = async () => {
    const outputRevision = useAppStore.getState().outputRevision;
    const slideResetRevision = useAppStore.getState().slideResetRevisions[slideId] ?? 0;
    const currentRun = ++runRevision.current;
    setAwaitingInput(false); setRunning(true); addEvent({ type: "run-cell", cell: id });
    try {
      const result = await pythonKernel.run(id, code, inputs);
      const current = useAppStore.getState();
      if (current.outputRevision === outputRevision && (current.slideResetRevisions[slideId] ?? 0) === slideResetRevision) setOutput(result);
    }
    catch (error) {
      const current = useAppStore.getState();
      if (current.outputRevision === outputRevision && (current.slideResetRevisions[slideId] ?? 0) === slideResetRevision) setOutput({ cellId: id, kind: "error", data: String(error), timestamp: Date.now() });
    }
    finally { if (runRevision.current === currentRun) setRunning(false); }
  };
  const run = () => {
    if (inputPrompts.length > 0 && !awaitingInput) {
      setAwaitingInput(true);
      return;
    }
    void execute();
  };

  return <div className={`code-cell code-theme-${theme}`} data-cell-id={id}>
    <div className="cell-bar"><span><i /> Python</span><button onClick={run} disabled={running} title="Run cell (R)">
      {running ? <LoaderCircle className="spin" /> : <Play />} {running ? "Running…" : awaitingInput ? "Continue" : "Run"}
    </button></div>
    <CodeMirror value={code} onChange={setCode} extensions={[python()]} theme={theme} basicSetup={{ lineNumbers: true, foldGutter: false }} />
    {awaitingInput && <div className="cell-inputs">
      <span className="input-label">Waiting for input</span>
      {inputPrompts.map((prompt, index) => <label key={`${prompt}-${index}`}>
        <span>{prompt}</span>
        <input
          ref={index === 0 ? firstInputRef : undefined}
          value={inputs[index] ?? ""}
          onChange={(event) => setInputs((current) => current.map((value, i) => i === index ? event.target.value : value))}
          onKeyDown={(event) => { if (event.key === "Enter" && !running) void execute(); }}
          placeholder={`Value for input ${index + 1}`}
          aria-label={prompt}
        />
      </label>)}
    </div>}
    {output && <div className={`cell-output ${output.kind}`}>
      <div className="output-label">{output.kind === "error" ? <TriangleAlert /> : <Check />} {output.kind === "error" ? "Error" : "Output"}</div>
      {output.kind === "html" ? <div className="rich-output" dangerouslySetInnerHTML={{ __html: output.data }} /> :
        output.kind === "image" ? <img src={output.data} alt="Python output" /> : <pre>{output.data}</pre>}
    </div>}
  </div>;
}
