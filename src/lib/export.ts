import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useAppStore } from "../store";
import { choosePdfPath, exportFilename } from "./native";
import { isTauri, invoke } from "@tauri-apps/api/core";

const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export interface ExportProgress {
  percent: number;
  label: string;
}

export async function exportPdf(stepByStep: boolean, onProgress?: (progress: ExportProgress) => void) {
  const original = useAppStore.getState();
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1600, 900], hotfixes: ["px_scaling"] });
  let first = true;
  const totalPages = original.slides.reduce((total, slide) => total + (stepByStep ? slide.steps.length : 1), 0);
  let completedPages = 0;
  onProgress?.({ percent: 0, label: `Preparing ${totalPages} ${totalPages === 1 ? "page" : "pages"}…` });
  document.body.classList.add("exporting");
  try {
    for (let slideIndex = 0; slideIndex < original.slides.length; slideIndex++) {
      const maxStep = original.slides[slideIndex].steps.length - 1;
      const steps = stepByStep ? Array.from({ length: maxStep + 1 }, (_, i) => i) : [maxStep];
      for (const step of steps) {
        useAppStore.setState({ slideIndex, step }); await settle();
        const element = document.querySelector<HTMLElement>(".slide-canvas");
        if (!element) continue;
        const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: original.theme === "dark" ? "#17181d" : "#f4f0e8", useCORS: true });
        if (!first) pdf.addPage([1600, 900], "landscape"); first = false;
        pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 0, 0, 1600, 900);
        completedPages += 1;
        onProgress?.({ percent: totalPages ? Math.round((completedPages / totalPages) * 90) : 90, label: `Rendered ${completedPages} of ${totalPages} pages` });
      }
    }
    const filename = exportFilename(original.presentationFile, "pdf");
    onProgress?.({ percent: 95, label: "Saving PDF…" });
    const path = await choosePdfPath(original.presentationFile);
    if (path && isTauri()) await invoke("write_binary", { path, bytes: Array.from(new Uint8Array(pdf.output("arraybuffer"))) });
    else pdf.save(filename);
    onProgress?.({ percent: 100, label: "PDF export complete" });
  } finally {
    document.body.classList.remove("exporting");
    useAppStore.setState({ slideIndex: original.slideIndex, step: original.step });
  }
}
