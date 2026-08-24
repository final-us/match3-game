#!/usr/bin/env python3
"""Deterministically synthesize the two original loopable BGM tracks.

Only Python's standard library is used for synthesis. macOS afconvert performs
the final AAC/M4A encoding by default; ``--ffmpeg`` is an explicit offline
fallback for macOS installations without an AAC encoder. Temporary PCM WAV
files are deleted automatically.
"""

import argparse
from array import array
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave


SAMPLE_RATE = 22050
CHANNELS = 1
AAC_BITRATE = 40000
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "res" / "audio"

# C-major pentatonic notes. Warm chords use the same pitch set.
SEMITONES = {
    "C3": 48, "D3": 50, "E3": 52, "G3": 55, "A3": 57,
    "C4": 60, "D4": 62, "E4": 64, "G4": 67, "A4": 69,
    "C5": 72, "D5": 74, "E5": 76, "G5": 79, "A5": 81,
    "C6": 84, "D6": 86, "E6": 88, "G6": 91, "A6": 93,
}
CHORDS = (
    ("C3", "E3", "G3", "A3"),
    ("A3", "C4", "E4", "G4"),
    ("D3", "A3", "C4", "E4"),
    ("G3", "A3", "C4", "E4"),
)
THEME = (
    "C5", "E5", "G5", None, "A5", "G5", "E5", "D5",
    "C5", None, "D5", "E5", "G5", "E5", "D5", None,
    "A4", "C5", "E5", "G5", "E5", "D5", "C5", None,
    "G4", "A4", "C5", "D5", "E5", "D5", "C5", None,
)


def frequency(note):
    return 440.0 * (2.0 ** ((SEMITONES[note] - 69) / 12.0))


def add_music_box(samples, start, duration, note, amplitude, brighter=False):
    """Add a soft, zero-ended music-box/plucked note."""
    first = max(0, int(start * SAMPLE_RATE))
    count = min(int(duration * SAMPLE_RATE), len(samples) - first)
    if count <= 0:
        return
    freq = frequency(note)
    attack = max(1, int(0.006 * SAMPLE_RATE))
    release = max(1, int(0.025 * SAMPLE_RATE))
    decay = 4.8 if brighter else 3.8
    harmonic = 0.30 if brighter else 0.22
    for i in range(count):
        t = i / SAMPLE_RATE
        envelope = min(1.0, i / attack) * math.exp(-decay * t)
        if i >= count - release:
            envelope *= max(0.0, (count - 1 - i) / release)
        phase = math.tau * freq * t
        value = (
            math.sin(phase) + harmonic * math.sin(phase * 2.0)
            + 0.08 * math.sin(phase * 3.0)
        )
        samples[first + i] += amplitude * envelope * value


def add_pad(samples, start, duration, note, amplitude):
    """Add a quiet warm chord voice with smooth attack and release."""
    first = max(0, int(start * SAMPLE_RATE))
    count = min(int(duration * SAMPLE_RATE), len(samples) - first)
    if count <= 0:
        return
    freq = frequency(note)
    edge = max(1, int(min(0.30, duration * 0.16) * SAMPLE_RATE))
    for i in range(count):
        t = i / SAMPLE_RATE
        envelope = min(1.0, i / edge, (count - 1 - i) / edge)
        phase = math.tau * freq * t
        samples[first + i] += amplitude * envelope * (
            math.sin(phase) + 0.12 * math.sin(phase * 2.0)
        )


def add_paw_beat(samples, start, accent, seed):
    """Add a light synthetic paw tap; this is not an animal recording."""
    first = max(0, int(start * SAMPLE_RATE))
    count = min(int(0.085 * SAMPLE_RATE), len(samples) - first)
    state = seed & 0x7FFFFFFF
    for i in range(count):
        t = i / SAMPLE_RATE
        state = (1103515245 * state + 12345) & 0x7FFFFFFF
        grit = (state / 0x7FFFFFFF) * 2.0 - 1.0
        envelope = math.exp(-42.0 * t)
        thump = math.sin(math.tau * (115.0 - 45.0 * t) * t)
        samples[first + i] += accent * envelope * (0.80 * thump + 0.12 * grit)


