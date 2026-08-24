#!/usr/bin/env python3
"""Generate the deterministic procedural SFX preview WAVs."""

import argparse
from array import array
from dataclasses import dataclass
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import wave


SAMPLE_RATE = 22050
DURATION = 25.0
FRAME_COUNT = int(round(SAMPLE_RATE * DURATION))
SFX_BUS_GAIN = 0.34
MAX_VOICES = 12
MIX_BGM_GAIN = 0.82
DUCK_GAIN = 0.85
DUCK_DURATION = 0.60
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "docs" / "design"
CALM_PATH = Path(__file__).resolve().parents[1] / "res" / "audio" / "calm.m4a"
TAU = math.tau


def hz(midi):
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


@dataclass(frozen=True)
class Voice:
    start: float
    duration: float
    frequency: float
    end_frequency: float
    amplitude: float
    shape: str
    decay: float


@dataclass(frozen=True)
class Cue:
    label: str
    start: float
    kind: str
    value: int = 0


# The timeline deliberately leaves a little air between cues so the preview is
# easy to review while still covering the complete frozen SFX list.
CUES = (
    Cue("点击变体 1", 0.35, "click", 0),
    Cue("点击变体 2", 0.90, "click", 1),
    Cue("点击变体 3", 1.45, "click", 2),
    Cue("交换", 2.30, "swap"),
    Cue("掉落", 2.80, "drop"),
    Cue("无效", 3.35, "invalid"),
    Cue("普通消除", 4.10, "clear"),
    Cue("连消", 5.25, "combo"),
    Cue("果冻", 6.70, "jelly"),
    Cue("冰块", 7.75, "ice"),
    Cue("火箭", 8.80, "rocket"),
    Cue("彩球", 9.95, "color"),
    Cue("炸弹", 11.10, "bomb"),
    Cue("锤子", 11.78, "hammer"),
    Cue("购买成功", 12.35, "purchase"),
    Cue("PvP 释放冰冻", 13.70, "freeze-cast"),
    Cue("PvP 受击冰冻", 14.25, "freeze-hit"),
    Cue("PvP 释放干扰", 15.00, "disturb-cast"),
    Cue("PvP 受击干扰", 15.60, "disturb-hit"),
    Cue("胜利", 17.10, "win"),
    Cue("失败", 20.00, "lose"),
)


