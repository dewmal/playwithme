/// <reference lib="webworker" />
import { loadPyodide, type PyodideInterface } from "pyodide";

let pyodide: PyodideInterface | null = null;

async function boot() {
  if (!pyodide) {
    pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/" });
  }
  return pyodide;
}

self.onmessage = async (event: MessageEvent<{ id: string; code: string }>) => {
  const { id, code } = event.data;
  try {
    const py = await boot();
    py.globals.set("__presenta_code", code);
    const result = await py.runPythonAsync(`
import ast, base64, contextlib, io, json, sys, traceback

def __presenta_run(source):
    stdout = io.StringIO()
    try:
        tree = ast.parse(source, mode="exec")
        last = None
        with contextlib.redirect_stdout(stdout):
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                expr = tree.body.pop()
                if tree.body:
                    exec(compile(tree, "<slide>", "exec"), globals())
                last = eval(compile(ast.Expression(expr.value), "<slide>", "eval"), globals())
            else:
                exec(compile(tree, "<slide>", "exec"), globals())
        text = stdout.getvalue()
        if "matplotlib.pyplot" in sys.modules:
            import matplotlib.pyplot as plt
            if plt.get_fignums():
                buffer = io.BytesIO()
                plt.gcf().savefig(buffer, format="png", dpi=144, bbox_inches="tight", facecolor="white")
                plt.close("all")
                return json.dumps({"kind": "image", "data": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")})
        if last is not None:
            if hasattr(last, "to_html"):
                return json.dumps({"kind": "html", "data": last.to_html()})
            if hasattr(last, "_repr_html_"):
                html = last._repr_html_()
                if html:
                    return json.dumps({"kind": "html", "data": html})
            text += repr(last)
        return json.dumps({"kind": "text", "data": text or "Done"})
    except Exception:
        return json.dumps({"kind": "error", "data": traceback.format_exc()})

__presenta_run(__presenta_code)
    `);
    self.postMessage({ id, ...JSON.parse(String(result)) });
  } catch (error) {
    self.postMessage({ id, kind: "error", data: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
};
