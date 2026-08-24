#!/usr/bin/env python3
"""Render the CC0 acoustic SFX preview and runtime audio sprite."""

import argparse
from array import array
from dataclasses import dataclass
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import wave


SAMPLE_RATE = 22050
DURATION = 25.0
FRAME_COUNT = int(round(SAMPLE_RATE * DURATION))
MIX_BGM_GAIN = 0.62
DUCK_GAIN = 0.85
DUCK_DURATION = 0.60
SPRITE_GAP = 0.025
AAC_BITRATE = 28000
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "docs" / "design"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
CALM_PATH = PROJECT_ROOT / "res" / "audio" / "calm.m4a"
SPRITE_PATH = PROJECT_ROOT / "res" / "audio" / "sfx-acoustic.m4a"
SPRITE_MAP_PATH = PROJECT_ROOT / "js" / "sfx-acoustic-map.js"
SOURCE_ROOTS = {
    "ui": Path("/tmp/sanxiao-ui-acoustic/ui_ogg"),
    "interface": Path("/tmp/kenney-interface/Audio"),
    "impact": Path("/tmp/kenney-impact/Audio"),
    "rpg": Path("/tmp/kenney-rpg/Audio"),
    "special": OUTPUT_DIR / "audio-sources",
}
SOURCE_FILTERS = {
    "special/sanxiao-real-rocket.ogg": "atempo=1.45,lowpass=f=6500",
    "special/sanxiao-real-explosion.ogg":
        "highpass=f=90,lowpass=f=5200,acompressor=threshold=0.25:ratio=4:attack=5:release=100",
    "special/sanxiao-real-magic.ogg": "highpass=f=180,lowpass=f=7200",
}


@dataclass(frozen=True)
class Clip:
    source: str
    delay: float
    duration: float
    gain: float
    source_offset: float = 0.0
    fade_in: float = 0.006
    fade_out: float = 0.024


@dataclass(frozen=True)
class Cue:
    key: str
    label: str
    start: float
    clips: tuple


def clip(source, duration, gain, delay=0.0, source_offset=0.0, fade_in=0.006, fade_out=0.024):
    return Clip(source, delay, duration, gain, source_offset, fade_in, fade_out)


def source_path(key):
    pack, name = key.split("/", 1)
    return SOURCE_ROOTS[pack] / name