def synthesize(name, bpm):
    beat = 60.0 / bpm
    bar = beat * 4.0
    duration = bar * 12.0
    samples = array("f", [0.0]) * int(round(duration * SAMPLE_RATE))
    battle = name == "battle"

    for bar_index in range(12):
        bar_start = bar_index * bar
        for chord_note in CHORDS[bar_index % len(CHORDS)]:
            add_pad(samples, bar_start, bar * 0.98, chord_note, 0.020 if battle else 0.026)

        # Calm uses quarter-note music-box phrases. Battle keeps the theme on
        # eighth notes with a gentle plucked articulation.
        steps_per_bar = 8 if battle else 4
        step = bar / steps_per_bar
        theme_start = (bar_index % 4) * 8
        for step_index in range(steps_per_bar):
            note = THEME[(theme_start + step_index) % len(THEME)]
            if note is None:
                continue
            add_music_box(
                samples,
                bar_start + step_index * step,
                min(step * (0.82 if battle else 0.72), 0.62),
                note,
                0.105 if battle else 0.125,
                brighter=battle,
            )

        if battle:
            for beat_index in range(4):
                add_paw_beat(
                    samples,
                    bar_start + beat_index * beat,
                    0.075 if beat_index == 0 else 0.048,
                    1009 + bar_index * 17 + beat_index,
                )
        elif bar_index in (3, 7, 11):
            add_music_box(samples, bar_start + bar * 0.72, 0.72, "C6", 0.07)

    peak = max(abs(value) for value in samples) or 1.0
    gain = 0.76 / peak
    edge = max(1, int(0.018 * SAMPLE_RATE))
    pcm = array("h")
    for index, value in enumerate(samples):
        edge_gain = min(1.0, index / edge, (len(samples) - 1 - index) / edge)
        scaled = max(-1.0, min(1.0, value * gain * edge_gain))
        pcm.append(int(round(scaled * 32767.0)))
    return pcm, duration


def write_wav(path, pcm):
    with wave.open(str(path), "wb") as target:
        target.setnchannels(CHANNELS)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        target.writeframes(pcm.tobytes())


def encode_m4a(wav_path, output_path, ffmpeg=None):
    if ffmpeg:
        subprocess.run([
            str(ffmpeg), "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(wav_path), "-vn", "-ac", str(CHANNELS),
            "-ar", str(SAMPLE_RATE), "-c:a", "aac",
            "-b:a", str(AAC_BITRATE), "-movflags", "+faststart",
            str(output_path),
        ], check=True)
        return

    subprocess.run([
        "afconvert", str(wav_path), "-o", str(output_path),
        "-f", "m4af", "-d", "aac", "-c", str(CHANNELS),
        "-b", str(AAC_BITRATE), "-q", "96", "-s", "0", "--no-filler",
    ], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ffmpeg", type=Path,
        help="explicit offline ffmpeg executable when afconvert lacks AAC support",
    )
    args = parser.parse_args()
    if args.ffmpeg:
        if not args.ffmpeg.is_file():
            raise SystemExit("ffmpeg executable not found: {}".format(args.ffmpeg))
    elif not shutil.which("afconvert"):
        raise SystemExit("macOS afconvert is required, or pass --ffmpeg PATH")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="match3-audio-") as temp_dir:
        for name, bpm in (("calm", 72.0), ("battle", 112.0)):
            pcm, duration = synthesize(name, bpm)
            wav_path = Path(temp_dir) / (name + ".wav")
            output_path = OUTPUT_DIR / (name + ".m4a")
            write_wav(wav_path, pcm)
            encode_m4a(wav_path, output_path, args.ffmpeg)
            print("{}: {:.3f}s -> {}".format(name, duration, output_path))


if __name__ == "__main__":
    main()
