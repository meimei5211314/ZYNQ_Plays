import unittest
from labs.reference.journal import TwoSlotJournal
from labs.reference.recovery import Controller, trial_update, run

class RecoveryTests(unittest.TestCase):
    def test_timeout_forces_safe_at_exact_boundary(self):
        c = Controller(TwoSlotJournal(max_payload=16), timeout_ticks=3)
        self.assertTrue(c.command(1, 60, now=0))
        c.tick(2)
        self.assertEqual(c.output, 60)
        c.tick(3)
        self.assertEqual((c.state, c.output), ('SAFE', 0))

    def test_reboot_stays_safe_and_rejects_replayed_command(self):
        j = TwoSlotJournal(max_payload=16)
        c = Controller(j)
        self.assertTrue(c.command(1, 60, now=0))
        rebooted = Controller(TwoSlotJournal.from_slots(j.export_slots(), max_payload=16))
        self.assertEqual((rebooted.state, rebooted.output), ('SAFE', 0))
        self.assertFalse(rebooted.command(1, 60, now=1))
        self.assertTrue(rebooted.command(2, 30, now=2))

    def test_each_failed_persistence_keeps_outputs_safe(self):
        j = TwoSlotJournal(max_payload=16)
        self.assertTrue(Controller(j).command(1, 20, now=0))
        for cut in range(j.write_operations):
            copy = TwoSlotJournal.from_slots(j.export_slots(), max_payload=16)
            c = Controller(copy)
            self.assertFalse(c.command(2, 80, now=1, cut_after=cut))
            self.assertEqual((c.state, c.output), ('SAFE', 0))
            self.assertEqual(Controller(copy).last_sequence, 1)

    def test_signed_old_and_unhealthy_candidates_are_not_confirmed(self):
        self.assertEqual(trial_update(verified=False)['active'], 'A')
        self.assertEqual(trial_update(version=2, floor=3)['active'], 'A')
        bad = trial_update(healthy=False)
        self.assertEqual((bad['active'], bad['floor'], bad['attempts']), ('A', 3, 3))
        good = trial_update(healthy=True)
        self.assertEqual((good['active'], good['floor']), ('B', 4))

    def test_storage_exception_from_running_controller_leaves_safe_output(self):
        class FailingJournal(TwoSlotJournal):
            fail = False
            def write(self, *args, **kwargs):
                if self.fail:
                    raise OSError('injected storage error')
                return super().write(*args, **kwargs)
        j = FailingJournal(max_payload=16)
        c = Controller(j)
        self.assertTrue(c.command(1, 60, now=0))
        j.fail = True
        with self.assertRaises(OSError):
            c.command(2, 80, now=1)
        self.assertEqual((c.state, c.output), ('SAFE', 0))

    def test_capstone_has_deterministic_recovery_evidence(self):
        result = run()
        self.assertTrue(result['timeout_safe'])
        self.assertTrue(result['reboot_safe'])
        self.assertTrue(result['replay_rejected'])
        self.assertTrue(result['persistence_failure_safe'])
        self.assertEqual(result['unhealthy_update']['active'], 'A')
        self.assertEqual(result['healthy_update']['active'], 'B')

if __name__ == '__main__':
    unittest.main()
