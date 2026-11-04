"""Execute the shipped YAML/Jinja with deterministic, simulated HA services.

This is deliberately not a production Home Assistant test. The interpreter
supports only the actions used here and rejects unknown constructs. Logic is
read from the actual Blueprint, not reimplemented as a second cooldown policy.
"""

from __future__ import annotations

import ast
import copy
import json
import unittest
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import yaml
from jinja2 import StrictUndefined
from jinja2.nativetypes import NativeEnvironment
from jinja2.sandbox import SandboxedEnvironment

BLUEPRINT = (
    Path(__file__).resolve().parents[1]
    / "blueprints/automation/frigate_vision/event_notification.yaml"
)
ALARM = "alarm_control_panel.test"
STAMP = "input_datetime.test_notification"
TIMER = "timer.test_notification"
MUTE = "input_boolean.test_mute"
CAMERA = "camera.test"
ALARM_STATES = (
    "disarmed",
    "armed_home",
    "armed_away",
    "armed_night",
    "armed_vacation",
    "armed_custom_bypass",
    "arming",
    "disarming",
    "pending",
    "triggered",
)


@dataclass(frozen=True)
class Input:
    name: str


class BlueprintLoader(yaml.SafeLoader):
    """Keep !input distinct from ordinary strings."""

    def construct_mapping(self, node, deep=False):
        keys = [self.construct_object(key, deep=deep) for key, _ in node.value]
        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate YAML mapping key")
        return super().construct_mapping(node, deep=deep)


BlueprintLoader.add_constructor("!input", lambda loader, node: Input(node.value))
SOURCE = yaml.load(BLUEPRINT.read_text(encoding="utf-8"), Loader=BlueprintLoader)
INPUTS = {
    name: spec
    for section in SOURCE["blueprint"]["input"].values()
    for name, spec in section["input"].items()
}


class TemplateEnvironment(SandboxedEnvironment, NativeEnvironment):
    """Native results and strict undefineds, with HA-style state functions."""


class EndRun(Exception):
    """An automation action condition stopped the run."""


class ServiceFailure(Exception):
    """A simulated service error, subject to continue_on_error."""


