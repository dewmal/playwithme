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

Open a project folder containing one or more Markdown presentation files. Decks can live at the project root or inside subfolders and appear in an expandable tree. When a project has multiple decks, choose one when opening the folder or switch decks from the filename in the toolbar or sidebar. Every deck can use the shared root-level `assets/` folder. Use `---` between slides, `<!-- step -->` for reveals, and `???` before presenter notes. Python cells execute in a persistent Pyodide Web Worker; the first run downloads the runtime.

## Controls

| Key | Action |
| --- | --- |
| Space / → | Next reveal or slide |
| ← | Previous reveal or slide |
| R | Run first Python cell on the slide |
| D / L / E | Pen / laser / eraser |
| F | Presentation mode |
| Esc | Return to select mode |

Presentation folders stay deliberately small:

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

Editable presentations and their required assets live in the project tree. Presenta-owned settings, drawings, cached Python outputs, recordings, and internal video exports stay under `.presenta/`. The default root-level `presentation.md` keeps its state directly under `.presenta/`; additional decks keep separate state under `.presenta/presentations/<relative-path>/`. Existing projects with the older top-level `drawings/` and `outputs/` layout remain readable and are saved in the new layout the next time they change.

Sessions are stored under `.presenta/sessions/<timestamp>/` with separate timeline, narration, frozen outputs, drawings, and an optional visual capture. Recording setup includes camera and microphone previews with device selection. When enabled, the mirrored camera preview appears over the presentation and is composited into the exported recording; it can be toggled during a session. Recording also opens a presenter view with the current speaker notes, recording timer, and next-slide preview; this private panel is never included in the captured video. A session can be paused and resumed without adding the paused interval to its audio, video, event timeline, or duration. PDF export supports final-state and step-by-step modes. When FFmpeg is available, a recorded visual session is automatically transcoded to H.264/AAC MP4 under `.presenta/exports/`.

### macOS debug permissions

Use `npm run debug:macos` when testing recording. It builds and launches a debug app bundle with a stable signing identifier so macOS can retain microphone permission between rebuilds. Video is rendered directly from the presentation area and does not require Screen & System Audio Recording permission.