CUES = (
    Cue("click1", "点击变体 1", 0.35, (clip("ui/click_1.ogg", 0.18, 0.68),)),
    Cue("click2", "点击变体 2", 0.90, (clip("ui/click_2.ogg", 0.18, 0.72),)),
    Cue("click3", "点击变体 3", 1.45, (clip("ui/click_3.ogg", 0.18, 0.58),)),
    Cue("swap", "交换", 2.30, (clip("interface/switch_001.ogg", 0.24, 0.36),)),
    Cue("drop", "掉落", 2.80, (clip("interface/drop_003.ogg", 0.14, 0.85),)),
    Cue("invalid", "无效", 3.35, (clip("ui/negative_sound2.ogg", 0.32, 0.28),)),
    Cue("clear", "普通消除", 4.10, (clip("ui/Ding.ogg", 0.42, 1.35),)),
    Cue("combo", "连消", 5.25, (
        clip("ui/chimes.ogg", 0.82, 0.95),
        clip("ui/Ding.ogg", 0.38, 1.00, delay=0.11),
    )),
    Cue("jelly", "果冻", 6.70, (
        clip("impact/impactSoft_medium_000.ogg", 0.10, 0.95),
        clip("rpg/cloth2.ogg", 0.24, 0.60, delay=0.02),
    )),
    Cue("ice", "冰块", 7.75, (
        clip("interface/glass_001.ogg", 0.22, 0.70),
        clip("impact/impactGlass_light_000.ogg", 0.20, 0.90, delay=0.03),
    )),
    Cue("rocket", "火箭", 8.80, (
        clip("special/sanxiao-real-rocket.ogg", 0.90, 0.58, fade_out=0.10),
        clip("ui/Ding.ogg", 0.24, 0.16, delay=0.64, fade_out=0.05),
    )),
    Cue("color", "彩球", 9.95, (
        clip("special/sanxiao-real-magic.ogg", 1.18, 0.30, source_offset=2.34, fade_out=0.16),
    )),
    Cue("bomb", "炸弹", 11.10, (
        clip("special/sanxiao-real-explosion.ogg", 0.86, 0.34, fade_out=0.14),
        clip("ui/Ding.ogg", 0.22, 0.10, delay=0.55, fade_out=0.05),
    )),
    Cue("specialCombo", "特殊棋子组合", 22.00, (
        clip("special/sfx-special-combo-musicbox-v7.wav", 0.872, 1.00, fade_in=0.0, fade_out=0.0),
    )),
    Cue("hammer", "锤子", 11.78, (
        clip("impact/impactWood_medium_000.ogg", 0.28, 0.95),
        clip("rpg/cloth2.ogg", 0.20, 0.55, delay=0.02),
    )),
    Cue("purchase", "购买", 12.35, (
        clip("rpg/handleCoins.ogg", 0.45, 0.48),
        clip("interface/confirmation_001.ogg", 0.24, 0.35, delay=0.08),
        clip("ui/Ding.ogg", 0.36, 0.95, delay=0.14),
    )),
    Cue("freezeCast", "PvP 释放冰冻", 13.70, (
        clip("interface/glass_001.ogg", 0.22, 0.75),
        clip("impact/impactGlass_medium_000.ogg", 0.30, 0.70, delay=0.03),
    )),
    Cue("freezeHit", "PvP 受击冰冻", 14.25, (
        clip("impact/impactGlass_heavy_000.ogg", 0.22, 0.90),
        clip("impact/impactSoft_medium_000.ogg", 0.10, 0.70, delay=0.03),
    )),
    Cue("disturbCast", "PvP 释放干扰", 15.00, (
        clip("rpg/cloth1.ogg", 0.28, 0.55),
        clip("ui/chimes.ogg", 0.42, 0.42, delay=0.10),
    )),
    Cue("disturbHit", "PvP 受击干扰", 15.60, (
        clip("impact/impactSoft_heavy_000.ogg", 0.42, 0.55),
        clip("ui/negative_sound2.ogg", 0.25, 0.20, delay=0.02),
    )),
    Cue("win", "胜利", 17.10, (
        clip("ui/chimes.ogg", 0.72, 0.90),
        clip("ui/Ding.ogg", 0.36, 1.10, delay=0.18),
        clip("ui/Ding.ogg", 0.36, 0.90, delay=0.36),
    )),
    Cue("lose", "失败", 20.00, (
        clip("ui/dum.ogg", 0.30, 1.40),
        clip("ui/negative_sound.ogg", 0.38, 0.90, delay=0.12),
        clip("ui/negative_sound2.ogg", 0.25, 0.15, delay=0.22),
    )),
)


