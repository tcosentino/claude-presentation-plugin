# Claude Presentation Plugin

A Claude Code skill plugin that generates interactive HTML slide-deck presentations with audio narration.

## Architecture

```
skills/presentation/SKILL.md    -- Skill definition (prompt + workflow)
skills/presentation/presentation-template.html -- HTML shell template
runtime/v1/presentation.js      -- Client-side presentation engine (vanilla JS IIFE)
runtime/v1/presentation.css     -- Dark-theme slide styles
scripts/generate-presentation-audio.py -- edge-tts audio generation
docs/                           -- GitHub Pages demo site
presentations/                  -- Generated output (gitignored for user repos)
```

### How It Works

1. Claude generates `presentation-data.json` (structured content blocks + narration text)
2. A Python templating step injects the JSON into `presentation-template.html`
3. The HTML loads runtime CSS/JS from jsDelivr CDN (`@v1` tag)
4. A separate Python script generates MP3 audio via edge-tts

### Runtime Versioning

- Runtime is pinned to `/v1/` in CDN URLs -- existing presentations keep working when `/v2/` ships
- `runtime/v1/` is the source of truth; `docs/runtime/v1/` is a copy for GitHub Pages
- Breaking changes to the runtime require a new version directory (`runtime/v2/`)
- Non-breaking additions (new content block types, CSS tweaks) go into `v1`

## Development

### Requirements

- Node.js 18+ (for testing)
- Python 3.8+ with `edge-tts` (`pip install edge-tts`) for audio generation
- Network access for CDN-hosted dependencies (Highlight.js, Mermaid, runtime)

### Testing

```bash
yarn install
yarn test        # Run unit tests
yarn test:watch  # Run tests in watch mode
```

Tests live in `tests/` and use Vitest with jsdom. The runtime (`runtime/v1/presentation.js`) is the primary test target -- it is a vanilla JS IIFE that expects `window.PRESENTATION_DATA` and `hljs` to be available globally.

When writing tests:
- Mock `hljs` (highlight.js) globally -- it is loaded from CDN at runtime
- Set `window.PRESENTATION_DATA` before importing the runtime
- Use jsdom for DOM assertions
- Test content block rendering, navigation state, keyboard handling, and position persistence

### Updating the Runtime

When modifying `runtime/v1/presentation.js` or `runtime/v1/presentation.css`:
1. Make the change in `runtime/v1/`
2. Copy to `docs/runtime/v1/` (the GitHub Pages demo uses the local copy)
3. Run tests to verify
4. Tag a new `v1` release so jsDelivr picks up the update

## Content Block Types

The runtime renders these block kinds from `presentation-data.json`:
- `text` -- paragraph with inline markdown
- `heading` -- section heading
- `code` -- syntax-highlighted code with optional filename and line highlights
- `bullets` -- bullet list with inline markdown
- `callout` -- tip/warning/info box
- `comparison` -- side-by-side code panels
- `mermaid` -- Mermaid diagram
- `image` -- image with optional caption, size, and frame

Adding a new block type requires changes in:
1. `renderContentBlock()` in `runtime/v1/presentation.js`
2. Corresponding CSS in `runtime/v1/presentation.css`
3. Documentation in `skills/presentation/SKILL.md` (content block types section)
4. Tests in `tests/`
5. Update `docs/runtime/v1/` copies

## Contribution Guidelines

### Always Do

- **Update tests** when changing runtime behavior or adding features
- **Update SKILL.md** when changing the presentation data schema, adding block types, or modifying the generation workflow
- **Update README.md** when adding user-facing features, changing installation, or modifying keyboard shortcuts
- **Copy runtime to docs/** when changing `runtime/v1/` files
- **Run `yarn test`** before committing

### Never Do

- Break the `presentation-data.json` schema for existing presentations
- Change CDN URLs without updating the template
- Add Node.js dependencies to the runtime (it must stay vanilla JS for CDN delivery)
- Modify `docs/` demo content without regenerating from source data

## Code Style

- Vanilla JS (no build step) for runtime -- must work directly from CDN
- 2-space indentation, single quotes, no semicolons in JS
- Python scripts follow standard Python conventions (the audio script is standalone)
