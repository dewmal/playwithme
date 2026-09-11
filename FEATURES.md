# Tauri Presentation App — Features

## Overview

A desktop presentation application built with **Tauri + React/TypeScript** that combines:

- Markdown-based presentations
- Step-by-step slide reveals
- Executable Python code cells
- Notebook-like Python state
- Live drawing and annotations
- Presentation session recording
- PDF export
- Video export

The goal is to create a presentation workflow similar to:

> **Markdown + Jupyter + PowerPoint + Whiteboard**

---

## 1. Folder-Based Markdown Presentations

Presentations are stored as normal folders and Markdown files.

Example:

```text
Presentations/
├── python-basics/
│   ├── presentation.md
│   ├── assets/
│   └── .presenta/
│       ├── settings.json
│       ├── drawings.json
│       ├── outputs/
│       ├── sessions/
│       └── exports/
│
└── machine-learning/
    ├── presentation.md
    └── assets/
```

### Slide separation

Use `---` to create a new slide.

```md
# Python Basics

Introduction to Python.

---

# Variables

Variables store values.

---

# Functions

Functions contain reusable logic.
```

### Step-by-step reveals

Slides can contain incremental reveal steps.

Example:

```md
# Neural Network

<!-- step -->
Input layer

<!-- step -->
Hidden layer

<!-- step -->
Output layer
```

Each step appears when the presenter moves forward.

### Column layouts

Slides can arrange Markdown into two or more equal-width columns.

```md
# Comparison

<!-- columns -->

## Option A

First column content.

<!-- column -->

## Option B

Second column content.

<!-- /columns -->
```

Use `<!-- columns: 35 65 -->` to set proportional widths. Plain `<!-- columns -->` keeps every column equal.

---

## 2. Executable Python Code Cells

Slides can contain executable Python code.

Example:

````md
# Python Example

```python
x = 10
y = 20
x + y
```
````

The presentation UI provides a **Run** button.

### Notebook-like behavior

Python state should persist during the presentation.

Example:

Slide 1:

```python
x = 100
```

Later slide:

```python
x * 5
```

Output:

```text
500
```

This makes the presentation behave similarly to a Jupyter notebook.

### Supported outputs

Code cells should support:

- Standard output
- Errors and tracebacks
- Python values
- Tables
- Pandas DataFrames
- HTML
- Images
- Matplotlib charts

### Python runtimes

Initial version:

- Pyodide
- Run inside a Web Worker

Future versions can support:

- Local Python
- Jupyter kernels
- Conda/virtual environments

---

## 3. Frozen Python Outputs

When Python code is executed during a presentation, the result should be stored.

Example:

```text
Code Cell
   ↓
Execute
   ↓
Result
   ↓
Persist output
```

Outputs may be stored as:

```text
outputs/
├── cell-001.json
├── cell-002.png
├── cell-003.html
└── cell-004.txt
```

Exports should use the stored output instead of rerunning the Python code.

This ensures PDF and video exports show exactly what appeared during the presentation.

---

## 4. Drawing and Slide Annotations

The presenter can draw directly on slides.

Supported tools can include:

- Pen
- Highlighter
- Arrow
- Rectangle
- Circle
- Text
- Laser pointer
- Eraser
- Undo
- Redo
- Clear slide

Annotations should be stored separately from Markdown.

Example:

```text
drawings/
├── slide-001.json
├── slide-002.json
└── slide-004.json
```

This keeps the original presentation content clean.

### Drawing layers

A slide can be rendered as layers:

```text
Drawing Layer
      ↓
Interaction Layer
      ↓
Slide Content Layer
```

Drawings may later support anchors to specific slide elements so they remain correctly positioned when the window size changes.

---

## 5. Presentation Mode

The application should include a dedicated presentation mode.

Possible controls:

| Key | Action |
|---|---|
| `→` / `Space` | Next step |
| `←` | Previous step |
| `R` | Run selected Python cell |
| `D` | Drawing mode |
| `L` | Laser pointer |
| `E` | Eraser |
| `F` | Fullscreen |
| `Esc` | Exit current tool or presentation |

Presentation mode should support:

- Fullscreen
- Step navigation
- Code execution
- Drawing
- Laser pointer
- Recording indicator
- Timer

---

## 6. Presentation Session Recording

Recording should be treated as a **presentation session**, not only as screen capture.

When recording starts, the application records:

1. Audio
2. Presentation events
3. Slide state
4. Python outputs
5. Drawing events

Example:

```text
Start Recording
      ↓
Present
      ↓
Run Python
      ↓
Draw / Highlight
      ↓
Navigate Slides
      ↓
Stop Recording
      ↓
Save Session
```

---

## 7. Event Timeline

The application should record presentation events with timestamps.

Example:

```json
{
  "events": [
    { "time": 0, "type": "slide", "slide": 1 },
    { "time": 12.8, "type": "step", "step": 2 },
    { "time": 31.2, "type": "slide", "slide": 2 },
    { "time": 42.1, "type": "run-cell", "cell": "python-1" },
    { "time": 44.6, "type": "cell-output", "cell": "python-1" }
  ]
}
```

Possible events include:

