import { useEffect, useState } from "react";
import { BookOpen, Check, Copy, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import guide from "../../CREATE_PRESENTATION.md?raw";

export function HelpDialog({ close }: { close: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyGuide = async () => {
    try {
      await navigator.clipboard.writeText(guide);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = guide;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className="help-dialog" role="dialog" aria-modal="true" aria-label="Presentation authoring help">
      <header>
        <span><BookOpen /> Presentation guide</span>
        <div className="help-actions">
          <button className="copy-guide" onClick={copyGuide}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy guide"}</button>
          <button className="close-help" onClick={close} aria-label="Close help"><X /></button>
        </div>
      </header>
      <article className="help-content">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{guide}</ReactMarkdown>
      </article>
    </section>
  </div>;
}
