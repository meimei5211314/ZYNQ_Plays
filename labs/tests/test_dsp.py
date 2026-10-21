"""Literal arithmetic vectors catch sign, rounding, and saturation errors."""

import importlib
import unittest


class DspTests(unittest.TestCase):
    def setUp(self):
        try:
            self.dsp = importlib.import_module("labs.reference.dsp")
        except ModuleNotFoundError:
            self.fail("Q15 implementation is missing")

    def test_half_times_half(self):
        self.assertEqual(self.dsp.q15_multiply(16384, 16384), 8192)

    def test_full_precision_product_and_saturation(self):
        vectors = [
            (-32768, -32768, 32767),
            (-32768, 32767, -32767),
            (32767, 32767, 32766),
            (-32768, 16384, -16384),
            (0, -32768, 0),
        ]
        for left, right, expected in vectors:
            with self.subTest(left=left, right=right):
                self.assertEqual(self.dsp.q15_multiply(left, right), expected)

    def test_round_nearest_ties_away_from_zero(self):
        for left, right, expected in [
            (1, 16383, 0), (1, 16384, 1), (1, 16385, 1),
            (-1, 16383, 0), (-1, 16384, -1), (-1, 16385, -1),
            (3, 16384, 2), (-3, 16384, -2),
        ]:
            with self.subTest(left=left, right=right):
                self.assertEqual(self.dsp.q15_multiply(left, right), expected)

    def test_signed_inputs_are_validated_before_multiplication(self):
        for invalid in (-32769, 32768):
            with self.assertRaises(ValueError):
                self.dsp.q15_multiply(invalid, 1)
            with self.assertRaises(ValueError):
                self.dsp.q15_multiply(1, invalid)
        with self.assertRaises(TypeError):
            self.dsp.q15_multiply(0.5, 1)


if __name__ == "__main__":
    unittest.main()
