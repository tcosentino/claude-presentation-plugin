---
name: presentation
description: Generate self-contained HTML slide-deck presentations with audio narration
---

# /presentation Skill

Generate a self-contained HTML slide-deck presentation with audio narration.

## Usage

```
/presentation <topic or task description>
```

Examples:
- `/presentation TypeScript Type Fundamentals`
- `/presentation React Hooks Deep Dive`
- `/presentation plan: Add user authentication to the Express API`

Prefix the topic with `plan:` to generate an implementation plan as a presentation (see "Plan Presentations" section below).

## Workflow

### Phase 1: Plan the Outline

Generate a presentation outline. For standard topics (15-25 slides), go straight to generation without asking for approval -- this is the most common case. Only present the outline for approval if:

- The user requests a very large presentation (40+ slides)
- The topic is ambiguous and could go multiple directions
- The user explicitly asks to review the outline first

The outline should include:
- Presentation title
- Estimated number of slides
- Sections with slide titles and key topics per slide
- How many advance steps each slide will have (2-6 steps per slide is ideal)

**Default slide count**: 15-25 slides is the sweet spot for a focused topic. This produces a 20-40 minute presentation. A "3 hour presentation" should have ~60-90 slides with 3-5 steps each.

### Phase 2: Generate the Presentation

Once approved, create the output at `presentations/<slug>/`.

#### Step 1: Create the presentation data JSON

Create `presentations/<slug>/presentation-data.json` with this exact structure:

```json
{
  "title": "Presentation Title Here",
  "sections": [
    {
      "title": "Section Name",
      "slides": [
        {
          "title": "Slide Title",
          "subtitle": "Optional subtitle text",
          "steps": [
            {
              "content": [
                {"kind": "text", "text": "Explanation with **bold** and `code` inline"},
                {"kind": "code", "language": "typescript", "code": "const x: string = 'hello'", "filename": "example.ts"},
                {"kind": "callout", "variant": "tip", "text": "A helpful tip"}
              ],
              "narrationText": "The full text that should be spoken aloud for this step. Write naturally as if presenting to someone.",
              "narration": "slide-01-step-0.mp3"
            },
            {
              "content": [
                {"kind": "bullets", "items": ["First point with `code`", "Second **important** point"]}
              ],
              "narrationText": "Here are the key points to remember...",
              "narration": "slide-01-step-1.mp3"
            }
          ]
        }
      ]
    }
  ]
}
```

#### Content Block Types

- `{"kind": "text", "text": "..."}` -- paragraph text (supports `**bold**`, `` `code` ``, `[links](url)`)
- `{"kind": "heading", "text": "..."}` -- section heading within a step
- `{"kind": "code", "language": "typescript", "code": "...", "filename": "optional.ts", "highlight": [1, 3]}` -- syntax-highlighted code block. `highlight` is optional array of 1-indexed line numbers to emphasize.
- `{"kind": "bullets", "items": ["...", "..."]}` -- bullet list (items support inline markdown)
- `{"kind": "callout", "variant": "tip|warning|info", "text": "..."}` -- colored callout box
- `{"kind": "comparison", "left": {"label": "Before", "code": "..."}, "right": {"label": "After", "code": "..."}}` -- side-by-side code comparison
- `{"kind": "mermaid", "diagram": "flowchart TD\n  A --> B"}` -- Mermaid diagram. Use for flowcharts, sequence diagrams, state diagrams, ER diagrams, gantt, class diagrams, etc. Prefer this over ASCII art for architecture, flow, or hierarchy visuals. Escape newlines as `\n` in JSON.
- `{"kind": "image", "src": "screenshots/foo.png", "alt": "...", "caption": "optional", "size": "small|medium|large|full", "frame": true}` -- image (typically a screenshot). `src` may be a relative path (resolved relative to the presentation HTML), an absolute URL, or a data URI. `size` defaults to `medium` (60vh max-height); `small` is 35vh, `large` is 75vh, `full` stretches edge-to-edge. `frame: false` removes the border/shadow (use for transparent PNGs or images with their own framing). Place screenshot files alongside `presentation-data.json` in the presentation folder.

#### Narration File Naming

Use sequential numbering: `slide-01-step-0.mp3`, `slide-01-step-1.mp3`, `slide-02-step-0.mp3`, etc. The slide number is global across all sections (not per-section).

#### Narration Text Guidelines

- Write as natural speech, not written text
- Use "we" to be inclusive: "Let's look at...", "Now we'll explore..."
- Explain what the code does conversationally
- Don't read code character-by-character; describe what it does
- Mention keyboard shortcuts: "Press the right arrow or space to continue"
- Keep each step's narration to 15-45 seconds of speech (~40-120 words)

#### Step 2: Generate the HTML file

Run this Python command to generate the HTML from the template (replace `<slug>` with the actual slug):

