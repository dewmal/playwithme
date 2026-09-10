import { FileText, PanelLeftClose, Plus, Search } from "lucide-react";
import { slideTitle } from "../lib/slides";
import { useAppStore } from "../store";

export function Sidebar() {
  const { slides, slideIndex, goTo, setSidebar } = useAppStore();
  return <aside className="sidebar">
    <div className="sidebar-head"><div className="brand-mark">P</div><div><b>Presenta</b><span>Presentation studio</span></div><button onClick={() => setSidebar(false)} title="Hide sidebar"><PanelLeftClose /></button></div>
    <div className="search"><Search /><input aria-label="Search slides" placeholder="Search slides" /></div>
    <div className="slides-label"><span>Slides</span><button title="Add slide"><Plus /></button></div>
    <div className="slide-list">
      {slides.map((slide, index) => <button className={`slide-thumb ${index === slideIndex ? "selected" : ""}`} onClick={() => goTo(index)} key={slide.id}>
        <span className="slide-number">{String(index + 1).padStart(2, "0")}</span>
        <span className="thumb-canvas"><i /><strong>{slideTitle(slide)}</strong><small>{slide.steps.length > 1 ? `${slide.steps.length} reveal steps` : "Static slide"}</small></span>
      </button>)}
    </div>
    <div className="sidebar-foot"><FileText /><span><b>presentation.md</b><small>{slides.length} slides · autosaved</small></span></div>
  </aside>;
}