def read_pcm16_riff(path):
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise RuntimeError("decoder did not return RIFF/WAVE: {}".format(path))
    offset = 12
    format_tag = channels = rate = bits = None
    audio = None
    while offset + 8 <= len(data):
        chunk, size = struct.unpack_from("<4sI", data, offset)
        payload_start = offset + 8
        payload = data[payload_start:payload_start + size]
        if chunk == b"fmt ":
            if len(payload) < 16:
                raise RuntimeError("truncated WAVE fmt chunk: {}".format(path))
            format_tag, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", payload, 0)
            if format_tag == 0xFFFE and len(payload) >= 40:
                format_tag = struct.unpack_from("<I", payload, 24)[0]
        elif chunk == b"data":
            audio = payload
        offset = payload_start + size + (size & 1)
    if format_tag != 1 or not channels or rate != SAMPLE_RATE or bits != 16 or audio is None:
        raise RuntimeError("unexpected decoded PCM format: {}".format(path))
    if len(audio) % (2 * channels):
        raise RuntimeError("truncated PCM data: {}".format(path))
    values = struct.unpack("<{}h".format(len(audio) // 2), audio)
    return array("d", (
        sum(values[index:index + channels]) / (32768.0 * channels)
        for index in range(0, len(values), channels)
    ))


def decode(path, temp_dir, index, audio_filter=None):
    output = Path(temp_dir) / "source-{:02d}.wav".format(index)
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        command = [ffmpeg, "-v", "error", "-y", "-i", str(path)]
        if audio_filter:
            command.extend(["-af", audio_filter])
        command.extend([
            "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "pcm_s16le", str(output),
        ])
        subprocess.run(command, check=True)
    else:
        if audio_filter:
            raise RuntimeError("ffmpeg is required for approved special-piece source processing")
        afconvert = shutil.which("afconvert") or "/usr/bin/afconvert"
        if not Path(afconvert).is_file():
            raise RuntimeError("OGG decoder unavailable: install ffmpeg to regenerate the SFX sprite")
        try:
            subprocess.run([
                afconvert, str(path), str(output), "-f", "WAVE", "-d", "LEI16@22050",
            ], check=True)
        except subprocess.CalledProcessError as error:
            raise RuntimeError(
                "afconvert cannot decode this OGG file; install ffmpeg and rerun the generator"
            ) from error
    return read_pcm16_riff(output)


def render_clip(bus, samples, cue_start, item):
    start = int(round((cue_start + item.delay) * SAMPLE_RATE))
    source_start = int(round(item.source_offset * SAMPLE_RATE))
    requested = int(round(item.duration * SAMPLE_RATE))
    count = min(requested, len(samples) - source_start, len(bus) - start)
    if start < 0 or source_start < 0 or count <= 0:
        raise ValueError("clip outside preview: {} at {:.3f}s".format(item.source, cue_start))
    fade_in = min(int(item.fade_in * SAMPLE_RATE), count // 2)
    fade_out = min(int(item.fade_out * SAMPLE_RATE), count // 2)
    for offset in range(count):
        envelope = 1.0
        if fade_in:
            envelope = min(envelope, (offset + 1) / fade_in)
        if fade_out:
            envelope = min(envelope, (count - offset) / fade_out)
        bus[start + offset] += samples[source_start + offset] * item.gain * envelope


def render_sfx(decoded):
    bus = array("d", [0.0]) * FRAME_COUNT
    for cue in CUES:
        for item in cue.clips:
            render_clip(bus, decoded[item.source], cue.start, item)
    return bus


def render_sprite(decoded):
    gap_frames = int(round(SPRITE_GAP * SAMPLE_RATE))
    sprite = array("d")
    cues = {}
    for index, cue in enumerate(CUES):
        cue_frames = int(round(max(item.delay + item.duration for item in cue.clips) * SAMPLE_RATE))
        event = array("d", [0.0]) * cue_frames
        for item in cue.clips:
            render_clip(event, decoded[item.source], 0.0, item)
        cues[cue.key] = {
            "offset": round(len(sprite) / SAMPLE_RATE, 6),
            "duration": round(cue_frames / SAMPLE_RATE, 6),
        }
        sprite.extend(event)
        if index + 1 < len(CUES):
            sprite.extend(array("d", [0.0]) * gap_frames)
    return safe_samples(sprite), cues


def duck_ranges():
    return tuple((cue.start, cue.start + DUCK_DURATION) for cue in CUES if cue.key in ("win", "lose"))


def mix_with_calm(sfx, calm):
    mixed = array("d", [0.0]) * FRAME_COUNT
    ranges = duck_ranges()
    for index in range(FRAME_COUNT):
        time = index / SAMPLE_RATE
        bgm_gain = MIX_BGM_GAIN
        if any(start <= time < end for start, end in ranges):
            bgm_gain *= DUCK_GAIN
        mixed[index] = calm[index] * bgm_gain + sfx[index]
    return mixed


def safe_samples(samples):
    peak = max((abs(value) for value in samples), default=0.0)
    if not math.isfinite(peak):
        raise ValueError("generated audio contains NaN or infinity")
    if peak >= 0.89:
        samples = array("d", (value * (0.88 / peak) for value in samples))
    if max((abs(value) for value in samples), default=0.0) >= 0.90:
        raise ValueError("generated audio exceeds the 0.90 peak ceiling")
    return samples


def pcm16(samples):
    values = array("h")
    for value in samples:
        if not math.isfinite(value):
            raise ValueError("generated audio contains NaN or infinity")
        values.append(max(-32768, min(32767, int(round(value * 32767.0)))))
    if sys.byteorder != "little":
        values.byteswap()
    return values


def write_wav(path, samples):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm16(safe_samples(samples)).tobytes())


def inspect_wav(path, expected_frames=FRAME_COUNT):
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        width = source.getsampwidth()
        rate = source.getframerate()
        frames = source.getnframes()
        raw = source.readframes(frames)
    if channels != 1 or width != 2 or rate != SAMPLE_RATE or frames != expected_frames:
        raise ValueError("unexpected WAV format: {} {} {} {}".format(channels, width, rate, frames))
    values = struct.unpack("<{}h".format(frames), raw)
    peak = max((abs(value) for value in values), default=0) / 32768.0
    rms = math.sqrt(sum(value * value for value in values) / len(values)) / 32768.0
    clipped = any(value <= -32768 or value >= 32767 for value in values)
    return frames / SAMPLE_RATE, peak, rms, clipped


def encode_m4a(wav_path, output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        subprocess.run([
            ffmpeg, "-v", "error", "-y", "-i", str(wav_path),
            "-ac", "1", "-ar", str(SAMPLE_RATE), "-c:a", "aac",
            "-b:a", str(AAC_BITRATE), "-movflags", "+faststart", str(output_path),
        ], check=True)
    else:
        subprocess.run([
            "afconvert", str(wav_path), "-o", str(output_path),
            "-f", "m4af", "-d", "aac", "-c", "1",
            "-b", str(AAC_BITRATE), "-q", "96", "-s", "0", "--no-filler",
        ], check=True)


def write_sprite_map(path, cues):
    payload = {
        "file": "res/audio/sfx-acoustic.m4a",
        "sampleRate": SAMPLE_RATE,
        "gap": SPRITE_GAP,
        "cues": cues,
    }
    path.write_text(
        "'use strict';\n\n// Generated by tools/gen-sfx-acoustic-preview.py.\n"
        "module.exports = Object.freeze({});\n".format(json.dumps(payload, ensure_ascii=False, indent=2)),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--runtime-only", action="store_true")
    args = parser.parse_args()
    missing = sorted({str(source_path(item.source)) for cue in CUES for item in cue.clips if not source_path(item.source).is_file()})
    if not args.runtime_only and not CALM_PATH.is_file():
        missing.append(str(CALM_PATH))
    if missing:
        raise SystemExit("missing source(s):\n- " + "\n- ".join(missing))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    sources = sorted({item.source for cue in CUES for item in cue.clips})
    with tempfile.TemporaryDirectory(prefix="sanxiao-sfx-acoustic-", dir="/tmp") as temp_dir:
        decoded = {
            key: decode(source_path(key), temp_dir, index, SOURCE_FILTERS.get(key))
            for index, key in enumerate(sources)
        }
        sprite, sprite_cues = render_sprite(decoded)
        sprite_wav = Path(temp_dir) / "sfx-acoustic.wav"
        write_wav(sprite_wav, sprite)
        encode_m4a(sprite_wav, SPRITE_PATH)
        write_sprite_map(SPRITE_MAP_PATH, sprite_cues)
        sprite_duration, sprite_peak, sprite_rms, sprite_clipped = inspect_wav(sprite_wav, len(sprite))
        if not args.runtime_only:
            sfx = render_sfx(decoded)
            calm = decode(CALM_PATH, temp_dir, len(sources))
            if len(calm) < FRAME_COUNT:
                raise RuntimeError("calm.m4a is shorter than the 25-second preview")
            pure_path = args.output_dir / "sfx-acoustic-preview-v2.wav"
            mixed_path = args.output_dir / "sfx-acoustic-preview-mixed-v2.wav"
            write_wav(pure_path, sfx)
            write_wav(mixed_path, mix_with_calm(sfx, calm[:FRAME_COUNT]))
    if not args.runtime_only:
        print("cue table (seconds)")
        for cue in CUES:
            print("  {:>6.2f}  {}".format(cue.start, cue.label))
        for path in (pure_path, mixed_path):
            duration, peak, rms, clipped = inspect_wav(path)
            print("{}: duration={:.3f}s peak={:.6f} rms={:.6f} clipped={}".format(
                path, duration, peak, rms, "yes" if clipped else "no"))
    print("{}: duration={:.3f}s peak={:.6f} rms={:.6f} clipped={} bytes={}".format(
        SPRITE_PATH, sprite_duration, sprite_peak, sprite_rms,
        "yes" if sprite_clipped else "no", SPRITE_PATH.stat().st_size))
    print("{}: {} cues, {:.3f}s gap".format(SPRITE_MAP_PATH, len(sprite_cues), SPRITE_GAP))


if __name__ == "__main__":
    main()