class AudioBus:
    """One merged SFX bus; voice count is checked before rendering."""

    def __init__(self, duration):
        self.duration = duration
        self.voices = []

    def add(self, start, duration, frequency, amplitude, shape, end_frequency=None, decay=8.0):
        if start < 0 or duration <= 0 or start + duration > self.duration:
            raise ValueError("voice outside preview: {:.3f}s".format(start))
        self.voices.append(Voice(
            start, duration, frequency, end_frequency or frequency,
            amplitude, shape, decay,
        ))

    @staticmethod
    def _shape(shape, phase):
        sine = math.sin(phase)
        if shape == "felt":
            return sine + 0.24 * math.sin(phase * 2.0) + 0.06 * math.sin(phase * 3.0)
        if shape == "piano":
            return sine + 0.18 * math.sin(phase * 2.0) + 0.04 * math.sin(phase * 3.0)
        if shape == "glass":
            return sine + 0.28 * math.sin(phase * 2.73) + 0.12 * math.sin(phase * 4.11)
        if shape == "ice":
            return sine + 0.18 * math.sin(phase * 2.75) + 0.08 * math.sin(phase * 4.40)
        if shape == "water":
            return sine + 0.22 * math.sin(phase * 2.0)
        if shape == "drum":
            return sine + 0.16 * math.sin(phase * 1.90)
        if shape == "wood":
            return (2.0 / math.pi) * math.asin(sine) + 0.12 * math.sin(phase * 3.0)
        raise ValueError("unknown voice shape: {}".format(shape))

    def _check_voice_limit(self):
        edges = []
        for voice in self.voices:
            edges.append((voice.start, 1))
            edges.append((voice.start + voice.duration, -1))
        active = 0
        peak = 0
        for _, delta in sorted(edges, key=lambda item: (item[0], item[1])):
            active += delta
            peak = max(peak, active)
        if peak > MAX_VOICES:
            raise ValueError("SFX voice limit exceeded: {} > {}".format(peak, MAX_VOICES))
        return peak

    def render(self):
        self._check_voice_limit()
        samples = array("d", [0.0]) * FRAME_COUNT
        for voice in self.voices:
            first = int(round(voice.start * SAMPLE_RATE))
            count = min(int(round(voice.duration * SAMPLE_RATE)), FRAME_COUNT - first)
            attack = max(1, int(min(0.008, voice.duration * 0.18) * SAMPLE_RATE))
            release = max(1, int(min(0.070, voice.duration * 0.24) * SAMPLE_RATE))
            phase = 0.0
            for offset in range(count):
                t = offset / SAMPLE_RATE
                progress = min(1.0, t / voice.duration)
                frequency = voice.frequency + (voice.end_frequency - voice.frequency) * progress
                phase += TAU * frequency / SAMPLE_RATE
                envelope = min(1.0, (offset + 1) / attack) * math.exp(-voice.decay * t)
                if offset >= count - release:
                    envelope *= (count - offset) / release
                samples[first + offset] += voice.amplitude * envelope * self._shape(voice.shape, phase)

        for index in range(FRAME_COUNT):
            samples[index] *= SFX_BUS_GAIN
        return samples


def add(bus, start, duration, note, amplitude, shape, end_note=None, decay=8.0, delay=0.0):
    bus.add(
        start + delay,
        duration,
        hz(note),
        amplitude,
        shape,
        hz(end_note) if end_note is not None else None,
        decay,
    )


def add_note_pair(bus, start, note, amplitude=0.40, duration=0.18, delay=0.0):
    add(bus, start, duration, note, amplitude, "felt", decay=9.0, delay=delay)
    add(bus, start, duration * 0.82, note + 12, amplitude * 0.28, "glass", decay=12.0, delay=delay + 0.012)