- Slide change
- Step reveal
- Python execution
- Python output
- Drawing start
- Drawing changes
- Drawing clear
- Cursor movement
- Laser pointer movement

This event timeline allows the presentation to be replayed exactly.

---

## 8. Audio Recording

The application should allow microphone recording when the presentation starts.

Possible UI:

```text
Microphone: Built-in Microphone

[ Start Presentation + Recording ]
```

During recording:

```text
● REC  00:13:42
```

Audio should be stored separately from the visual presentation timeline.

Example:

```text
session/
├── narration.webm
└── session.json
```

Keeping them separate makes later editing and re-rendering possible.

---

## 9. PDF Export

At the end of a presentation, the user can export a PDF.

PDF export should support:

- Markdown slide content
- Python code
- Executed Python outputs
- Charts
- Tables
- Drawings
- Annotations
- Optional presenter notes

### Export modes

#### Final-state PDF

One page per slide using the final state shown during the presentation.

#### Step-by-step PDF

Every reveal step becomes its own PDF page.

Example:

```text
Slide 1 — Step 1
Slide 1 — Step 2
Slide 1 — Step 3
Slide 2 — Step 1
...
```

---

## 10. Video Export

A recorded presentation session can be exported as video.

Recommended approach:

```text
Session Events
      +
Recorded Audio
      ↓
Replay Engine
      ↓
Rendered Frames
      ↓
FFmpeg
      ↓
MP4
```

The exported video can contain:

- Slide navigation
- Reveal animations
- Python execution
- Python results
- Charts
- Drawing
- Cursor
- Laser pointer
- Narration
- Optional camera overlay

Typical output:

```text
1920 × 1080
30 or 60 FPS
H.264 video
AAC audio
MP4 container
```

---

## 11. Session Storage

Example presentation folder:

```text
my-presentation/
│
├── presentation.md
│
├── assets/
│   ├── image-01.png
│   └── diagram.svg
│
└── .presenta/
    ├── settings.json
    ├── drawings.json
    ├── outputs/
    ├── sessions/
    │   └── 2026-09-10-session/
    │       ├── session.json
    │       ├── narration.webm
    │       ├── capture.webm
    │       ├── outputs/
    │       │   └── python-001.json
    │       └── drawings.json
    └── exports/
        └── 2026-09-10-session.mp4
```

---

## 12. Application Architecture

```text
presentation.md
      ↓
Markdown Parser
      ↓
Slide AST
      ↓
Presentation Renderer
      │
      ├── Python Kernel
      │
      ├── Drawing Layer
      │
      ├── Step Engine
      │
      └── Recorder
      ↓
Presentation Session
      │
      ├── PDF Renderer
      │
      └── Replay Engine
              ↓
            FFmpeg
              ↓
             MP4
```

---

## 13. Recommended Technology Stack

| Component | Technology |
|---|---|
| Desktop framework | Tauri 2 |
| Frontend | React + TypeScript |
| Build tool | Vite |
| State management | Zustand |
| Markdown parsing | unified + remark |
| Math | KaTeX |
| Syntax highlighting | Shiki |
| Code editor | CodeMirror 6 |
| Python V1 | Pyodide + Web Worker |
| Python future | Native Python / Jupyter kernel |
| Drawing | SVG or Canvas |
| Audio recording | MediaRecorder |
| Video encoding | FFmpeg |
| Storage | Markdown + JSON sidecar files |

---

## 14. MVP Development Order

### Phase 1 — Presentation Core

1. Create Tauri application
2. Open presentation folder
3. Load Markdown
4. Parse Markdown into slides
5. Render slides
6. Add next/previous navigation
7. Add step-by-step reveals
8. Add fullscreen presentation mode

### Phase 2 — Python

9. Add Pyodide
10. Move execution into a Web Worker
11. Add runnable Python code cells
12. Add persistent Python state
13. Render stdout/errors
14. Render charts and tables
15. Persist Python outputs

### Phase 3 — Drawing

16. Add drawing layer
17. Add pen/highlighter
18. Add shapes/arrows
19. Add laser pointer
20. Add undo/redo
21. Persist drawings

### Phase 4 — Recording

22. Start/stop presentation session
23. Record event timeline
24. Record microphone audio
25. Save session state
26. Store Python outputs and drawing events

### Phase 5 — Export

27. PDF export
28. Final-state PDF
29. Step-by-step PDF
30. Presentation replay engine
31. Bundle/use FFmpeg
32. MP4 video export

---

## 15. Future Features

Possible later additions:

- Presenter notes
- Presenter view on second monitor
- Webcam overlay
- Timeline editor
- Trim pauses
- Re-record individual sections
- Themes
- Custom transitions
- Remote presentation control
- Jupyter kernel support
- Local Python environment selection
- Conda/venv support
- Export to HTML
- Export to static website
- Automatic captions
- Speaker transcript
- Searchable presentation archive

---

## Core Design Principle

A recorded presentation should be represented as:

> **A timeline of presentation state changes, not only a screen recording.**

Store audio, slide events, executed outputs, and drawings separately.

This allows the application to reproduce the presentation reliably and generate both high-quality PDF and video exports.
