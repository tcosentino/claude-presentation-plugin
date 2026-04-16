#!/usr/bin/env python3
"""Generate an MP4 video from a presentation using Playwright and FFmpeg.

Usage:
    python3 generate-presentation-video.py <presentation-directory>

The script opens the presentation in headless Chromium with ?autoplay=1,
records a silent video, then muxes the original MP3 narration files at
their exact playback offsets using FFmpeg.

Requires:
    pip install playwright && python3 -m playwright install chromium
    ffmpeg on PATH
"""

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class StepCapture:
    slide_idx: int
    step_idx: int
    mp3: str
    start_seconds: float


async def record_silent_video(
    html_path: Path,
    out_webm: Path,
    resolution: tuple[int, int],
    pause_ms: int,
    end_hold: float,
) -> list[StepCapture]:
    """Launch headless Chromium, let autoplay run, record silent WebM."""
    from playwright.async_api import async_playwright

    captures: list[StepCapture] = []
    capture_start: float = 0.0
    presentation_ended = asyncio.Event()

    width, height = resolution

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=['--autoplay-policy=no-user-gesture-required'],
        )
        context = await browser.new_context(
            viewport={'width': width, 'height': height},
            record_video_dir=str(out_webm.parent),
            record_video_size={'width': width, 'height': height},
        )
        page = await context.new_page()

        # Expose callback so the template can notify us of each step start
        async def on_step_start(slide_idx, step_idx, src):
            elapsed = time.monotonic() - capture_start
            captures.append(StepCapture(
                slide_idx=int(slide_idx),
                step_idx=int(step_idx),
                mp3=str(src),
                start_seconds=elapsed,
            ))
            total = int(slide_idx) + 1
            print(f'  Step: slide {total}, step {int(step_idx)} @ {elapsed:.2f}s -- {src}')

        await page.expose_function('__onStepStart', on_step_start)

        # Listen for the presentation-ended event
        await page.evaluate('''() => {
            window.addEventListener('presentation-ended', () => {
                window.__presentationEnded = true
            })
        }''')

        url = html_path.as_uri() + f'?autoplay=1&pause={pause_ms}'
        print(f'  Navigating to {url}')
        await page.goto(url, wait_until='networkidle')

        # Wait for fonts, highlight.js, mermaid to settle
        print('  Waiting for presentation ready...')
        await page.evaluate('() => window.__presentationReady')
        print('  Presentation ready. Recording...')

        capture_start = time.monotonic()

        # Poll for presentation-ended
        while True:
            ended = await page.evaluate('() => window.__presentationEnded === true')
            if ended:
                break
            await asyncio.sleep(0.5)

        elapsed = time.monotonic() - capture_start
        print(f'  Presentation ended at {elapsed:.2f}s. Holding {end_hold}s...')
        await asyncio.sleep(end_hold)

        # Close context to flush the video
        await context.close()
        await browser.close()

    # Playwright saves video as a single file in record_video_dir
    # Find it and rename to out_webm
    video_files = list(out_webm.parent.glob('*.webm'))
    if not video_files:
        print('Error: no WebM file produced by Playwright')
        sys.exit(1)
    video_files[0].rename(out_webm)

    return captures


