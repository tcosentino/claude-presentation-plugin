---
name: video-export
description: Export a presentation to an MP4 video with audio narration
---

# /video-export Skill

Export a presentation directory to an MP4 video where slides auto-advance with narration.

## Usage

```
/video-export <presentation-directory>
```

Examples:
- `/video-export presentations/typescript-fundamentals`
- `/video-export docs/`

## Prerequisites

- The presentation must already be generated (index.html, presentation-data.json, audio/ directory)
- `playwright` Python package: `pip install playwright && python3 -m playwright install chromium`
- `ffmpeg` on PATH

## Workflow

### Step 1: Validate the presentation

Confirm the presentation directory contains:
- `index.html`
- `presentation-data.json`
- `audio/` directory with MP3 files

If audio files are missing, generate them first:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/generate-presentation-audio.py <presentation-directory>
```

### Step 2: Generate the video

Run the video generation script:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/generate-presentation-video.py <presentation-directory>
```

This will:
1. Open the presentation in headless Chromium with `?autoplay=1`
2. Record a silent video as slides auto-advance
3. Mux the original MP3 narration files at their exact playback offsets using FFmpeg
4. Output `presentation.mp4` in the presentation directory

### Step 3: Verify

Open the generated MP4:

```bash
open <presentation-directory>/presentation.mp4
```

Tell the user:
- The video file path and size
- Runtime is approximately real-time (a 10-minute deck takes ~10 minutes to export)
- They can adjust timing with `--pause-ms` (default 400ms between steps)

## CLI Options

| Flag | Default | Description |
| --- | --- | --- |
| `--output <path>` | `<dir>/presentation.mp4` | Output file path |
| `--resolution <WxH>` | `1920x1080` | Video resolution |
| `--pause-ms <ms>` | `400` | Pause between steps in milliseconds |
| `--end-hold <s>` | `2.0` | Seconds to hold the final frame |
| `--headed` | off | Run browser visibly (for debugging) |
| `--keep-temp` | off | Keep intermediate WebM file |

## How It Works

The presentation template supports an autoplay mode via `?autoplay=1` URL parameter. In this mode:

1. The deck starts at slide 0, step 0 (ignoring any saved position)
2. After each step's audio finishes playing, it auto-advances to the next step
3. Steps without audio use a fallback delay (`pause-ms * 4`)
4. When the last step ends, a `presentation-ended` event fires

The video exporter drives this by:

1. Recording a silent video via Playwright's `record_video_dir`
2. Capturing the exact timestamp of each step reveal via an exposed `__onStepStart` callback
3. Using FFmpeg `adelay` filters to place each MP3 at its recorded offset
4. Muxing the aligned audio onto the transcoded video

Audio is **not** captured from the browser. The original MP3 files are muxed directly for lossless quality, deterministic results, and headless compatibility.

## Important Notes

- Export is approximately real-time since it records the actual playback
- The script requires network access on first run to load Highlight.js and Mermaid from CDN
- Resolution should match the aspect ratio of the presentation (16:9 recommended)
- For presentations with many slides, the FFmpeg filter_complex can get large but this is handled automatically