```bash
python3 -c "
import json
with open('${CLAUDE_PLUGIN_ROOT}/skills/presentation/presentation-template.html', 'r') as f:
    template = f.read()
with open('presentations/<slug>/presentation-data.json', 'r') as f:
    presentation_data = f.read()
data = json.loads(presentation_data)
html = template.replace('{{PRESENTATION_TITLE}}', data['title']).replace('{{PRESENTATION_DATA}}', presentation_data)
with open('presentations/<slug>/index.html', 'w') as f:
    f.write(html)
total_slides = sum(len(s['slides']) for s in data['sections'])
total_steps = sum(len(slide['steps']) for s in data['sections'] for slide in s['slides'])
print(f'Generated: {data[\"title\"]}')
print(f'Sections: {len(data[\"sections\"])}, Slides: {total_slides}, Steps: {total_steps}')
"
```

#### Step 3: Generate audio files

Run the audio generation script:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/generate-presentation-audio.py presentations/<slug>/
```

This requires `edge-tts` to be installed (`pip install edge-tts`). It uses voice `en-US-AndrewMultilingualNeural` at `+25%` speed.

### Phase 3: Verify

1. Confirm all files were created
2. List the generated audio files to verify they exist
3. Open the HTML file: `open presentations/<slug>/index.html`

Tell the user:
- How many slides and steps were generated
- Keyboard shortcuts: Right/Space = next, Left = prev, Escape = overview, Home/End = jump
- The audio mute toggle is in the bottom center
- They can re-generate audio by running the Python script again

## Slide Design Principles

1. **Progressive disclosure**: Start each slide with a concept, then reveal details step by step
2. **Code-first**: Show code examples early, explain after
3. **One concept per slide**: Don't cram too much into a single slide
4. **2-6 steps per slide**: Fewer for simple concepts, more for complex ones
5. **Mix content types**: Alternate between text, code, bullets, and callouts
6. **Use comparisons**: Before/after, good/bad, type vs interface -- side-by-side is powerful
7. **End sections with a summary callout**: Use a "tip" callout to recap key takeaways

## Plan Presentations

When the topic starts with `plan:` or the user is asking for an implementation plan as a presentation, follow these additional guidelines:

### Research First

Before structuring anything, thoroughly explore the codebase:
- Read the files and modules relevant to the task
- Identify existing patterns, utilities, and abstractions that can be reused
- Understand dependencies and how different parts connect
- Check current tests and how new changes should be validated

### Mapping Plans to Slides

| Plan Concept | Presentation Element |
| --- | --- |
| Major area of work (backend, frontend, testing) | Section |
| Individual file or component to change | Slide |
| Specific modification within a file | Step (progressive reveal) |

### Standard Sections for Plans

1. **Context & Goal** (1-2 slides) -- What we're building, why, and the intended outcome
2. **Architecture Overview** (1-2 slides) -- How the changes fit into the existing system
3. **One section per major area of change** -- Group by logical area (e.g., "Database Changes", "API Layer")
4. **Implementation Order** (1 slide) -- Dependency graph and recommended sequence
5. **Verification** (1 slide) -- How to test and validate the changes

### Plan-Specific Content Usage

- `comparison` -- Before/after code changes (the most valuable block type for plans)
- `code` -- Show existing code that will be modified, or proposed new code
- `callout` with `variant: "warning"` -- Breaking changes, risks, things needing review
- `callout` with `variant: "tip"` -- Optimization opportunities or alternative approaches
- `callout` with `variant: "info"` -- Context about why a particular approach was chosen

### Plan Narration Style

- Use directive language: "We will modify...", "The first change is..."
- Reference specific file paths and line numbers
- Explain the WHY behind each change, not just the WHAT
- Keep narration per step to 15-30 seconds (~40-80 words)

### Plan Slide Count

- Small tasks (1-3 files): 5-10 slides
- Medium tasks (4-10 files): 10-18 slides
- Large tasks (10+ files): 18-30 slides

### Plan Approval Gate

After generating a plan presentation, open it and ask: **"Review the plan presentation and let me know if you want to proceed with implementation, or if any section needs revision."**

- If approved, proceed with implementing the changes
- If revisions requested, update affected sections and regenerate

## Important Notes

- All code in the `code` field must be properly escaped for JSON (escape backslashes, quotes, newlines)
- The HTML file loads Highlight.js from CDN (cdnjs.cloudflare.com) for syntax highlighting. Code blocks degrade gracefully to unstyled text if offline
- Audio files are referenced relatively from the HTML file as `audio/<filename>.mp3`
- Syntax highlighting is provided by Highlight.js and supports all common languages including: typescript, javascript, python, go, json, sql/postgres, bash/sh, css, html/xml, rust, java, c/cpp, and more
- Generate the presentation data JSON FIRST, then create the HTML from the template, then generate audio
- Comparison blocks use negative margins to break out of the content container for more width. Keep comparison code concise (short lines) for best readability.
