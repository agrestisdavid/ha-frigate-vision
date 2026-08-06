"""Source-contract tests for the notification blueprint."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT = (
    ROOT / "blueprints" / "automation" / "frigate_vision" / "event_notification.yaml"
)


class BlueprintContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = BLUEPRINT.read_text(encoding="utf-8")

    def test_events_are_processed_sequentially(self) -> None:
        self.assertIn("mode: queued", self.source)
        self.assertIn("max: 50", self.source)
        self.assertIn("max_exceeded: warning", self.source)
        self.assertNotIn("mode: single", self.source)

    def test_analysis_is_not_gated_by_mute_or_cooldown(self) -> None:
        analysis_pos = self.source.index("- action: frigate_vision.analyze_event")
        self.assertGreater(analysis_pos, self.source.index("fv_notification_slot"))
        self.assertNotIn(
            "fv_mute_boolean | length == 0\n         or not is_state",
            self.source,
        )
        self.assertNotIn(
            "fv_cooldown_timer | length == 0\n         or is_state",
            self.source,
        )
        self.assertNotIn("- delay:", self.source)

    def test_notification_slot_controls_both_push_phases(self) -> None:
        self.assertGreaterEqual(self.source.count("fv_notification_slot"), 3)
        self.assertIn(
            "fv_notification_candidate and fv_cooldown_seconds > 0",
            self.source,
        )
        self.assertIn("and fv_notification_slot", self.source)
        self.assertIn("fv_notification_is_stale", self.source)

    def test_notification_state_is_evaluated_when_queued_run_starts(self) -> None:
        action_variables = self.source.index(
            "# These values must be rendered only after this queued run starts."
        )
        conditions = self.source.index("\nactions:\n")
        analysis = self.source.index("- action: frigate_vision.analyze_event")
        self.assertGreater(action_variables, conditions)
        self.assertLess(action_variables, analysis)
        self.assertIn("continue_on_error: true\n        target:", self.source)
        self.assertIn(
            "sequence: !input notification_actions\n    continue_on_error: true",
            self.source,
        )

    def test_generic_title_and_known_label_translations(self) -> None:
        self.assertIn(
            "{{ fv_label_display ~ ' in ' ~ fv_camera_name ~ ' wurde erkannt' }}",
            self.source,
        )
        for mapping in (
            "person: Person",
            "dog: Hund",
            "cat: Katze",
            "car: Auto",
            "bicycle: Fahrrad",
            "motorcycle: Motorrad",
            "truck: LKW",
            "package: Paket",
        ):
            with self.subTest(mapping=mapping):
                self.assertIn(mapping, self.source)
        self.assertNotIn("fv_camera_name ~ ': ' ~ fv_label_display", self.source)

    def test_only_new_events_pass_the_filter(self) -> None:
        self.assertIn("fv_event_type == 'new'", self.source)
        self.assertIn("fv_camera == fv_camera_key", self.source)
        self.assertIn("fv_label in fv_allowed_labels", self.source)
        self.assertIn(
            "not fv_ignore_false_positives or not fv_false_positive",
            self.source,
        )


if __name__ == "__main__":
    unittest.main()
