# claude-presentation-plugin

A Claude Code plugin that generates self-contained HTML slide-deck presentations with audio narration.

## Features

- Interactive slide decks with progressive disclosure
- Audio narration via edge-tts
- Syntax highlighting via Highlight.js
- Keyboard navigation (arrows, space, escape for overview)
- Touch/swipe support
- Dark theme
- Before/after code comparisons
- Callout boxes (tip, warning, info)
- Position persistence across page reloads

## Installation

```
/plugin install presentation
```

Or install directly from GitHub:

```
/plugin install https://github.com/tcosentino/claude-presentation-plugin
```

## Usage

### Educational Presentations

```
/presentation TypeScript Type Fundamentals
```

### Implementation Plan Presentations

```
/presentation plan: Add user authentication to the Express API
```

Prefix with `plan:` to generate an implementation plan as a navigable slide deck instead of an educational presentation.

## Requirements

- `edge-tts` for audio generation: `pip install edge-tts`

## Output

Presentations are generated at `presentations/<slug>/` with:

- `presentation-data.json` -- Structured content data
- `index.html` -- Self-contained presentation (no external dependencies except Highlight.js CDN)
- `audio/` -- MP3 narration files (one per slide step)

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| Right / Space | Next step |
| Left | Previous step |
| Escape | Toggle overview |
| Home | Go to start |
| End | Go to end |

## License

MIT
