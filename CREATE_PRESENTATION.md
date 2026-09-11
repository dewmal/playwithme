# How to Create a Presentation

Create your presentation by writing Markdown in `presentation.md`.

## Create slides

Start each slide with a heading. Separate slides with `---` on its own line.

```md
# Welcome

An introduction to the presentation.

---

# The main idea

Explain the most important point here.

---

# Thank you

Questions?
```

## Add headings and text

Use Markdown headings to organize the content on a slide:

```md
# Slide title

## Section heading

Write normal paragraph text here.
```

Use `**bold**` and `*italic*` to emphasize text:

```md
This is **important** and this is *supporting information*.
```

## Add lists

Create a bulleted list with hyphens:

```md
# Project goals

- Make the workflow faster
- Improve collaboration
- Deliver consistent results
```

Create a numbered list with numbers:

```md
# Our process

1. Research the problem
2. Design a solution
3. Test the result
```

Keep lists short so they remain easy to read during the presentation.

## Reveal content step by step

Add `<!-- step -->` before content that should appear on the next presentation step.

```md
# Product benefits

Simple to learn

<!-- step -->

Fast to use

<!-- step -->

Easy to share
```

Everything before the first step marker appears immediately. Each following section is revealed one at a time.

## Add presenter notes

Add `???` after the slide content, followed by notes that should not appear on the slide.

```md
# Quarterly results

Revenue increased by 18%.

???

Explain that the increase came mainly from returning customers.
Pause here for questions about the regional results.
```

## Add images

Place images in the presentation's `assets` folder and reference them with a relative path:

```md
# System architecture

![Diagram of the system architecture](assets/system-architecture.png)
```

Always include a short description inside the square brackets. Use clear filenames without spaces when possible.

## Add links

Use Markdown link syntax:

```md
[Visit the project website](https://example.com)
```

## Add a table

Use a table when values need to be compared:

```md
# Plan comparison

| Plan | Users | Storage |
| --- | ---: | ---: |
| Basic | 5 | 10 GB |
| Pro | 25 | 100 GB |
| Team | Unlimited | 1 TB |
```

Avoid wide tables with too many columns.

## Add mathematical expressions

Write inline mathematics between single dollar signs:

```md
The area of a circle is $A = \pi r^2$.
```

Use double dollar signs for a separate equation:

```md
$$
E = mc^2
$$
```

## Add code

Use a fenced code block and specify the programming language:

````md
# A JavaScript example

```javascript
const message = "Hello, world!";
console.log(message);
```
````

Python code blocks can be executed during the presentation:

````md
# Calculate the average

```python
values = [12, 18, 24]
average = sum(values) / len(values)
print(average)
```
````

## Example presentation

````md
# A Better Morning Routine

Small habits that create a calmer start to the day.

???

Welcome the audience and briefly introduce the topic.

---

# Why mornings matter

- They influence energy and focus
- They establish the pace of the day
- Consistency reduces decision fatigue

<!-- step -->

**The goal is progress, not perfection.**

---

# A simple three-step routine

1. Drink a glass of water

<!-- step -->

2. Plan the day's most important task

<!-- step -->

3. Move for five minutes

---

# Track your progress

```python
completed_days = 18
total_days = 21
print(f"Completion: {completed_days / total_days:.0%}")
```

---

# Start tomorrow

Choose one small habit and make it easy to repeat.

**Questions?**
````

## Writing tips

- Communicate one main idea per slide.
- Prefer short phrases over long paragraphs.
- Use meaningful slide titles that state the point.
- Use step-by-step reveals only when the order matters.
- Keep image and text combinations simple.
- Put speaking prompts in presenter notes instead of on the slide.
- Preview the presentation and check every slide before presenting.
