#!/usr/bin/env python3
"""Generate MP3 audio files for a presentation using edge-tts.

Usage:
    python3 generate-presentation-audio.py <presentation-directory>

The script reads presentation-data.json from the presentation directory and generates
one MP3 file per slide step in the audio/ subdirectory.

Requires: pip install edge-tts
"""

import asyncio
import json
import sys
from pathlib import Path

VOICE = 'en-US-AndrewMultilingualNeural'
RATE = '+25%'


async def generate_audio(text: str, output_path: Path) -> None:
    """Generate a single MP3 file from text using edge-tts."""
    import edge_tts
    output_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
    await communicate.save(str(output_path))


async def main(presentation_dir: Path) -> None:
    data_file = presentation_dir / 'presentation-data.json'
    if not data_file.exists():
        print(f'Error: {data_file} not found')
        sys.exit(1)

    with open(data_file) as f:
        presentation_data = json.load(f)

    audio_dir = presentation_dir / 'audio'
    audio_dir.mkdir(exist_ok=True)

    slide_index = 0
    tasks = []

    for section in presentation_data['sections']:
        for slide in section['slides']:
            slide_index += 1
            for step_index, step in enumerate(slide['steps']):
                narration_text = step.get('narrationText', '')
                if not narration_text:
                    continue

                filename = step.get('narration', f'slide-{slide_index:02d}-step-{step_index}.mp3')
                output_path = audio_dir / filename

                if output_path.exists():
                    print(f'  Skipping {filename} (exists)')
                    continue

                print(f'  Generating {filename}...')
                tasks.append(generate_audio(narration_text, output_path))

    if tasks:
        # Process in batches of 5 to avoid overwhelming the API
        batch_size = 5
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i + batch_size]
            await asyncio.gather(*batch)
        print(f'\nDone! Generated {len(tasks)} audio files.')
    else:
        print('All audio files already exist. Nothing to generate.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} <presentation-directory>')
        sys.exit(1)

    presentation_dir = Path(sys.argv[1])
    if not presentation_dir.is_dir():
        print(f'Error: {presentation_dir} is not a directory')
        sys.exit(1)

    asyncio.run(main(presentation_dir))
