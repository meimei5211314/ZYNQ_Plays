"""Wire-contract tests: run from the repository root with unittest discovery."""

import importlib
import random
import unittest


class ProtocolTests(unittest.TestCase):
    def setUp(self):
        try:
            self.protocol = importlib.import_module("labs.reference.protocol")
        except ModuleNotFoundError:
            self.fail("Protocol implementation is missing")

    def test_modbus_reference_vector_and_empty_frame_wire_bytes(self):
        self.assertEqual(self.protocol.crc16_modbus(b"123456789"), 0x4B37)
        self.assertEqual(
            self.protocol.encode_frame(b"", 0), bytes.fromhex("a55a010000000019c0")
        )

    def test_every_split_recovers_exactly_one_frame(self):
        payload = b"Zynq\x00\xff" + bytes(range(32))
        wire = self.protocol.encode_frame(payload, 0xBEEF)
        for split in range(len(wire) + 1):
            with self.subTest(split=split):
                parser = self.protocol.FrameParser()
                got = parser.feed(wire[:split]) + parser.feed(wire[split:])
                self.assertEqual(got, [(0xBEEF, payload)])
                self.assertEqual(parser.buffered_bytes, 0)

    def test_sync_inside_payload_does_not_start_another_frame(self):
        inner = self.protocol.encode_frame(b"inner", 8)
        payload = b"prefix" + inner + b"\xa5\x5a" + b"suffix"
        wire = self.protocol.encode_frame(payload, 7)
        parser = self.protocol.FrameParser()
        self.assertEqual(parser.feed(wire[:-1]), [])
        self.assertEqual(parser.feed(wire[-1:]), [(7, payload)])
        self.assertEqual(parser.crc_errors, 0)

    def test_noise_and_split_header_preserve_sync(self):
        parser = self.protocol.FrameParser()
        wire = self.protocol.encode_frame(b"ok", 12)
        self.assertEqual(parser.feed(b"noise\xa5\xa5"), [])
        self.assertEqual(parser.feed(wire[1:]), [(12, b"ok")])

    def test_corrupt_crc_is_counted_and_following_frame_is_recovered(self):
        broken = bytearray(self.protocol.encode_frame(b"bad", 20))
        broken[-1] ^= 0x80
        parser = self.protocol.FrameParser()
        got = parser.feed(broken + self.protocol.encode_frame(b"good", 21))
        self.assertEqual(got, [(21, b"good")])
        self.assertEqual(parser.crc_errors, 1)

    def test_invalid_version_and_oversize_length_resynchronize(self):
        parser = self.protocol.FrameParser()
        invalid = bytes.fromhex("a55a0200000000 a55a0101010000")
        got = parser.feed(invalid + self.protocol.encode_frame(b"next", 22))
        self.assertEqual(got, [(22, b"next")])
        self.assertEqual(parser.version_errors, 1)
        self.assertEqual(parser.length_errors, 1)

    def test_seeded_chunking_preserves_sequence_and_maximum_payload(self):
        expected = [(i, bytes([i]) * (256 if i == 9 else i)) for i in range(20)]
        stream = b"".join(self.protocol.encode_frame(data, seq) for seq, data in expected)
        parser = self.protocol.FrameParser()
        rng = random.Random(20261021)
        got = []
        offset = 0
        while offset < len(stream):
            size = rng.randint(1, 43)
            got.extend(parser.feed(stream[offset : offset + size]))
            offset += size
            self.assertLessEqual(parser.buffered_bytes, 265)
        self.assertEqual(got, expected)

    def test_timeout_can_recover_frame_behind_an_incomplete_candidate(self):
        parser = self.protocol.FrameParser()
        incomplete = bytes.fromhex("a55a0100010000") + b"stalled"
        self.assertEqual(parser.feed(incomplete + self.protocol.encode_frame(b"ok", 4)), [])
        self.assertEqual(parser.expire_partial(), [(4, b"ok")])
        self.assertEqual(parser.partial_timeouts, 1)
        self.assertEqual(parser.buffered_bytes, 0)
        self.assertEqual(parser.expire_partial(), [])
        self.assertEqual(parser.partial_timeouts, 1)

    def test_noise_retention_is_bounded(self):
        parser = self.protocol.FrameParser()
        self.assertEqual(parser.feed(b"x" * 100_000 + b"\xa5"), [])
        self.assertEqual(parser.buffered_bytes, 1)
        self.assertEqual(parser.expire_partial(), [])
        self.assertEqual(parser.buffered_bytes, 0)

    def test_encoder_rejects_out_of_range_fields(self):
        for sequence in (-1, 65536):
            with self.subTest(sequence=sequence), self.assertRaises(ValueError):
                self.protocol.encode_frame(b"", sequence)
        with self.assertRaises(ValueError):
            self.protocol.encode_frame(b"x" * 257, 0)


if __name__ == "__main__":
    unittest.main()