def render_event(bus, cue):
    start = cue.start
    if cue.kind == "click":
        pitch, volume = ((0.98, 0.94), (1.00, 1.00), (1.02, 1.06))[cue.value]
        bus.add(start, 0.115, hz(74) * pitch, 0.58 * volume, "felt", decay=16.0)
    elif cue.kind == "swap":
        add(bus, start, 0.15, 60, 0.46, "felt", end_note=67, decay=12.0)
        add(bus, start, 0.12, 67, 0.25, "felt", end_note=72, decay=14.0, delay=0.045)
    elif cue.kind == "drop":
        add(bus, start, 0.09, 55, 0.34, "felt", end_note=52, decay=18.0)
    elif cue.kind == "invalid":
        add(bus, start, 0.16, 43, 0.50, "wood", end_note=40, decay=18.0)
    elif cue.kind == "clear":
        add_note_pair(bus, start, 64, 0.44, 0.17)
    elif cue.kind == "combo":
        for index, note in enumerate((64, 67, 69, 72)):
            add_note_pair(bus, start, note, 0.33, 0.17 - index * 0.008, delay=index * 0.055)
    elif cue.kind == "jelly":
        add(bus, start, 0.24, 81, 0.48, "water", end_note=64, decay=8.0)
        add(bus, start, 0.12, 88, 0.12, "glass", end_note=84, decay=14.0, delay=0.035)
    elif cue.kind == "ice":
        add(bus, start, 0.16, 84, 0.40, "ice", end_note=91, decay=13.0)
        add(bus, start, 0.11, 91, 0.15, "glass", decay=18.0, delay=0.030)
    elif cue.kind == "rocket":
        add(bus, start, 0.27, 67, 0.36, "glass", end_note=96, decay=7.0)
        add(bus, start, 0.22, 74, 0.22, "glass", end_note=103, decay=9.0, delay=0.045)
    elif cue.kind == "color":
        for index, note in enumerate((76, 79, 81, 84)):
            add(bus, start, 0.16, note, 0.23, "glass", decay=11.0, delay=index * 0.045)
    elif cue.kind == "bomb":
        add(bus, start, 0.28, 48, 0.55, "drum", end_note=30, decay=8.0)
        add(bus, start, 0.22, 43, 0.24, "drum", end_note=28, decay=10.0, delay=0.025)
    elif cue.kind == "hammer":
        add(bus, start, 0.13, 50, 0.50, "wood", end_note=43, decay=16.0)
        add(bus, start, 0.09, 62, 0.16, "felt", end_note=57, decay=18.0, delay=0.018)
    elif cue.kind == "purchase":
        add_note_pair(bus, start, 76, 0.31, 0.16)
        add_note_pair(bus, start, 81, 0.31, 0.16, delay=0.115)
    elif cue.kind == "freeze-cast":
        add(bus, start, 0.23, 69, 0.34, "ice", end_note=88, decay=9.0)
        add(bus, start, 0.13, 84, 0.14, "glass", end_note=96, decay=14.0, delay=0.040)
    elif cue.kind == "freeze-hit":
        add(bus, start, 0.25, 84, 0.38, "ice", end_note=55, decay=8.0)
        add(bus, start, 0.12, 91, 0.15, "glass", decay=16.0, delay=0.045)
    elif cue.kind == "disturb-cast":
        for index, note in enumerate((72, 76, 79, 76, 72)):
            add(bus, start, 0.13, note, 0.17, "glass", decay=13.0, delay=index * 0.043)
    elif cue.kind == "disturb-hit":
        add(bus, start, 0.22, 52, 0.37, "felt", end_note=50, decay=9.0)
        add(bus, start, 0.18, 55, 0.30, "felt", end_note=52, decay=11.0, delay=0.060)
    elif cue.kind == "win":
        for index, note in enumerate((60, 64, 67, 72)):
            delay = index * 0.105
            add(bus, start, 0.28, note, 0.38, "piano", decay=6.0, delay=delay)
            add(bus, start, 0.20, note + 12, 0.13, "glass", decay=13.0, delay=delay + 0.018)
    elif cue.kind == "lose":
        for index, note in enumerate((69, 67, 64)):
            add(bus, start, 0.30, note, 0.31, "piano", decay=6.5, delay=index * 0.14)
    else:
        raise ValueError("unknown cue: {}".format(cue.kind))


def render_sfx():
    bus = AudioBus(DURATION)
    for cue in CUES:
        render_event(bus, cue)
    return bus.render(), bus._check_voice_limit()


def decode_calm(path, temp_dir):
    afconvert = "/usr/bin/afconvert"
    if not Path(afconvert).is_file():
        raise RuntimeError("/usr/bin/afconvert is required to decode calm.m4a")
    wav_path = Path(temp_dir) / "calm.wav"
    subprocess.run([
        afconvert, str(path), str(wav_path), "-f", "WAVE", "-d", "LEI16@22050",
    ], check=True)
    pcm, rate = read_pcm16_riff(wav_path)
    if rate != SAMPLE_RATE or len(pcm) < FRAME_COUNT:
        raise RuntimeError("calm.m4a decoded to {:.3f}s, need {:.3f}s".format(len(pcm) / SAMPLE_RATE, DURATION))
    pcm = pcm[:FRAME_COUNT]
    return array("d", (value / 32768.0 for value in pcm))


