# claude-presentation-plugin

A Claude Code plugin that generates HTML slide-deck presentations with audio narration. The presentation runtime (CSS/JS) is loaded from jsDelivr CDN for minimal file size and shared caching.

**[Live Demo](https://tcosentino.github.io/claude-presentation-plugin/)** -- a presentation about the plugin, built with the plugin.

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
- Network access -- presentations load runtime CSS/JS from `cdn.jsdelivr.net`

## Output

Presentations are generated at `presentations/<slug>/` with:

- `presentation-data.json` -- Structured content data
- `index.html` -- Lightweight presentation shell (~2-5 KB) that loads runtime from jsDelivr CDN
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
