import { useMemo, useState } from "react";
import { ChevronRight, FileText, Folder, FolderOpen, X } from "lucide-react";

interface DirectoryNode {
  name: string;
  path: string;
  directories: Map<string, DirectoryNode>;
  files: string[];
}

function presentationTree(presentations: string[]) {
  const root: DirectoryNode = { name: "", path: "", directories: new Map(), files: [] };
  for (const presentation of presentations) {
    const parts = presentation.replace(/\\/g, "/").split("/");
    const filename = parts.pop();
    if (!filename) continue;
    let directory = root;
    for (const part of parts) {
      const path = directory.path ? `${directory.path}/${part}` : part;
      if (!directory.directories.has(part)) directory.directories.set(part, { name: part, path, directories: new Map(), files: [] });
      directory = directory.directories.get(part)!;
    }
    directory.files.push(presentation);
  }
  return root;
}

function directoryPaths(directory: DirectoryNode): string[] {
  return [...directory.directories.values()].flatMap((child) => [child.path, ...directoryPaths(child)]);
}

function TreeDirectory({ directory, depth, current, expanded, toggle, select }: { directory: DirectoryNode; depth: number; current: string | null; expanded: Set<string>; toggle: (path: string) => void; select: (name: string) => void }) {
  const open = expanded.has(directory.path);
  const directories = [...directory.directories.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...directory.files].sort((a, b) => a.localeCompare(b));
  return <>
    <button className="tree-folder" style={{ paddingLeft: 12 + depth * 18 }} onClick={() => toggle(directory.path)} aria-expanded={open}>
      <ChevronRight className={open ? "expanded" : ""} />{open ? <FolderOpen /> : <Folder />}<span>{directory.name}</span>
    </button>
    {open && <div role="group">
      {files.map((path) => <TreeFile key={path} path={path} depth={depth + 1} current={current} select={select} />)}
      {directories.map((child) => <TreeDirectory key={child.path} directory={child} depth={depth + 1} current={current} expanded={expanded} toggle={toggle} select={select} />)}
    </div>}
  </>;
}

function TreeFile({ path, depth, current, select }: { path: string; depth: number; current: string | null; select: (name: string) => void }) {
  const filename = path.split(/[\\/]/).at(-1) ?? path;
  return <button className={`tree-file ${path === current ? "current" : ""}`} style={{ paddingLeft: 12 + depth * 18 }} onClick={() => select(path)}>
    <span className="tree-spacer" /><FileText /><span><b>{filename.replace(/\.md$/i, "")}</b><small>{filename}{path === current ? " · open" : ""}</small></span>
  </button>;
}

export function PresentationPicker({ folder, presentations, current, close, select }: { folder: string; presentations: string[]; current: string | null; close: () => void; select: (name: string) => void }) {
  const projectName = folder.split(/[\\/]/).at(-1) ?? folder;
  const tree = useMemo(() => presentationTree(presentations), [presentations]);
  const [expanded, setExpanded] = useState(() => new Set(directoryPaths(tree)));
  const toggle = (path: string) => setExpanded((currentExpanded) => { const next = new Set(currentExpanded); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const rootFiles = [...tree.files].sort((a, b) => a.localeCompare(b));
  const rootDirectories = [...tree.directories.values()].sort((a, b) => a.name.localeCompare(b.name));

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="presentation-picker" role="dialog" aria-modal="true" aria-labelledby="presentation-picker-title">
      <header><div><span className="eyebrow">Presentation project</span><h2 id="presentation-picker-title">Choose a presentation</h2><p>Browse decks by folder. All decks share the project’s assets folder.</p></div><button onClick={close} aria-label="Close"><X /></button></header>
      <div className="presentation-tree">
        <div className="tree-root"><FolderOpen /><b>{projectName}</b></div>
        <div role="tree">
          {rootFiles.map((path) => <TreeFile key={path} path={path} depth={1} current={current} select={select} />)}
          {rootDirectories.map((directory) => <TreeDirectory key={directory.path} directory={directory} depth={1} current={current} expanded={expanded} toggle={toggle} select={select} />)}
        </div>
      </div>
    </section>
  </div>;
}
