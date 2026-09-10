import { isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useAppStore } from "../store";
import { visibleMarkdown } from "../lib/slides";
import { CodeCell } from "./CodeCell";
import { DrawingLayer } from "./DrawingLayer";

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  return "";
}

export function SlideCanvas({ exportMode = false, forcedStep }: { exportMode?: boolean; forcedStep?: number }) {
  const { slides, slideIndex, step } = useAppStore(); const slide = slides[slideIndex];
  const markdown = slide ? visibleMarkdown(slide, forcedStep ?? step) : "# No slides";
  const components = useMemo(() => ({
    code(props: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(props.className ?? "");
      if (match?.[1] === "python") {
        const source = textFromNode(props.children);
        const hash = Array.from(source).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7).toString(36);
        const id = `${slide?.id ?? "slide"}-python-${hash}`;
        return exportMode ? <pre className="export-code"><code>{source}</code></pre> : <CodeCell id={id} initialCode={source} />;
      }
      return <code className={props.className}>{props.children}</code>;
    },
  }), [slide?.id, exportMode]);

  return <div className="stage-shell">
    <article className="slide-canvas" data-slide-index={slideIndex}>
      <div className="slide-accent" />
      <div className="slide-content"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]} components={components}>{markdown}</ReactMarkdown></div>
      <div className="slide-folio">{String(slideIndex + 1).padStart(2, "0")} <span>/</span> {String(slides.length).padStart(2, "0")}</div>
      <DrawingLayer />
    </article>
  </div>;
}