class BlueprintRun:
    """Small, fail-loud YAML action interpreter; never contacts HA or MQTT."""

    def __init__(self, **overrides):
        self.inputs = {
            name: copy.deepcopy(spec["default"])
            for name, spec in INPUTS.items()
            if "default" in spec
        }
        self.inputs.update(
            frigate_camera=CAMERA,
            operation_mode="active",
            cooldown_timer=TIMER,
            mute_boolean=MUTE,
            notification_actions=[{"action": "test.notify"}],
            error_actions=[{"action": "test.error"}],
            shadow_actions=[{"action": "test.shadow"}],
        )
        self.inputs.update(overrides)
        self.clock = 1_800_000_000.0
        self.states = {ALARM: "armed_home", MUTE: "off", TIMER: "idle"}
        self.attrs = {
            CAMERA: {"camera_name": "test", "friendly_name": "Test Camera"},
            TIMER: {},
        }
        self.set_stamp(self.clock - 10000)
        self.notifications = []
        self.analyses = []
        self.services = []
        self.diagnostics = []
        self.fail_services = set()
        self.noop_services = set()
        self.analysis_seconds = 0
        self.after_analysis = None
        self.result = {"response_text": "A person walks past.", "stored": True}
        self.env = TemplateEnvironment(undefined=StrictUndefined)
        self.env.globals.update(
            states=lambda entity: self.states.get(entity, "unknown"),
            state_attr=lambda entity, attr: self.attrs.get(entity, {}).get(attr),
            is_state=lambda entity, state: self.states.get(entity) == state,
            has_value=lambda entity: (
                self.states.get(entity, "unknown") not in ("unknown", "unavailable")
            ),
            now=lambda: datetime.fromtimestamp(self.clock, UTC),
            as_timestamp=lambda value: value.timestamp(),
        )
        self.config = self.resolve(SOURCE)

    def resolve(self, value):
        if isinstance(value, Input):
            return copy.deepcopy(self.inputs[value.name])
        if isinstance(value, dict):
            return {key: self.resolve(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self.resolve(item) for item in value]
        return value

    def render(self, value, variables):
        if isinstance(value, str) and ("{{" in value or "{%" in value):
            result = self.env.from_string(value).render(variables)
            # HA strips template whitespace before parsing native results;
            # NativeEnvironment alone keeps e.g. " 15" as a string.
            if isinstance(result, str):
                result = result.strip()
                try:
                    return ast.literal_eval(result)
                except (ValueError, SyntaxError):
                    return result
            return result
        if isinstance(value, dict):
            return {key: self.render(item, variables) for key, item in value.items()}
        if isinstance(value, list):
            return [self.render(item, variables) for item in value]
        return value

    def set_stamp(self, timestamp):
        self.states[STAMP] = datetime.fromtimestamp(timestamp, UTC).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        self.attrs[STAMP] = {
            "timestamp": timestamp,
            "has_date": True,
            "has_time": True,
        }

    def advance(self, seconds):
        self.clock += seconds
        end = self.attrs[TIMER].get("finishes", float("inf"))
        if self.states.get(TIMER) == "active" and self.clock >= end:
            self.states[TIMER] = "idle"

    def variables(self, values, context):
        for key, value in values.items():
            context[key] = self.render(value, context)

    def condition(self, condition, context):
        if condition["condition"] != "template":
            raise AssertionError(f"Unsupported condition: {condition}")
        value = self.render(condition["value_template"], context)
        if not isinstance(value, bool):
            raise TypeError(f"Condition is not a boolean: {value!r}")
        return value

    def conditions(self, conditions, context):
        return all(self.condition(condition, context) for condition in conditions)

    def prepare(self, event_id="test-event", age=0, **after_overrides):
        context = {
            "trigger": {
                "payload_json": {
                    "type": "new",
                    "after": {
                        "id": event_id,
                        "camera": "test",
                        "label": "person",
                        "start_time": self.clock - age,
                        **after_overrides,
                    },
                }
            }
        }
        self.variables(self.config["variables"], context)
        return context

    def run(self, context=None, **event):
        context = self.prepare(**event) if context is None else context
        if self.conditions(self.config["conditions"], context):
            try:
                self.sequence(self.config["actions"], context)
            except EndRun:
                pass
        return context

    def sequence(self, actions, context):
        for action in actions:
            try:
                self.step(action, context)
            except ServiceFailure:
                if not action.get("continue_on_error", False):
                    raise

    def step(self, action, context):
        if "variables" in action:
            self.variables(action["variables"], context)
        elif "if" in action:
            branch = "then" if self.conditions(action["if"], context) else "else"
            self.sequence(action.get(branch, []), context)
        elif "choose" in action:
            for branch in action["choose"]:
                if self.conditions(branch["conditions"], context):
                    self.sequence(branch["sequence"], context)
                    break
            else:
                self.sequence(action.get("default", []), context)
        elif "sequence" in action:
            self.sequence(action["sequence"], context)
        elif "condition" in action:
            if not self.condition(action, context):
                raise EndRun
        elif "stop" in action:
            raise EndRun
        elif "action" in action:
            self.service(self.render(action, context), context)
        else:
            raise AssertionError(f"Unsupported action: {action}")

    def service(self, action, context):
        name = action["action"]
        self.services.append(copy.deepcopy(action))
        if name in self.fail_services:
            raise ServiceFailure(name)
        if name in self.noop_services:
            return
        if name == "input_datetime.set_datetime":
            if action["target"]["entity_id"] != STAMP:
                raise AssertionError("Unexpected timestamp helper")
            self.set_stamp(action["data"]["timestamp"])
        elif name == "timer.start":
            if action["target"]["entity_id"] != TIMER:
                raise AssertionError("Unexpected timer")
            self.states[TIMER] = "active"
            self.attrs[TIMER]["finishes"] = (
                self.clock + action["data"]["duration"]["seconds"]
            )
        elif name == "test.notify":
            self.notifications.append(copy.deepcopy(context))
        elif name in ("test.error", "test.shadow"):
            self.diagnostics.append(name)
        elif name.startswith("frigate_vision.analyze_event"):
            self.analyses.append(copy.deepcopy(action))
            self.advance(self.analysis_seconds)
            if self.after_analysis:
                self.after_analysis()
            context[action["response_variable"]] = copy.deepcopy(self.result)
        else:
            raise AssertionError(f"Unsupported service: {name}")


def alarm_run(**overrides):
    return BlueprintRun(
        **{
            "alarm_cooldown_enabled": True,
            "alarm_entity": ALARM,
            "last_notification_datetime": STAMP,
            **overrides,
        }
    )


class BlueprintRuntimeTests(unittest.TestCase):
    def assert_push(self, run, expected):
        self.assertEqual(len(run.notifications), 2 if expected else 0)
        self.assertEqual(len(run.analyses), 1)
        if expected:
            first, last = run.notifications
            self.assertEqual(first["fv_phase"], "initial")
            self.assertIn(last["fv_phase"], ("analysis", "error"))
            self.assertEqual(first["fv_notification_tag"], last["fv_notification_tag"])

    def test_new_inputs_have_backward_compatible_defaults_and_typed_selectors(self):
        specs = SOURCE["blueprint"]["input"]["alarm_cooldown"]["input"]
        self.assertEqual(len(specs), 13)
        self.assertIs(specs["alarm_cooldown_enabled"]["default"], False)
        for name, spec in specs.items():
            self.assertIn("default", spec, name)
            self.assertIn("selector", spec, name)
        for state in ALARM_STATES:
            spec = specs[f"cooldown_{state}"]
            self.assertEqual(
                spec["default"],
                {"armed_home": 1800, "armed_away": 300}.get(state, -1),
            )
            self.assertEqual(spec["selector"]["number"]["min"], -1)
        self.assertEqual(
            specs["alarm_entity"]["selector"]["entity"]["domain"], "alarm_control_panel"
        )
        self.assertEqual(
            specs["last_notification_datetime"]["selector"]["entity"]["domain"],
            "input_datetime",
        )

    def test_only_mqtt_triggers_no_periodic_or_alarm_trigger(self):
        self.assertEqual(
            SOURCE["triggers"], [{"trigger": "mqtt", "topic": Input("mqtt_topic")}]
        )
        self.assertEqual(SOURCE["mode"], "queued")
        self.assertEqual(SOURCE["max"], 50)

    def test_all_state_defaults_and_standard_fallback(self):
        for state in (*ALARM_STATES, "unknown", "unavailable", "future_state"):
            with self.subTest(state=state):
                run = alarm_run(cooldown_seconds=123)
                run.states[ALARM] = state
                result = run.run()
                self.assertEqual(
                    result["fv_cooldown_seconds"],
                    {"armed_home": 1800, "armed_away": 300}.get(state, 123),
                )
                self.assert_push(run, True)

    def test_each_state_can_override_inherit_or_disable_throttling(self):
        for state in ALARM_STATES:
            for value in (-1, 0, 1, 127, 86400):
                with self.subTest(state=state, interval=value):
                    run = alarm_run(**{f"cooldown_{state}": value})
                    run.states[ALARM] = state
                    run.set_stamp(run.clock - 100000)
                    result = run.run()
                    self.assertEqual(
                        result["fv_cooldown_seconds"], 90 if value < 0 else value
                    )
                    self.assert_push(run, True)

    def test_missing_alarm_uses_standard_with_persistent_gate(self):
        for entity in ("", [], "alarm_control_panel.missing"):
            with self.subTest(entity=entity):
                run = alarm_run(alarm_entity=entity)
                run.set_stamp(run.clock - 89)
                result = run.run()
                self.assertEqual(result["fv_cooldown_seconds"], 90)
                self.assert_push(run, False)

    def test_disabled_option_ignores_alarm_and_timestamp(self):
        for state in ALARM_STATES:
            run = BlueprintRun(alarm_entity=ALARM, last_notification_datetime=STAMP)
            run.states[ALARM] = state
            run.set_stamp(run.clock + 1000)
            result = run.run()
            self.assertEqual(result["fv_cooldown_seconds"], 90)
            self.assert_push(run, True)
            self.assertFalse(
                any(s["action"].startswith("input_datetime.") for s in run.services)
            )

    def test_legacy_timer_and_zero_interval_behavior(self):
        for state in ("active", "paused", "unknown", "unavailable", "idle"):
            for interval in (0, 90):
                with self.subTest(state=state, interval=interval):
                    run = BlueprintRun(cooldown_seconds=interval)
                    run.states[TIMER] = state
                    self.assert_push_after_run(run, interval == 0 or state == "idle")
        run = BlueprintRun(cooldown_timer="")
        self.assert_push_after_run(run, False)

    def assert_push_after_run(self, run, expected):
        run.run()
        self.assert_push(run, expected)

    def test_shorter_interval_ignores_old_active_timer(self):
        run = alarm_run()
        run.run()
        run.notifications.clear()
        run.analyses.clear()
        run.advance(600)
        run.states[ALARM] = "armed_away"
        run.states[TIMER] = "active"
        self.assert_push_after_run(run, True)
        self.assertFalse(any(s["action"] == "timer.start" for s in run.services))

    def test_longer_interval_after_old_timer_expired(self):
        run = alarm_run()
        run.states[ALARM] = "armed_away"
        run.run()
        stamp = run.attrs[STAMP]["timestamp"]
        run.advance(600)
        run.states[ALARM] = "armed_home"
        run.notifications.clear()
        run.analyses.clear()
        self.assert_push_after_run(run, False)
        self.assertEqual(run.attrs[STAMP]["timestamp"], stamp)
        run.advance(1200)
        run.notifications.clear()
        run.analyses.clear()
        self.assert_push_after_run(run, True)

    def test_exact_interval_boundaries_and_clock_rollback(self):
        for elapsed, expected in (
            (-5, False),
            (0, False),
            (299.999, False),
            (300, True),
            (301, True),
        ):
            with self.subTest(elapsed=elapsed):
                run = alarm_run()
                run.states[ALARM] = "armed_away"
                run.set_stamp(run.clock - elapsed)
                self.assert_push_after_run(run, expected)

    def test_fractional_start_rounds_up_not_down(self):
        run = alarm_run()
        run.advance(0.75)
        run.run()
        self.assertEqual(run.attrs[STAMP]["timestamp"], 1_800_000_001)
        run.advance(300)
        run.states[ALARM] = "armed_away"
        run.notifications.clear()
        run.analyses.clear()
        self.assert_push_after_run(run, False)
        run.advance(0.25)
        run.notifications.clear()
        run.analyses.clear()
        self.assert_push_after_run(run, True)

    def test_zero_interval_still_stamps_and_then_positive_interval_applies(self):
        run = alarm_run(cooldown_triggered=0)
        run.states[ALARM] = "triggered"
        run.run()
        run.run(event_id="second")
        self.assertEqual(len(run.notifications), 4)
        self.assertEqual(run.attrs[STAMP]["timestamp"], run.clock)
        run.states[ALARM] = "armed_away"
        run.notifications.clear()
        run.analyses.clear()
        self.assert_push_after_run(run, False)

    def test_mute_and_shadow_never_write_or_push_but_analyze(self):
        for overrides, muted in (({}, True), ({"operation_mode": "shadow"}, False)):
            run = alarm_run(**overrides)
            run.states[MUTE] = "on" if muted else "off"
            before = run.attrs[STAMP]["timestamp"]
            self.assert_push_after_run(run, False)
            self.assertEqual(run.attrs[STAMP]["timestamp"], before)
            self.assertFalse(
                any(s["action"] == "input_datetime.set_datetime" for s in run.services)
            )
            self.assertEqual(run.analyses[0]["data"]["store"], muted)

    def test_invalid_timestamp_helper_fails_closed_including_interval_zero(self):
        for interval in (0, 300):
            for mutation in (
                "missing",
                "unknown",
                "unavailable",
                "time_only",
                "date_only",
                "no_timestamp",
                "invalid_timestamp",
                "negative_timestamp",
            ):
                with self.subTest(interval=interval, mutation=mutation):
                    run = alarm_run(cooldown_armed_home=interval)
                    if mutation == "missing":
                        del run.states[STAMP]
                    elif mutation in ("unknown", "unavailable"):
                        run.states[STAMP] = mutation
                    elif mutation == "time_only":
                        run.attrs[STAMP]["has_date"] = False
                    elif mutation == "date_only":
                        run.attrs[STAMP]["has_time"] = False
                    elif mutation == "no_timestamp":
                        del run.attrs[STAMP]["timestamp"]
                    elif mutation == "invalid_timestamp":
                        run.attrs[STAMP]["timestamp"] = "broken"
                    else:
                        run.attrs[STAMP]["timestamp"] = -1
                    self.assert_push_after_run(run, False)
        for helper in ("", [], "input_datetime.missing"):
            self.assert_push_after_run(
                alarm_run(last_notification_datetime=helper), False
            )

    def test_service_errors_or_unconfirmed_writes_suppress_only_pushes(self):
        for factory, service in (
            (alarm_run, "input_datetime.set_datetime"),
            (BlueprintRun, "timer.start"),
        ):
            for failure in ("fail_services", "noop_services"):
                with self.subTest(service=service, failure=failure):
                    run = factory()
                    getattr(run, failure).add(service)
                    self.assert_push_after_run(run, False)

    def test_timestamp_readback_must_match_exactly(self):
        run = alarm_run()
        original = run.set_stamp
        run.set_stamp = lambda ts: original(ts - 1)
        self.assert_push_after_run(run, False)

    def test_restored_helper_is_sufficient_without_timer_or_runtime_cache(self):
        first = alarm_run()
        first.run()
        restored_states = json.loads(json.dumps(first.states))
        restored_attrs = json.loads(json.dumps(first.attrs))
        for elapsed, state, expected in (
            (600, "armed_home", False),
            (600, "armed_away", True),
            (1800, "armed_home", True),
        ):
            with self.subTest(elapsed=elapsed, state=state):
                restarted = alarm_run()
                restarted.states = copy.deepcopy(restored_states)
                restarted.attrs = copy.deepcopy(restored_attrs)
                restarted.advance(elapsed)
                restarted.states[ALARM] = state
                restarted.states[TIMER] = "unavailable"
                self.assert_push_after_run(restarted, expected)

    def test_queue_evaluates_live_alarm_mute_timestamp_and_age(self):
        run = alarm_run()
        waiting = run.prepare(event_id="waiting")
        self.assertNotIn("fv_alarm_state", waiting)
        self.assertNotIn("fv_last_notification_ts", waiting)
        run.advance(100)
        run.states[ALARM] = "armed_away"
        result = run.run(waiting)
        self.assertEqual(result["fv_cooldown_seconds"], 300)
        self.assert_push(run, True)
        run = alarm_run()
        waiting = run.prepare()
        run.states[MUTE] = "on"
        run.run(waiting)
        self.assert_push(run, False)
        run = alarm_run()
        waiting = run.prepare()
        run.set_stamp(run.clock)
        run.run(waiting)
        self.assert_push(run, False)
        run = alarm_run()
        waiting = run.prepare()
        run.advance(301)
        run.states[ALARM] = "armed_away"
        run.run(waiting)
        self.assert_push(run, False)

    def test_two_prepared_events_share_only_one_notification_slot(self):
        run = alarm_run()
        first, second = run.prepare("first"), run.prepare("second")
        run.run(first)
        run.run(second)
        self.assertEqual(len(run.notifications), 2)
        self.assertEqual(len(run.analyses), 2)
        self.assertEqual(run.notifications[0]["fv_event_id"], "first")

    def test_stale_event_boundary_uses_selected_interval(self):
        for age, expected in ((300, True), (301, False)):
            run = alarm_run()
            run.states[ALARM] = "armed_away"
            run.run(age=age)
            self.assert_push(run, expected)
        run = alarm_run(cooldown_armed_away=0)
        run.states[ALARM] = "armed_away"
        run.run(age=10000)
        self.assert_push(run, True)  # Existing zero-cooldown behavior.

    def test_final_update_keeps_slot_and_does_not_stamp_again(self):
        run = alarm_run(analysis_media_type="video")
        run.analysis_seconds = 120
        run.after_analysis = lambda: run.states.update(
            {ALARM: "armed_away", MUTE: "on"}
        )
        started = run.clock
        self.assert_push_after_run(run, True)
        self.assertEqual(run.attrs[STAMP]["timestamp"], started)
        self.assertEqual(
            run.analyses[0]["action"], "frigate_vision.analyze_event_video"
        )
        self.assertEqual(
            sum(s["action"] == "input_datetime.set_datetime" for s in run.services), 1
        )
        self.assertTrue(
            run.notifications[0]["fv_snapshot_url"].endswith("thumbnail.jpg")
        )
        self.assertTrue(
            run.notifications[1]["fv_snapshot_url"].endswith("snapshot.jpg")
        )

    def test_analysis_failure_updates_only_owned_notification_then_diagnostics(self):
        for mode in ("active", "shadow"):
            for muted in (False, True):
                run = alarm_run(operation_mode=mode)
                run.states[MUTE] = "on" if muted else "off"
                run.result = {}
                run.run()
                expected = mode == "active" and not muted
                self.assert_push(run, expected)
                self.assertEqual(run.diagnostics, ["test.error"])
                if expected:
                    self.assertEqual(run.notifications[-1]["fv_phase"], "error")

    def test_notification_failure_does_not_stop_analysis_or_reopen_slot(self):
        run = alarm_run()
        run.fail_services.add("test.notify")
        # The initial action is guarded; a final user-action error may still
        # end the run, but the analysis and timestamp have already completed.
        with self.assertRaises(ServiceFailure):
            run.run()
        self.assertEqual(len(run.analyses), 1)
        self.assertEqual(run.attrs[STAMP]["timestamp"], run.clock)
        run.fail_services.clear()
        run.run(event_id="next")
        self.assertEqual(len(run.notifications), 0)
        self.assertEqual(len(run.analyses), 2)

    def test_filtered_events_never_stamp_analyze_or_notify(self):
        for after in (
            {"camera": "another"},
            {"label": "unknown"},
            {"false_positive": True},
            {"id": ""},
        ):
            run = alarm_run()
            before = run.attrs[STAMP]["timestamp"]
            run.run(run.prepare(**after))
            self.assertEqual(run.services, [])
            self.assertEqual(run.attrs[STAMP]["timestamp"], before)


if __name__ == "__main__":
    unittest.main()
