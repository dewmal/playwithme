import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useAppStore } from "../store";
import { choosePdfPath } from "./native";
import { isTauri, invoke } from "@tauri-apps/api/core";

const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export async function exportPdf(stepByStep: boolean) {
  const original = useAppStore.getState();
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1600, 900], hotfixes: ["px_scaling"] });
  let first = true;
  document.body.classList.add("exporting");
  try {
    for (let slideIndex = 0; slideIndex < original.slides.length; slideIndex++) {
      const maxStep = original.slides[slideIndex].steps.length - 1;
      const steps = stepByStep ? Array.from({ length: maxStep + 1 }, (_, i) => i) : [maxStep];
      for (const step of steps) {
        useAppStore.setState({ slideIndex, step }); await settle();
        const element = document.querySelector<HTMLElement>(".slide-canvas");
        if (!element) continue;
        const canvas = await html2canvas(element, { scale: 1.5, backgroundColor: "#f3efe7", useCORS: true });
        if (!first) pdf.addPage([1600, 900], "landscape"); first = false;
        pdf.addImage(canvas.toDataURL("image/jpeg", .94), "JPEG", 0, 0, 1600, 900);
      }
    }
    const path = await choosePdfPath();
    if (path && isTauri()) await invoke("write_binary", { path, bytes: Array.from(new Uint8Array(pdf.output("arraybuffer"))) });
    else pdf.save("presentation.pdf");
  } finally {
    document.body.classList.remove("exporting");
    useAppStore.setState({ slideIndex: original.slideIndex, step: original.step });
  }
}
