// SPDX-License-Identifier: MIT OR Apache-2.0
// Comprehensive entitlements test suite
// These tests ensure every tier × feature combination is properly enforced

#[cfg(test)]
mod tier_matrix_tests {
    use crate::*;
    use chrono::Utc;

    /// Test matrix: every feature × every tier
    #[test]
    fn test_feature_matrix_all_combinations() {
        let free = Entitlement::free();
        let exp = Utc::now() + chrono::Duration::days(30);
        let plus = Entitlement::with_tier(Tier::Plus, exp, "sig".to_string());
        let pro = Entitlement::with_tier(Tier::Pro, exp, "sig".to_string());
        let family = Entitlement::with_tier(Tier::Family, exp, "sig".to_string());

        // Rules
        assert!(can_add_rule(3, &free).is_err()); // FR-E-001
        assert!(can_add_rule(3, &plus).is_ok());
        assert!(can_add_rule(3, &pro).is_ok());
        assert!(can_add_rule(3, &family).is_ok());

        // Tasks
        assert!(can_add_task(3, &free).is_err()); // FR-E-002
        assert!(can_add_task(3, &plus).is_ok());
        assert!(can_add_task(3, &pro).is_ok());
        assert!(can_add_task(3, &family).is_ok());

        // Connector cadence
        assert_eq!(connector_refresh_cadence_minutes(&free), 240); // FR-E-003
        assert_eq!(connector_refresh_cadence_minutes(&plus), 15);
        assert_eq!(connector_refresh_cadence_minutes(&pro), 15);
        assert_eq!(connector_refresh_cadence_minutes(&family), 15);

        // Max connectors
        assert_eq!(max_active_connectors(&free), 1); // FR-E-004
        assert_eq!(max_active_connectors(&plus), 4);
        assert_eq!(max_active_connectors(&pro), 4);
        assert_eq!(max_active_connectors(&family), 4);

        // Voice
        assert_eq!(voice_provider(&free), VoiceProvider::Silent); // FR-E-007
        assert_eq!(voice_provider(&plus), VoiceProvider::Native);
        assert_eq!(voice_provider(&pro), VoiceProvider::ElevenLabs);
        assert_eq!(voice_provider(&family), VoiceProvider::ElevenLabs);

        // Live Activity
        assert!(!can_use_live_activity(&free)); // FR-E-008
        assert!(can_use_live_activity(&plus));
        assert!(can_use_live_activity(&pro));
        assert!(can_use_live_activity(&family));

        // HomeKit Widget
        assert!(!can_use_homekit_widget(&free)); // FR-E-009
        assert!(can_use_homekit_widget(&plus));
        assert!(can_use_homekit_widget(&pro));
        assert!(can_use_homekit_widget(&family));

        // Audit retention
        assert_eq!(audit_retention_days(&free), 7); // FR-E-010
        assert_eq!(audit_retention_days(&plus), 90);
        assert_eq!(audit_retention_days(&pro), 180);
        assert_eq!(audit_retention_days(&family), 365);

        // CloudKit sync
        assert!(!can_use_cloudkit_sync(&free)); // FR-E-011
        assert!(can_use_cloudkit_sync(&plus));
        assert!(can_use_cloudkit_sync(&pro));
        assert!(can_use_cloudkit_sync(&family));

        // Nudge limit
        assert_eq!(nudge_limit_per_day(&free), 0); // FR-E-012
        assert_eq!(nudge_limit_per_day(&plus), 3);
        assert_eq!(nudge_limit_per_day(&pro), u32::MAX);
        assert_eq!(nudge_limit_per_day(&family), u32::MAX);

        // Proactive nudges
        assert!(!has_proactive_nudges(&free)); // FR-E-013
        assert!(!has_proactive_nudges(&plus));
        assert!(has_proactive_nudges(&pro));
        assert!(has_proactive_nudges(&family));

        // Custom cosmetics
        assert!(!can_customize_coachy(&free)); // FR-E-014
        assert!(!can_customize_coachy(&plus));
        assert!(can_customize_coachy(&pro));
        assert!(can_customize_coachy(&family));

        // Template marketplace
        assert!(!has_template_marketplace(&free)); // FR-E-015
        assert!(!has_template_marketplace(&plus));
        assert!(has_template_marketplace(&pro));
        assert!(has_template_marketplace(&family));

        // Analytics
        assert_eq!(analytics_tier(&free), AnalyticsTier::None); // FR-E-016
        assert_eq!(analytics_tier(&plus), AnalyticsTier::Basic);
        assert_eq!(analytics_tier(&pro), AnalyticsTier::Advanced);
        assert_eq!(analytics_tier(&family), AnalyticsTier::Advanced);

        // Family dashboard
        assert!(!has_family_dashboard(&free)); // FR-E-017
        assert!(!has_family_dashboard(&plus));
        assert!(!has_family_dashboard(&pro));
        assert!(has_family_dashboard(&family));

        // Support priority
        assert_eq!(support_priority(&free), SupportPriority::Community); // FR-E-018
        assert_eq!(support_priority(&plus), SupportPriority::Standard);
        assert_eq!(support_priority(&pro), SupportPriority::Priority);
        assert_eq!(support_priority(&family), SupportPriority::Priority);
    }

    /// Edge case: focus/break duration bounds
    #[test]
    fn test_focus_break_duration_boundaries() {
        let exp = Utc::now() + chrono::Duration::days(30);
        let plus = Entitlement::with_tier(Tier::Plus, exp, "sig".to_string());

        // Focus: 5–180 min
        assert!(validate_focus_duration(5, &plus).is_ok());
        assert!(validate_focus_duration(4, &plus).is_err());
        assert!(validate_focus_duration(180, &plus).is_ok());
        assert!(validate_focus_duration(181, &plus).is_err());

        // Break: 1–60 min
        assert!(validate_break_duration(1, &plus).is_ok());
        assert!(validate_break_duration(0, &plus).is_err());
        assert!(validate_break_duration(60, &plus).is_ok());
        assert!(validate_break_duration(61, &plus).is_err());
    }

    /// Edge case: subscription expiry
    #[test]
    fn test_subscription_expiry_behavior() {
        let now = Utc::now();
        let exp = now + chrono::Duration::days(1);
        let sub = Entitlement::with_tier(Tier::Plus, exp, "sig".to_string());

        // Not yet expired
        assert!(sub.is_active(now));
        assert_eq!(sub.days_until_expiry(now), Some(1));

        // Exact expiry time
        assert!(!sub.is_active(exp));
        assert_eq!(sub.days_until_expiry(exp), Some(0));

        // Expired
        let future = exp + chrono::Duration::days(1);
        assert!(!sub.is_active(future));
        assert_eq!(sub.days_until_expiry(future), Some(-1));

        // Free tier never expires
        let free = Entitlement::free();
        assert!(free.is_active(now + chrono::Duration::days(365)));
        assert_eq!(free.days_until_expiry(now), None);
    }

    /// Edge case: rule/task limit boundaries
    #[test]
    fn test_rule_task_boundaries() {
        let free = Entitlement::free();

        // At boundary: 2 rules (can add 3rd)
        assert!(can_add_rule(2, &free).is_ok());
        // At limit: 3 rules (cannot add 4th)
        assert!(can_add_rule(3, &free).is_err());

        // Task same logic
        assert!(can_add_task(2, &free).is_ok());
        assert!(can_add_task(3, &free).is_err());
    }
}
