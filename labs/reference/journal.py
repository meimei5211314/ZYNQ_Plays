"""Two-slot, commit-last journal with byte-level interruption simulation.

This is an algorithm model, not a NOR flash driver. Slots are independent;
each simulated byte assignment is atomic and allows arbitrary bit changes.
Real devices require erase-block separation, program/erase constraints,
barriers, cache handling, and documented power-failure guarantees.
"""

import struct
import zlib

COMMITTED = 0xA5


class TwoSlotJournal:
    """Fixed slots: generation:u32LE, length:u16LE, padded payload, CRC32, commit.

    CRC32 covers generation, length, and the entire padded payload region.
    Generation starts at one; rollover is refused rather than guessed.
    """

    def __init__(self, max_payload: int = 256):
        if not isinstance(max_payload, int) or not 1 <= max_payload <= 65535:
            raise ValueError("max_payload must be in 1..65535")
        self.max_payload = max_payload
        self.slot_size = 4 + 2 + max_payload + 4 + 1
        self._slots = [bytearray(b"\xff" * self.slot_size) for _ in range(2)]

    @property
    def write_operations(self) -> int:
        """Byte assignments per update: invalidate, body+CRC, final commit."""
        return self.slot_size + 1

    def export_slots(self) -> tuple[bytes, bytes]:
        """Immutable media image, suitable for rebooting the simulation."""
        return bytes(self._slots[0]), bytes(self._slots[1])

    @classmethod
    def from_slots(cls, slots, max_payload: int = 256):
        journal = cls(max_payload)
        if len(slots) != 2 or any(len(slot) != journal.slot_size for slot in slots):
            raise ValueError("image must contain two slots of the configured size")
        journal._slots = [bytearray(slot) for slot in slots]
        return journal

    def _valid_records(self) -> list[tuple[int, int, bytes]]:
        records = []
        for index, slot in enumerate(self._slots):
            if slot[-1] != COMMITTED:
                continue
            generation, length = struct.unpack_from("<IH", slot)
            if generation == 0 or length > self.max_payload:
                continue
            stored_crc = int.from_bytes(slot[-5:-1], "little")
            if zlib.crc32(slot[:-5]) != stored_crc:
                continue
            records.append((generation, index, bytes(slot[6 : 6 + length])))
        return records

    def recover(self) -> tuple[int, bytes] | None:
        """Return the latest valid generation and payload, or None on blank media."""
        records = self._valid_records()
        if not records:
            return None
        generation, _index, payload = max(records)
        return generation, payload

    def write(self, payload: bytes, cut_after: int | None = None) -> bool:
        """Write inactive slot; return False if power cuts before the commit.

        cut_after=N applies exactly the first N byte assignments. None (or a
        value at least write_operations) completes the update. The active slot
        is never written. Reusing a previously committed inactive slot first
        invalidates its commit byte, before changing any CRC-covered byte.
        """
        if not isinstance(payload, (bytes, bytearray, memoryview)):
            raise TypeError("payload must be bytes-like")
        payload = bytes(payload)
        if len(payload) > self.max_payload:
            raise ValueError("payload exceeds configured slot capacity")
        if cut_after is not None and (not isinstance(cut_after, int) or cut_after < 0):
            raise ValueError("cut_after must be a nonnegative integer or None")
        records = self._valid_records()
        if records:
            generation, active, _old = max(records)
            if generation == 0xFFFFFFFF:
                raise OverflowError("generation rollover requires a migration policy")
            generation += 1
            target = 1 - active
        else:
            generation, target = 1, 0
        body = struct.pack("<IH", generation, len(payload))
        body += payload + b"\xff" * (self.max_payload - len(payload))
        record = body + struct.pack("<I", zlib.crc32(body))
        operations = [(self.slot_size - 1, 0)]
        operations.extend(enumerate(record))
        operations.append((self.slot_size - 1, COMMITTED))
        allowed = len(operations) if cut_after is None else cut_after
        for step, (offset, value) in enumerate(operations):
            if step == allowed:
                return False
            self._slots[target][offset] = value
        return True