def mux(
    webm: Path,
    captures: list[StepCapture],
    audio_dir: Path,
    out_mp4: Path,
) -> None:
    """Transcode WebM to H.264 and mux MP3 audio at logged offsets."""
    if not captures:
        # No audio -- just transcode video
        cmd = [
            'ffmpeg', '-y', '-i', str(webm),
            '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
            '-pix_fmt', 'yuv420p',
            str(out_mp4),
        ]
        print(f'  Running: {" ".join(cmd[:6])}...')
        subprocess.run(cmd, check=True, capture_output=True)
        return

    # Build FFmpeg command with filter_complex
    inputs = ['-i', str(webm)]
    filter_parts = []
    valid_captures = []

    for i, cap in enumerate(captures):
        mp3_path = audio_dir / cap.mp3
        if not mp3_path.exists():
            print(f'  Warning: {mp3_path} not found, skipping audio for slide {cap.slide_idx} step {cap.step_idx}')
            continue
        inputs.extend(['-i', str(mp3_path)])
        input_idx = len(valid_captures) + 1  # 0 is the video
        delay_ms = int(cap.start_seconds * 1000)
        filter_parts.append(f'[{input_idx}]adelay={delay_ms}|{delay_ms}[a{i}]')
        valid_captures.append((i, cap))

    if not valid_captures:
        # All audio missing, just transcode
        mux(webm, [], audio_dir, out_mp4)
        return

    # Mix all delayed audio tracks
    mix_inputs = ''.join(f'[a{i}]' for i, _ in valid_captures)
    filter_parts.append(f'{mix_inputs}amix=inputs={len(valid_captures)}:normalize=0[aout]')
    filter_complex = ';'.join(filter_parts)

    cmd = [
        'ffmpeg', '-y',
        *inputs,
        '-filter_complex', filter_complex,
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        str(out_mp4),
    ]

    print(f'  Muxing {len(valid_captures)} audio tracks...')
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'  FFmpeg error:\n{result.stderr[-2000:]}')
        sys.exit(1)


async def main():
    parser = argparse.ArgumentParser(
        description='Generate MP4 video from a presentation directory'
    )
    parser.add_argument('presentation_dir', type=Path, help='Path to presentation directory')
    parser.add_argument('--output', type=Path, default=None, help='Output MP4 path (default: <dir>/presentation.mp4)')
    parser.add_argument('--resolution', default='1920x1080', help='Video resolution (default: 1920x1080)')
    parser.add_argument('--pause-ms', type=int, default=400, help='Pause between steps in ms (default: 400)')
    parser.add_argument('--end-hold', type=float, default=2.0, help='Seconds to hold final frame (default: 2.0)')
    parser.add_argument('--headed', action='store_true', help='Run browser in headed mode (for debugging)')
    parser.add_argument('--keep-temp', action='store_true', help='Keep temporary WebM file')

    args = parser.parse_args()

    presentation_dir = args.presentation_dir.resolve()
    html_path = presentation_dir / 'index.html'
    data_path = presentation_dir / 'presentation-data.json'
    audio_dir = presentation_dir / 'audio'

    if not html_path.exists():
        print(f'Error: {html_path} not found')
        sys.exit(1)
    if not data_path.exists():
        print(f'Error: {data_path} not found')
        sys.exit(1)

    out_mp4 = args.output or (presentation_dir / 'presentation.mp4')
    width, height = [int(x) for x in args.resolution.split('x')]

    # Check dependencies
    if not shutil.which('ffmpeg'):
        print('Error: ffmpeg not found on PATH')
        sys.exit(1)

    with open(data_path) as f:
        data = json.load(f)
    total_slides = sum(len(s['slides']) for s in data['sections'])
    total_steps = sum(len(slide['steps']) for s in data['sections'] for slide in s['slides'])
    print(f'Presentation: {data["title"]}')
    print(f'  {total_slides} slides, {total_steps} steps')
    print(f'  Resolution: {width}x{height}')
    print(f'  Step pause: {args.pause_ms}ms')
    print()

    # Create temp dir for WebM
    tmp_dir = Path(tempfile.mkdtemp(prefix='presentation-video-'))
    webm_path = tmp_dir / 'recording.webm'

    try:
        print('Phase 1: Recording silent video...')
        captures = await record_silent_video(
            html_path=html_path,
            out_webm=webm_path,
            resolution=(width, height),
            pause_ms=args.pause_ms,
            end_hold=args.end_hold,
        )
        print(f'\n  Recorded {len(captures)} step transitions')
        print(f'  WebM: {webm_path} ({webm_path.stat().st_size / 1024 / 1024:.1f} MB)')

        print(f'\nPhase 2: Muxing audio and transcoding to MP4...')
        mux(
            webm=webm_path,
            captures=captures,
            audio_dir=audio_dir,
            out_mp4=out_mp4,
        )

        print(f'\nDone! Output: {out_mp4}')
        print(f'  Size: {out_mp4.stat().st_size / 1024 / 1024:.1f} MB')

    finally:
        if not args.keep_temp:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        else:
            print(f'  Temp files kept at: {tmp_dir}')


if __name__ == '__main__':
    asyncio.run(main())
