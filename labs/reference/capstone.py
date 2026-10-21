"""Deterministic host-side acceptance pipeline: UART -> Q15 -> checkpoint.

Run: python -m labs.reference.capstone [--seed 20261021]
"""

import argparse
import json
import random
import struct

from .dsp import q15_multiply
from .journal import TwoSlotJournal
from .protocol import FrameParser, encode_frame


def run(seed: int = 20261021) -> dict:
    """Inject one CRC fault into 100 sequence-coded frames and report recovery."""
    frames = []
    for seq in range(100):
        sample = seq * 200 - 10000
        wire = bytearray(encode_frame(struct.pack("<Hh", seq, sample), seq))
        if seq == 42:
            wire[-1] ^= 0x01
        frames.append(bytes(wire))
    stream = b"\x00uart-noise" + b"".join(frames)
    parser = FrameParser()
    rng = random.Random(seed)
    decoded = []
    offset = 0
    while offset < len(stream):
        size = rng.randint(1, 37)
        decoded.extend(parser.feed(stream[offset : offset + size]))
        offset += size

    expected_sequence = 0
    gap_events = 0
    missing_sequences = 0
    checksum = 0
    for seq, payload in decoded:
        encoded_seq, sample = struct.unpack("<Hh", payload)
        if encoded_seq != seq:
            raise RuntimeError("payload sequence does not match frame sequence")
        if seq != expected_sequence:
            gap_events += 1
            missing_sequences += (seq - expected_sequence) & 0xFFFF
        expected_sequence = (seq + 1) & 0xFFFF
        checksum += q15_multiply(sample, 16384)

    journal = TwoSlotJournal()
    journal.write(struct.pack("<H", decoded[-1][0]))
    rebooted = TwoSlotJournal.from_slots(journal.export_slots())
    generation, checkpoint_payload = rebooted.recover()
    return {
        "seed": seed,
        "generated_frames": 100,
        "valid_frames": len(decoded),
        "crc_errors": parser.crc_errors,
        "sequence_gap_events": gap_events,
        "missing_sequences": missing_sequences,
        "first_sequence": decoded[0][0],
        "last_sequence": decoded[-1][0],
        "q15_checksum": checksum,
        "checkpoint": {
            "generation": generation,
            "last_sequence": struct.unpack("<H", checkpoint_payload)[0],
        },
    }


def main() -> None:
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--seed", type=int, default=20261021)
    args = arguments.parse_args()
    print(json.dumps(run(args.seed), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
