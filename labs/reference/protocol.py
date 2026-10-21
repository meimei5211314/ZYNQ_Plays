"""Bounded incremental parser for the course's byte-oriented UART protocol.

Wire: A5 5A | version:u8=1 | length:u16LE | seq:u16LE | payload | CRC:u16LE.
CRC-16/Modbus covers version through payload, inclusive. Payload <= 256 bytes.
"""

import struct

MAGIC = b"\xa5\x5a"
VERSION = 1
MAX_PAYLOAD = 256
MAX_FRAME_SIZE = 9 + MAX_PAYLOAD


def crc16_modbus(data: bytes) -> int:
    """Reflected polynomial 0xA001, initial 0xFFFF, no final XOR."""
    crc = 0xFFFF
    for value in data:
        crc ^= value
        for _ in range(8):
            crc = (crc >> 1) ^ (0xA001 if crc & 1 else 0)
    return crc


def encode_frame(payload: bytes, seq: int) -> bytes:
    """Encode one frame, including a little-endian CRC."""
    if not isinstance(payload, (bytes, bytearray, memoryview)):
        raise TypeError("payload must be bytes-like")
    payload = bytes(payload)
    if len(payload) > MAX_PAYLOAD:
        raise ValueError("payload exceeds 256 bytes")
    if not isinstance(seq, int):
        raise TypeError("seq must be an integer")
    if not 0 <= seq <= 0xFFFF:
        raise ValueError("seq must fit unsigned 16 bits")
    body = struct.pack("<BHH", VERSION, len(payload), seq) + payload
    return MAGIC + body + struct.pack("<H", crc16_modbus(body))


class FrameParser:
    """Feed arbitrary byte chunks and receive ``(sequence, payload)`` tuples.

    At most MAX_FRAME_SIZE bytes are retained, even for a very large feed.
    An incomplete plausible frame owns its payload bytes: embedded magic is
    not evidence that it ended. The caller must apply a transport timeout and
    call expire_partial() to abandon that candidate. Neither time nor UART
    driver policy is hidden in this parser.
    """

    def __init__(self):
        self._buffer = bytearray()
        self.crc_errors = 0
        self.version_errors = 0
        self.length_errors = 0
        self.partial_timeouts = 0

    @property
    def buffered_bytes(self) -> int:
        return len(self._buffer)

    def feed(self, chunk: bytes) -> list[tuple[int, bytes]]:
        """Consume a chunk. A byte-wise pump bounds internal retained memory."""
        if not isinstance(chunk, (bytes, bytearray, memoryview)):
            raise TypeError("chunk must be bytes-like")
        frames = []
        for value in bytes(chunk):
            self._buffer.append(value)
            frames.extend(self._drain())
        return frames

    def expire_partial(self) -> list[tuple[int, bytes]]:
        """Abandon one stalled candidate and rescan buffered bytes.

        Returns any complete frames recovered behind it. A later incomplete
        candidate requires its own timeout. Calling this on an empty parser
        has no effect. Timeout duration is the caller's responsibility.
        """
        if not self._buffer:
            return []
        self.partial_timeouts += 1
        del self._buffer[0]
        return self._drain()

    def _drain(self) -> list[tuple[int, bytes]]:
        frames = []
        while self._buffer:
            start = self._buffer.find(MAGIC)
            if start < 0:
                # The final A5 can be the first byte of a split header.
                keep = self._buffer[-1] == MAGIC[0]
                self._buffer[:] = MAGIC[:1] if keep else b""
                break
            if start:
                del self._buffer[:start]
            if len(self._buffer) < 3:
                break
            if self._buffer[2] != VERSION:
                self.version_errors += 1
                del self._buffer[0]
                continue
            if len(self._buffer) < 5:
                break
            length = int.from_bytes(self._buffer[3:5], "little")
            if length > MAX_PAYLOAD:
                self.length_errors += 1
                del self._buffer[0]
                continue
            total = 9 + length
            if len(self._buffer) < total:
                break
            body = self._buffer[2 : total - 2]
            received_crc = int.from_bytes(self._buffer[total - 2 : total], "little")
            if crc16_modbus(body) != received_crc:
                self.crc_errors += 1
                # Advancing one byte also permits recovery after a bad length.
                del self._buffer[0]
                continue
            seq = int.from_bytes(self._buffer[5:7], "little")
            frames.append((seq, bytes(self._buffer[7 : total - 2])))
            del self._buffer[:total]
        return frames
