"""Exhaust byte-level interruption points; do not model a physical NOR flash."""

import importlib
import unittest


class JournalTests(unittest.TestCase):
    def setUp(self):
        try:
            self.journal = importlib.import_module("labs.reference.journal")
        except ModuleNotFoundError:
            self.fail("Journal implementation is missing")

    def test_empty_media_and_committed_generations(self):
        journal = self.journal.TwoSlotJournal(max_payload=16)
        self.assertIsNone(journal.recover())
        self.assertTrue(journal.write(b"first"))
        self.assertEqual(journal.recover(), (1, b"first"))
        self.assertTrue(journal.write(b"second"))
        self.assertEqual(journal.recover(), (2, b"second"))

    def test_every_power_cut_preserves_old_record_until_final_commit(self):
        baseline = self.journal.TwoSlotJournal(max_payload=16)
        baseline.write(b"older")
        baseline.write(b"old")
        image = baseline.export_slots()
        for cut in range(baseline.write_operations + 1):
            with self.subTest(cut_after=cut):
                trial = self.journal.TwoSlotJournal.from_slots(image, max_payload=16)
                complete = trial.write(b"new", cut_after=cut)
                recovered = self.journal.TwoSlotJournal.from_slots(
                    trial.export_slots(), max_payload=16
                ).recover()
                expected = (3, b"new") if cut == baseline.write_operations else (2, b"old")
                self.assertEqual(recovered, expected)
                self.assertEqual(complete, cut == baseline.write_operations)
                self.assertEqual(trial.export_slots()[1], image[1])

    def test_first_write_cutpoints_never_produce_a_torn_record(self):
        blank = self.journal.TwoSlotJournal(max_payload=4)
        for cut in range(blank.write_operations + 1):
            with self.subTest(cut_after=cut):
                trial = self.journal.TwoSlotJournal(max_payload=4)
                trial.write(b"full", cut_after=cut)
                expected = (1, b"full") if cut == blank.write_operations else None
                self.assertEqual(trial.recover(), expected)

    def test_corrupt_latest_crc_falls_back_to_previous_generation(self):
        journal = self.journal.TwoSlotJournal(max_payload=16)
        journal.write(b"old")
        journal.write(b"new")
        slots = [bytearray(slot) for slot in journal.export_slots()]
        slots[1][6] ^= 1
        restored = self.journal.TwoSlotJournal.from_slots(slots, max_payload=16)
        self.assertEqual(restored.recover(), (1, b"old"))

    def test_missing_commit_rejects_otherwise_complete_new_slot(self):
        journal = self.journal.TwoSlotJournal(max_payload=8)
        journal.write(b"old")
        journal.write(b"new", cut_after=journal.write_operations - 1)
        self.assertEqual(journal.recover(), (1, b"old"))

    def test_payload_and_image_limits_are_enforced(self):
        journal = self.journal.TwoSlotJournal(max_payload=4)
        with self.assertRaises(ValueError):
            journal.write(b"large")
        with self.assertRaises(ValueError):
            journal.write(b"ok", cut_after=-1)
        with self.assertRaises(ValueError):
            self.journal.TwoSlotJournal.from_slots((b"", b""), max_payload=4)
        with self.assertRaises(ValueError):
            self.journal.TwoSlotJournal(max_payload=0)


if __name__ == "__main__":
    unittest.main()
