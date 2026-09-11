import type { Slide } from "../types";

const separator = /^\s*---\s*$/m;
const backgroundDirective = /^\s*<!--\s*background:\s*(#[0-9a-f]{6})\s*-->\s*$/im;

export function parseSlides(markdown: string): Slide[] {
  return markdown.split(separator).map((raw, index) => {
    const [content, notes] = raw.split(/^\s*\?\?\?\s*$/m);
    const background = content.match(backgroundDirective)?.[1].toLowerCase();
    const slideContent = content.replace(backgroundDirective, "").trim();
    const steps = slideContent.split(/<!--\s*step\s*-->/i).map((part) => part.trim());
    return { id: `slide-${index + 1}`, raw: slideContent, steps, notes: notes?.trim(), background };
  }).filter((slide) => slide.raw.length > 0);
}

export function setSlideBackground(markdown: string, slideIndex: number, color: string | null) {
  let currentSlide = -1;
  return markdown.split(separator).map((part) => {
    const [content] = part.split(/^\s*\?\?\?\s*$/m);
    if (!content.replace(backgroundDirective, "").trim()) return part;
    currentSlide += 1;
    if (currentSlide !== slideIndex) return part;
    const cleaned = part.replace(backgroundDirective, "").trim();
    return color ? `<!-- background: ${color.toLowerCase()} -->\n\n${cleaned}` : cleaned;
  }).join("\n\n---\n\n");
}

export function backgroundTone(color?: string) {
  if (!color) return "";
  const value = color.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return (red * .299 + green * .587 + blue * .114) < 145 ? "custom-dark" : "custom-light";
}

export function visibleMarkdown(slide: Slide, step: number) {
  return slide.steps.slice(0, step + 1).join("\n\n");
}

export function slideTitle(slide: Slide) {
  return slide.raw.match(/^#\s+(.+)$/m)?.[1] ?? "Untitled slide";
}
