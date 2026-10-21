"""End-to-end fault injection must be visible in the JSON acceptance report."""

import importlib
import json
import subprocess
import sys
import unittest
from pathlib import Path


class CapstoneTests(unittest.TestCase):
    def setUp(self):
        try:
            self.capstone = importlib.import_module("labs.reference.capstone")
        except ModuleNotFoundError:
            self.fail("Capstone implementation is missing")

    def test_corruption_is_detected_without_losing_following_frames(self):
        report = self.capstone.run(seed=20261021)
        self.assertEqual(report["generated_frames"], 100)
        self.assertEqual(report["valid_frames"], 99)
        self.assertEqual(report["crc_errors"], 1)
        self.assertEqual(report["sequence_gap_events"], 1)
        self.assertEqual(report["missing_sequences"], 1)
        self.assertEqual(report["first_sequence"], 0)
        self.assertEqual(report["last_sequence"], 99)
        self.assertEqual(report["q15_checksum"], -4200)
        self.assertEqual(report["checkpoint"], {"generation": 1, "last_sequence": 99})

    def test_chunk_boundaries_do_not_change_acceptance_results(self):
        reference = self.capstone.run(seed=0)
        for seed in (1, 42, 65535):
            with self.subTest(seed=seed):
                report = self.capstone.run(seed=seed)
                self.assertEqual(
                    {key: value for key, value in report.items() if key != "seed"},
                    {key: value for key, value in reference.items() if key != "seed"},
                )

    def test_module_command_prints_one_json_report(self):
        result = subprocess.run(
            [sys.executable, "-m", "labs.reference.capstone", "--seed", "42"],
            cwd=Path(__file__).resolve().parents[2],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(result.stderr, "")
        report = json.loads(result.stdout)
        self.assertEqual(report["seed"], 42)
        self.assertEqual(report["valid_frames"], 99)


if __name__ == "__main__":
    unittest.main()
