import { ArrowRight, Clock3, FilePlus2, FolderOpen, Moon, Play, Plus, Presentation, Search, Settings, Sun, Trash2 } from "lucide-react";
import type { Theme } from "../store";

export interface RecentProject {
  folder: string;
  settingsFolder: string;
  presentations: string[];
  openedAt: number;
}

const projectName = (folder: string) => folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder;
const deckName = (file: string) => file.split(/[\\/]/).at(-1)?.replace(/\.md$/i, "") ?? "Untitled";

export function ProjectDashboard({
  recents,
  theme,
  openProject,
  newPresentation,
  openRecent,
  openSample,
  removeRecent,
  toggleTheme,
  openSettings,
}: {
  recents: RecentProject[];
  theme: Theme;
  openProject: () => void;
  newPresentation: () => void;
  openRecent: (project: RecentProject) => void;
  openSample: () => void;
  removeRecent: (folder: string) => void;
  toggleTheme: () => void;
  openSettings: () => void;
}) {
  return <div className={`project-dashboard theme-${theme}`}>
    <aside className="dashboard-rail">
      <div className="dashboard-brand"><span className="brand-mark">P</span><b>Presenta</b></div>
      <nav aria-label="Dashboard navigation">
        <button className="active"><Presentation /> Projects</button>
        <button onClick={() => document.getElementById("recent-title")?.scrollIntoView({ behavior: "smooth" })}><Clock3 /> Recent</button>
      </nav>
      <div className="dashboard-rail-foot">
        <button onClick={openSettings}><Settings /> Project settings</button>
        <button onClick={toggleTheme}>{theme === "light" ? <Moon /> : <Sun />} {theme === "light" ? "Dark mode" : "Light mode"}</button>
        <div className="dashboard-user"><span>DM</span><div><b>Local workspace</b><small>Your files stay on this device</small></div></div>
      </div>
    </aside>

    <main className="dashboard-main">
      <header className="dashboard-header">
        <div><span className="eyebrow">Presentation studio</span><h1>Your projects</h1><p>Pick up where you left off, or start something new.</p></div>
        <div className="dashboard-header-actions"><button className="dashboard-search" onClick={openProject}><Search /> <span>Find a project</span><kbd>⌘ K</kbd></button><button className="dashboard-new" onClick={newPresentation}><Plus /> New presentation</button></div>
      </header>

      <section className="quick-start" aria-labelledby="quick-start-title">
        <div className="section-heading"><div><span className="eyebrow">Quick start</span><h2 id="quick-start-title">Make your next idea visible.</h2></div><p>Write in Markdown, run Python live, and record the whole story—without leaving your deck.</p></div>
        <div className="quick-grid">
          <button className="quick-card create-card" onClick={newPresentation}><span className="quick-icon"><FilePlus2 /></span><span><b>Blank presentation</b><small>Start with a clean, beautifully structured deck</small></span><ArrowRight /></button>
          <button className="quick-card open-card" onClick={openProject}><span className="quick-icon"><FolderOpen /></span><span><b>Open a project</b><small>Choose a folder with one or more Markdown decks</small></span><ArrowRight /></button>
          <button className="quick-card sample-card" onClick={openSample}><span className="sample-mini"><i /><strong>Make ideas<br/>move.</strong><em>Presenta</em></span><span><b>Explore the sample</b><small>See reveals, code cells, drawing, and recording</small></span><Play /></button>
        </div>
      </section>

      <section className="recent-projects" aria-labelledby="recent-title">
        <div className="section-title-row"><div><span className="eyebrow">Workspace</span><h2 id="recent-title">Recent projects</h2></div>{recents.length > 0 && <button onClick={openProject}>Browse files <ArrowRight /></button>}</div>
        {recents.length ? <div className="project-grid">
          {recents.map((project, index) => <article className="project-card" key={project.folder}>
            <button className="project-preview" onClick={() => openRecent(project)} aria-label={`Open ${projectName(project.folder)}`}>
              <span className={`project-art art-${index % 4}`}><i /><small>{project.presentations.length} {project.presentations.length === 1 ? "deck" : "decks"}</small><strong>{deckName(project.presentations[0] ?? "presentation.md")}</strong><em>Presenta project</em></span>
            </button>
            <div className="project-meta"><button onClick={() => openRecent(project)}><b>{projectName(project.folder)}</b><small>{new Date(project.openedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {project.presentations.length} {project.presentations.length === 1 ? "presentation" : "presentations"}</small></button><div className="project-menu"><button className="remove-project" onClick={() => removeRecent(project.folder)} aria-label={`Remove ${projectName(project.folder)} from recents`} title="Remove from recents"><Trash2 /></button></div></div>
          </article>)}
        </div> : <div className="empty-projects"><span><FolderOpen /></span><div><b>No recent projects yet</b><p>Open a presentation folder and it will stay within easy reach here.</p></div><button onClick={openProject}>Open your first project <ArrowRight /></button></div>}
      </section>
    </main>
  </div>;
}