def read_pcm16_riff(path):
    """Read PCM or WAVE_EXTENSIBLE PCM without a third-party decoder."""
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise RuntimeError("afconvert did not return a RIFF/WAVE file")
    offset = 12
    format_tag = channels = rate = bits = None
    audio = None
    while offset + 8 <= len(data):
        chunk, size = struct.unpack_from("<4sI", data, offset)
        payload_start = offset + 8
        payload_end = payload_start + size
        payload = data[payload_start:payload_end]
        if chunk == b"fmt ":
            if len(payload) < 16:
                raise RuntimeError("truncated WAVE fmt chunk")
            format_tag, channels, rate, _, _, bits = struct.unpack_from("<HHIIHH", payload, 0)
            if format_tag == 0xFFFE and len(payload) >= 40:
                format_tag = struct.unpack_from("<I", payload, 24)[0]
        elif chunk == b"data":
            audio = payload
        offset = payload_end + (size & 1)
    if format_tag != 1 or channels != 1 or bits != 16 or audio is None:
        raise RuntimeError("afconvert returned an unexpected PCM format")
    if len(audio) % 2:
        raise RuntimeError("truncated PCM data")
    return struct.unpack("<{}h".format(len(audio) // 2), audio), rate


def duck_ranges():
    return tuple((cue.start, cue.start + DUCK_DURATION) for cue in CUES if cue.kind in ("win", "lose"))


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
    peak = max(abs(value) for value in samples) if samples else 0.0
    if not math.isfinite(peak):
        raise ValueError("generated audio contains NaN or infinity")
    if peak >= 0.92:
        gain = 0.90 / peak
        samples = array("d", (value * gain for value in samples))
    if max(abs(value) for value in samples) >= 0.95:
        raise ValueError("generated audio exceeds the 0.95 peak ceiling")
    return samples


def pcm16(samples):
    values = array("h")
    for value in samples:
        if not math.isfinite(value):
            raise ValueError("generated audio contains NaN or infinity")
        values.append(int(round(value * 32767.0)))
    if sys.byteorder != "little":
        values.byteswap()
    return values


def write_wav(path, samples):
    pcm = pcm16(safe_samples(samples))
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


def inspect_wav(path):
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        width = source.getsampwidth()
        rate = source.getframerate()
        frames = source.getnframes()
        raw = source.readframes(frames)
    if channels != 1 or width != 2 or rate != SAMPLE_RATE or frames != FRAME_COUNT:
        raise ValueError("unexpected WAV format: {} {} {} {}".format(channels, width, rate, frames))
    pcm = struct.unpack("<{}h".format(frames), raw)
    peak = max(abs(value) for value in pcm) / 32768.0 if pcm else 0.0
    clipped = any(value <= -32768 or value >= 32767 for value in pcm)
    return frames / SAMPLE_RATE, peak, clipped


def print_report(paths, voice_peak):
    print("cue table (seconds)")
    for cue in CUES:
        print("  {:>6.2f}  {}".format(cue.start, cue.label))
    print("SFX bus: gain={:.2f}, peak voices={}/{}".format(SFX_BUS_GAIN, voice_peak, MAX_VOICES))
    for path in paths:
        duration, peak, clipped = inspect_wav(path)
        print("{}: duration={:.3f}s peak={:.6f} clipped={}".format(path, duration, peak, "yes" if clipped else "no"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    sfx, voice_peak = render_sfx()
    pure_path = args.output_dir / "sfx-preview-v1.wav"
    mixed_path = args.output_dir / "sfx-preview-mixed-v1.wav"
    write_wav(pure_path, sfx)
    if not CALM_PATH.is_file():
        raise SystemExit("missing BGM source: {}".format(CALM_PATH))
    with tempfile.TemporaryDirectory(prefix="sanxiao-sfx-preview-", dir="/tmp") as temp_dir:
        calm = decode_calm(CALM_PATH, temp_dir)
        write_wav(mixed_path, mix_with_calm(sfx, calm))
    print_report((pure_path, mixed_path), voice_peak)


if __name__ == "__main__":
    main()
