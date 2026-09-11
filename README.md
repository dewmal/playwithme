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

Open a folder containing `presentation.md`. Use `---` between slides, `<!-- step -->` for reveals, and `???` before presenter notes. Python cells execute in a persistent Pyodide Web Worker; the first run downloads the runtime.

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
my-presentation/
├── presentation.md
├── assets/
└── .presenta/
    ├── settings.json
    ├── drawings.json
    ├── outputs/
    ├── sessions/
    └── exports/
```

Only the editable presentation and its required assets live at the top level. Presenta-owned settings, drawings, cached Python outputs, recordings, and internal video exports stay under `.presenta/`. Existing projects with the older top-level `drawings/` and `outputs/` layout remain readable and are saved in the new layout the next time they change.

Sessions are stored under `.presenta/sessions/<timestamp>/` with separate timeline, narration, frozen outputs, drawings, and an optional visual capture. PDF export supports final-state and step-by-step modes. When FFmpeg is available, a recorded visual session is automatically transcoded to H.264/AAC MP4 under `.presenta/exports/`.

### macOS debug permissions

Use `npm run debug:macos` when testing recording. It builds and launches a debug app bundle with a stable signing identifier so macOS can retain microphone permission between rebuilds. Video is rendered directly from the presentation area and does not require Screen & System Audio Recording permission.
