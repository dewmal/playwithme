# Presenta

A local-first presentation studio combining Markdown slides, persistent Python code, vector ink, session recording, and export.

See [How to Create a Presentation](CREATE_PRESENTATION.md) for the Markdown authoring guide.

## Run in a browser

```bash
npm install
npm run dev
```

The sample deck works immediately. Browser mode saves drafts and sessions to local storage; native folder operations are enabled in the desktop build.

## Run as a desktop app

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform, then:

```bash
npm install
npm run tauri dev
```

Open a project folder containing one or more Markdown presentation files. Decks can live at the project root or inside subfolders and appear in an expandable tree. When a project has multiple decks, choose one when opening the folder or switch decks from the filename in the toolbar or sidebar. Every deck can use the shared root-level `assets/` folder. Use `---` between slides, `<!-- step -->` for reveals, `<!-- columns -->` with `<!-- column -->` for column layouts, and `???` before presenter notes. Add weights such as `<!-- columns: 35 65 -->` when columns need different widths. Use an `echarts` fenced block with a JSON option object for responsive charts; ECharts animation options control whether and how each chart animates. In the desktop app, Python cells run in a persistent native Python process managed by `uv`, using the opened project's environment. Browser preview keeps a Pyodide fallback.

## Controls

| Key | Action |
| --- | --- |
| Space / → | Next reveal or slide |
| ← | Previous reveal or slide |
| R | Run first Python cell on the slide |
| A | Replay visible chart animations while presenting or recording |
| D / L / E | Pen / laser / eraser |
| F | Presentation mode |
| Esc | Return to select mode |

By default, Presenta keeps generated project state outside the project under `~/.presenta/projects/<project-id>/`. In **Projects → Settings**, you can instead use the operating system's application cache, keep state inside the project, or choose another base folder. The inside-project layout is:

```text
my-presentation-project/
├── presentation.md
├── decks/
│   └── quarterly-review.md
├── assets/
└── .presenta/
    ├── settings.json
    ├── drawings.json
    ├── outputs/
    ├── presentations/
    │   └── decks/
    │       └── quarterly-review.md/
    │           ├── drawings.json
    │           └── outputs/
    ├── sessions/
    └── exports/
```

Editable presentations and their required assets always live in the project tree. Presenta-owned settings, drawings, cached Python outputs, recordings, and internal video exports use the selected settings location. The default root-level `presentation.md` keeps its state directly in that location; additional decks keep separate state under `presentations/<relative-path>/`. Existing project-local `.presenta`, `drawings/`, and `outputs/` data remains readable. Each recent project remembers its resolved settings folder, so changing the preference affects newly opened or created projects rather than silently moving existing data.

Sessions are stored under `<settings-location>/sessions/<timestamp>/` with separate timeline, narration, frozen outputs, drawings, and an optional visual capture. Recording setup includes camera and microphone previews with device selection, plus camera position and size controls. When enabled, the mirrored camera preview appears over the presentation, can be dragged while recording, and is composited at the same location in the exported recording; it can also be toggled during a session. Recording opens a presenter view with the current speaker notes, recording timer, and next-slide preview; this private panel is never included in the captured video. Recorded slides preserve the selected presentation theme and each slide's custom background. A session can be paused and resumed without adding the paused interval to its audio, video, event timeline, or duration. Each stopped recording is kept as an independent section so it can be replayed, removed, or retaken. When Session video is selected in Export, the current sections are combined in timeline order and written to the chosen MP4 destination. PDF export supports final-state and step-by-step modes. FFmpeg transcodes recorded sections and produces the combined H.264/AAC export.

### macOS debug permissions

Use `npm run debug:macos` when testing recording. It builds and launches a debug app bundle with a stable signing identifier so macOS can retain microphone and screen-recording permissions between rebuilds. The macOS desktop app captures only the visible slide rectangle with the system recorder and hardware video pipeline, then adds the selected microphone track after capture. This avoids rebuilding and encoding 4K DOM screenshots on the UI thread. Browser and non-macOS builds retain a lower-resolution canvas fallback.
