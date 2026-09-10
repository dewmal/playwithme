import type { Slide } from "../types";

const separator = /^\s*---\s*$/m;

export function parseSlides(markdown: string): Slide[] {
  return markdown.split(separator).map((raw, index) => {
    const [content, notes] = raw.split(/^\s*\?\?\?\s*$/m);
    const steps = content.split(/<!--\s*step\s*-->/i).map((part) => part.trim());
    return { id: `slide-${index + 1}`, raw: content.trim(), steps, notes: notes?.trim() };
  }).filter((slide) => slide.raw.length > 0);
}

export function visibleMarkdown(slide: Slide, step: number) {
  return slide.steps.slice(0, step + 1).join("\n\n");
}

export function slideTitle(slide: Slide) {
  return slide.raw.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled slide";
}
