// SPDX-License-Identifier: MIT OR Apache-2.0

//! High-level FPL macro library for common patterns.
//!
//! Macros lower to standard IR via existing focus-lang helpers.
//! No new IR types; each macro expands to one or more rule/schedule/enforcement primitives.

#[cfg(test)]
mod tests;

/// Starlark macro library source code.
/// These are helper functions that expand common patterns into standard rule() calls.
pub const MACRO_LIBRARY: &str = r#"
# FPL Macro Library — Common Patterns

# reward(event, credits=10, streak=1)
# Emits a Rule that grants credits and optionally increments a streak on the event.
def reward(event, credits=10, streak=1):
    """Grant credits and track streak on an event."""
    rule_id = "macro_reward_" + event.replace(":", "_")
    actions = [grant_credit(credits)]
    if streak:
        streak_id = event.replace(":", "_") + "_streak"
        actions.append(streak_increment(streak_id))

    return rule(
        id=rule_id,
        name="Reward: " + event,
        trigger=on_event(event),
        conditions=[],
        actions=actions,
        priority=50,
        explanation_template="You earned {amount} credits for {event}.",
        enabled=1
    )

# penalize(event, credits=5)
# Emits a Rule that deducts credits on the event.
def penalize(event, credits=5):
    """Deduct credits as a penalty."""
    rule_id = "macro_penalize_" + event.replace(":", "_")
    return rule(
        id=rule_id,
        name="Penalize: " + event,
        trigger=on_event(event),
        conditions=[],
        actions=[deduct_credit(credits)],
        priority=40,
        explanation_template="Penalty: -{amount} credits for {event}.",
        enabled=1
    )

# remind(every, message, at="UTC")
# Emits a Schedule and rule that triggers a Notify action at a cron interval.
def remind(every, message, at="UTC"):
    """Scheduled reminder with cron trigger."""
    cron_str = every  # e.g., "0 9 * * MON" for 9am Mondays
    tz = at

    rule_id = "macro_remind_" + cron_str.replace(" ", "_").replace("*", "x")

    # Emit the schedule trigger rule
    return rule(
        id=rule_id,
        name="Reminder: " + message,
        trigger=on_schedule(cron_str, tz),
        conditions=[],
        actions=[notify(message)],
        priority=30,
        explanation_template=message,
        enabled=1
    )

# celebrate(event, message, sound="confetti")
# Emits a Rule that triggers a Notify + optional MascotScene with sound cue.
def celebrate(event, message, sound="confetti"):
    """Celebratory notification with mascot scene and sound."""
    rule_id = "macro_celebrate_" + event.replace(":", "_")

    # For now, emit just the notify action.
    # (Full mascot + sound integration can extend this in future versions)
    return rule(
        id=rule_id,
        name="Celebrate: " + event,
        trigger=on_event(event),
        conditions=[],
        actions=[notify(message)],
        priority=60,
        explanation_template=message,
        enabled=1
    )

# block(apps, profile)
# Emits an EnforcementPolicy rule that blocks apps.
# apps should be a list: ["Instagram", "TikTok"]
def block(apps, profile):
    """Block apps in a named profile."""
    return enforcement(
        profile=profile,
        targets=apps,
        rigidity="hard"
    )

# unlock_after(condition, duration_hours)
# Emits a ScheduledUnlockWindow rule: block until a condition is met or timeout occurs.
def unlock_after(condition, duration_hours):
    """Conditional unlock with timeout fallback."""
    rule_id = "macro_unlock_" + condition.replace(":", "_")
    duration_seconds = duration_hours * 3600

    return rule(
        id=rule_id,
        name="Unlock when: " + condition,
        trigger=on_state_change(condition),
        conditions=[],
        actions=[unblock("social")],
        duration_seconds=duration_seconds,
        priority=70,
        explanation_template="Unlocked on condition: {condition}",
        enabled=1
    )

# track_streak(event, name)
# Emits a Rule that increments a named streak on an event.
def track_streak(event, name):
    """Track a named streak."""
    rule_id = "macro_streak_" + name.replace(" ", "_").lower()
    streak_id = name.replace(" ", "_").lower()

    return rule(
        id=rule_id,
        name="Streak: " + name,
        trigger=on_event(event),
        conditions=[],
        actions=[
            notify("Streak continued: " + name),
            streak_increment(streak_id),
        ],
        priority=55,
        explanation_template="Streak: {streak_name} — {count} in a row!",
        enabled=1
    )

# if_pattern(pattern_name, conditions_list)
# Contextual match block: returns a wrapped condition set for a named pattern.
def if_pattern(pattern_name, conditions_list=[]):
    """Named pattern matcher (e.g., 'weekday', 'evening', 'work_hours')."""
    # Use conditions_list as-is if provided, otherwise return pattern lookup

    patterns = {
        "weekday": [
            # Placeholder; would match Mon-Fri
            payload_exists("day_of_week")
        ],
        "evening": [
            # Placeholder; would match after 5pm
            payload_exists("hour_of_day")
        ],
        "work_hours": [
            # Placeholder; would match 9am-5pm
            payload_exists("hour_of_day")
        ],
    }

    if pattern_name in patterns:
        return patterns[pattern_name]

    return conditions_list
"#;
