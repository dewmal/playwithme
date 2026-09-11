import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { slideContentBlocks } from "../lib/slides";

export function SlideMarkdown({ markdown, components, rich = true }: { markdown: string; components?: Components; rich?: boolean }) {
  const blocks = slideContentBlocks(markdown);
  const renderMarkdown = (source: string, key: string) => rich
    ? <ReactMarkdown key={key} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]} components={components}>{source}</ReactMarkdown>
    : <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} components={components}>{source}</ReactMarkdown>;

  return <>{blocks.map((block, blockIndex) => block.type === "markdown"
    ? renderMarkdown(block.markdown, `markdown-${blockIndex}`)
    : <div className="slide-columns" style={{ gridTemplateColumns: block.sizes ? block.sizes.map((size) => `${size}fr`).join(" ") : `repeat(${block.columns.length}, minmax(0, 1fr))` }} key={`columns-${blockIndex}`}>
      {block.columns.map((column, columnIndex) => <div className="slide-column" key={columnIndex}>{renderMarkdown(column, `column-${blockIndex}-${columnIndex}`)}</div>)}
    </div>)}</>;
}
