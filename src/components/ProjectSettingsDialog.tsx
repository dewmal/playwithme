import { Database, FolderOpen, HardDrive, Home, X } from "lucide-react";
import type { SettingsLocation } from "../lib/native";
import type { Theme } from "../store";

export function ProjectSettingsDialog({ value, homeFolder, cacheFolder, theme, chooseFolder, change, close }: {
  value: SettingsLocation;
  homeFolder: string;
  cacheFolder: string;
  theme: Theme;
  chooseFolder: () => void;
  change: (value: SettingsLocation) => void;
  close: () => void;
}) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className={`settings-dialog theme-${theme}`} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header><div><span className="eyebrow">Storage</span><h2 id="settings-title">Project settings location</h2><p>Choose where Presenta keeps drawings, code outputs, recordings, and exports. Markdown and assets remain in each project.</p></div><button onClick={close} aria-label="Close"><X /></button></header>
      <div className="settings-options">
        <button className={value.mode === "home" ? "active" : ""} onClick={() => change({ mode: "home" })}><Home /><span><b>Presenta home</b><small>{homeFolder}/projects/&lt;project&gt; · Recommended</small></span></button>
        <button className={value.mode === "cache" ? "active" : ""} onClick={() => change({ mode: "cache" })}><Database /><span><b>System cache</b><small>{cacheFolder}/projects/&lt;project&gt; · managed with application cache</small></span></button>
        <button className={value.mode === "project" ? "active" : ""} onClick={() => change({ mode: "project" })}><HardDrive /><span><b>Inside each project</b><small>&lt;project&gt;/.presenta · Portable and compatible with existing projects</small></span></button>
        <button className={value.mode === "custom" ? "active" : ""} onClick={chooseFolder}><FolderOpen /><span><b>Custom folder</b><small>{value.mode === "custom" && value.customRoot ? value.customRoot : "Choose a base folder…"}</small></span></button>
      </div>
      <footer><small>This preference applies when a project is first opened or created. Recent projects keep their assigned location.</small><button onClick={close}>Done</button></footer>
    </section>
  </div>;
}
