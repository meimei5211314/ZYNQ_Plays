"""Deterministic control/recovery exercise; no device IO or cryptography.

Ticks are injected monotonic integers. SAFE=0 is this exercise's defined output,
not a universal safe actuator setting. Restart never reapplies the saved setpoint.
"""
import json
import struct
from .journal import TwoSlotJournal


class Controller:
    def __init__(self, journal, timeout_ticks=3):
        if timeout_ticks < 1:
            raise ValueError('timeout must be positive')
        self.journal = journal
        self.timeout_ticks = timeout_ticks
        self.last_sequence = -1
        self.last_command_tick = None
        self.last_tick = -1
        self.state, self.output = 'SAFE', 0
        saved = journal.recover()
        if saved and len(saved[1]) == 6:
            self.last_sequence, _ = struct.unpack('<Ih', saved[1])

    def tick(self, now):
        if not isinstance(now, int) or now < 0 or now < self.last_tick:
            raise ValueError('ticks must be nonnegative and monotonic')
        self.last_tick = now
        if self.last_command_tick is not None and now - self.last_command_tick >= self.timeout_ticks:
            self.state, self.output = 'SAFE', 0

    def command(self, sequence, setpoint, now, cut_after=None):
        self.tick(now)
        if not isinstance(sequence, int) or not 0 <= sequence <= 0xFFFFFFFF:
            return False
        if sequence <= self.last_sequence or not isinstance(setpoint, int) or not -100 <= setpoint <= 100:
            return False
        # Persist the replay barrier before exposing a new output. Failure is safe.
        # Clear output first, including when the adapter raises (IO/generation error).
        self.state, self.output = 'SAFE', 0
        if not self.journal.write(struct.pack('<Ih', sequence, setpoint), cut_after=cut_after):
            self.state, self.output = 'SAFE', 0
            return False
        self.last_sequence, self.last_command_tick = sequence, now
        self.state, self.output = 'RUN', setpoint
        return True


def trial_update(verified=True, version=4, floor=3, healthy=True, tries=3):
    """verified is the result of an external trusted verifier, not a signature."""
    if tries < 1:
        raise ValueError('at least one trial required')
    events = ['A running; control output SAFE during maintenance']
    if not verified or version < floor:
        events.append('reject candidate before trial')
        return dict(active='A', floor=floor, attempts=0, confirmed=False, events=events)
    events.append('inactive B written, read back and externally verified')
    for attempt in range(1, tries + 1):
        events.append('B trial %d; %s' % (attempt, 'healthy' if healthy else 'watchdog/health failure'))
        if healthy:
            events.append('confirm B, then persist version policy')
            return dict(active='B', floor=version, attempts=attempt, confirmed=True, events=events)
    events.append('restore A; keep prior version floor')
    return dict(active='A', floor=floor, attempts=tries, confirmed=False, events=events)


def run():
    j = TwoSlotJournal(max_payload=16)
    c = Controller(j)
    if not c.command(1, 60, now=0):
        raise RuntimeError('initial command failed')
    c.tick(3)
    timeout_safe = (c.state, c.output) == ('SAFE', 0)
    restored = TwoSlotJournal.from_slots(j.export_slots(), max_payload=16)
    rebooted = Controller(restored)
    reboot_safe = (rebooted.state, rebooted.output) == ('SAFE', 0)
    replay_rejected = not rebooted.command(1, 60, now=4)
    if not rebooted.command(2, 30, now=5):
        raise RuntimeError('fresh post-reboot command failed')
    failed = not rebooted.command(3, 80, now=6, cut_after=4)
    return dict(timeout_safe=timeout_safe, reboot_safe=reboot_safe,
                replay_rejected=replay_rejected,
                persistence_failure_safe=failed and rebooted.output == 0,
                recovered_sequence=Controller(restored).last_sequence,
                unhealthy_update=trial_update(healthy=False),
                healthy_update=trial_update(healthy=True),
                boundary='Host state machine; no real-time, hardware safety or cryptographic proof')


if __name__ == '__main__':
    print(json.dumps(run(), indent=2, ensure_ascii=False))
