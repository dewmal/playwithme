export const NEW_PRESENTATION_MARKDOWN = `# Untitled Presentation

Add your subtitle here.

---

# Next slide

Start writing your presentation.
`;

export const SAMPLE_MARKDOWN = `<!-- background: #17181d -->
<!-- slide-style: title-font=Georgia; body-font=Arial; title-color=#f7f3e8; body-color=#c8cad2; accent-color=#d9ff57; code-theme=dark; code-width=100 -->

# Presenta

## Ideas that move with you

Write in Markdown. Run Python. Draw, present, and record from one workspace.

<!-- step -->

Press **Space** to begin the tour.

???
Welcome everyone and explain that this sample is also a quick tour of Presenta.

---

# Markdown controls the canvas

<!-- columns: 62 38 -->

\`\`\`javascript
const idea = "Make the point visible";
const slide = { title: idea, ready: true };
console.log(slide);
\`\`\`

Syntax-highlighted code stays readable and editable.

<!-- column -->

![Presenta app icon](/presenta-icon.svg)

## Plain files, rich slides

- Headings create hierarchy
- **Bold** text carries emphasis
- *Italic* text adds a quieter note

<!-- /columns -->

???
Point out the image, formatted text, code highlighting, and weighted column layout.

---

# Columns make comparisons easier

<!-- columns -->

## Write

Draft the argument in Markdown.

<!-- column -->

## Present

Move through the story one step at a time.

<!-- column -->

## Capture

Record narration, drawings, and live output.

<!-- step -->

**One source supports the whole session.**

<!-- /columns -->

???
Advance once to reveal the conclusion inside the third column.

---

# Progress becomes visible

This illustrative series tracks completed rehearsal passes.

\`\`\`echarts
{
  "animation": true,
  "animationDuration": 1200,
  "animationDelay": 120,
  "animationEasing": "cubicOut",
  "color": ["#ff4d67"],
  "tooltip": { "trigger": "axis" },
  "grid": { "left": "9%", "right": "5%", "top": "10%", "bottom": "14%" },
  "xAxis": {
    "type": "category",
    "data": ["Draft", "Review", "Rehearsal", "Ready"]
  },
  "yAxis": {
    "type": "value",
    "min": 0,
    "max": 10,
    "name": "Checks passed"
  },
  "series": [{
    "name": "Checks passed",
    "type": "bar",
    "data": [3, 5, 7, 9],
    "barWidth": "48%",
    "label": { "show": true, "position": "top" },
    "itemStyle": { "borderRadius": [8, 8, 0, 0] }
  }]
}
\`\`\`

<!-- step -->

The final rehearsal passed **nine of ten checks**.

???
In presentation mode, play the chart on cue with **Animate chart** or **A**. Advance once to reveal the evidence-based takeaway.

---

# Charts can animate on a reveal

<!-- step -->

<!-- columns: 60 40 -->

\`\`\`echarts
{
  "animation": true,
  "animationDuration": 900,
  "animationEasing": "cubicOut",
  "color": ["#ff4d67", "#f2b84b", "#4fc3a1"],
  "tooltip": { "trigger": "item" },
  "legend": { "bottom": 0 },
  "series": [{
    "name": "Session minutes",
    "type": "pie",
    "radius": ["45%", "72%"],
    "center": ["50%", "43%"],
    "data": [
      { "value": 8, "name": "Explain" },
      { "value": 5, "name": "Demo" },
      { "value": 3, "name": "Discuss" }
    ],
    "label": { "show": true, "formatter": "{b}: {c} min" }
  }]
}
\`\`\`

<!-- column -->

## A balanced session

- Explain the core idea
- Demonstrate it live
- Leave time for discussion

<!-- step -->

The chart appears on the first reveal. While presenting or recording, use **Animate chart** or press **A** to play it on cue.

<!-- /columns -->

???
Advance once to mount the chart, then again to reveal the note in the right column.

---

<!-- slide-style: code-theme=light; code-width=75 -->

# Python runs inside the deck

\`\`\`python
checks = [3, 5, 7, 9]
average = sum(checks) / len(checks)
print(f"Average checks passed: {average:.1f}")
checks
\`\`\`

<!-- step -->

Run the cell, edit a value, and run it again. The output is saved with the presentation.

???
Use the Run button or press R. Python state remains available on later slides.

---

# Python state continues

The previous slide created the \`checks\` list.

\`\`\`python
improvement = checks[-1] - checks[0]
print(f"Improvement: {improvement} checks")
\`\`\`

<!-- step -->

Notebook-style state lets a live analysis continue across slides.

---

# Mathematics and tables stay sharp

<!-- columns: 42 58 -->

## Completion rate

The final result is $9/10$. As a percentage:

$$
\\frac{9}{10} \\times 100 = 90\\%
$$

<!-- column -->

## Export choices

| Format | Best for |
| --- | --- |
| PDF | Sharing final slides |
| Step PDF | Reviewing every reveal |
| MP4 | Replaying a recorded session |

[Learn more about ECharts](https://echarts.apache.org/)

<!-- /columns -->

???
The table remains selectable, the equation stays crisp, and the link remains clickable.

---

<!-- background: #f3efe7 -->

# Present the complete story

1. Enter fullscreen presentation mode

<!-- step -->

2. Draw or highlight the important detail

<!-- step -->

3. Record the session and export it

<!-- step -->

Your Markdown, outputs, notes, and annotations stay together.

???
Invite the audience to try the drawing toolbar, presenter notes, recording, and export controls.
`;
