import SwiftUI
import UIKit
import XCTest
import DesignSystem
import Enforcement
import FocalPointCore
import MascotUI

final class CoverageSurfaceTests: XCTestCase {
    private func makeCore() throws -> FocalPointCore {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("focalpoint-coverage-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return try FocalPointCore(storagePath: dir.appendingPathComponent("core.db").path)
    }

    @MainActor
    func testDesignSystemMarkdownAndPaletteSurfacesRender() {
        let dynamic = UIColor.dynamic(light: UIColor(hex: "#FFFFFF"), dark: UIColor(hex: "#000000"))
        XCTAssertEqual(
            dynamic.resolvedColor(with: UITraitCollection(userInterfaceStyle: .light)),
            UIColor(hex: "#FFFFFF")
        )
        XCTAssertEqual(
            dynamic.resolvedColor(with: UITraitCollection(userInterfaceStyle: .dark)),
            UIColor(hex: "#000000")
        )

        let markdown = MarkdownView(
            text: """
            # Coverage

            This is **bold**, _italic_, and [linked](https://example.com).
            """,
            fontSize: 15,
            foregroundColor: .app.foreground,
            linkColor: .app.accent
        )
        render(markdown)
        _ = Color.coachy.flameCore
    }

    func testEnforcementPoliciesAndDriversAcceptNoOpSimulatorCalls() async throws {
        let endsAt = Date(timeIntervalSince1970: 2_000_000_000)
        let policy = EnforcementPolicy(
            blockedBundleIds: ["com.example.social", "com.example.video"],
            endsAt: endsAt
        )

        XCTAssertEqual(policy.blockedBundleIds.count, 2)
        XCTAssertEqual(policy.endsAt, endsAt)

        let stub = StubEnforcementDriver()
        stub.apply(policy: policy)
        stub.apply(policy: EnforcementPolicy(blockedBundleIds: [], endsAt: nil))
        stub.retract()

        let familyControls = FamilyControlsEnforcementDriver()
        try await familyControls.ensureAuthorized()
        familyControls.apply(policy: policy)
        familyControls.retract()
    }

    func testAuthoredCoreValueTypesInitialize() {
        let ruleId = RuleId("rule-coverage")
        let activeRule = ActiveRule(
            id: ruleId,
            title: "Coverage Rule",
            endsAt: Date(timeIntervalSince1970: 2_000_000_000)
        )

        XCTAssertEqual(ruleId.raw, "rule-coverage")
        XCTAssertEqual(activeRule.id, ruleId)
        XCTAssertEqual(activeRule.title, "Coverage Rule")
        XCTAssertNotNil(activeRule.endsAt)

        let content = FocusSessionAttributes.FocusSessionContentState(
            remainingSeconds: 60,
            totalSeconds: 120,
            isPaused: false,
            ruleName: "Deep Work",
            coachyPose: "confident",
            upcomingBreakIn: 30,
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
        XCTAssertEqual(content.remainingSeconds, 60)
        XCTAssertEqual(content.totalSeconds, 120)
        XCTAssertFalse(content.isPaused)
        XCTAssertEqual(content.ruleName, "Deep Work")
        XCTAssertEqual(content.coachyPose, "confident")
        XCTAssertEqual(content.upcomingBreakIn, 30)

        let attributes = FocusSessionAttributes(
            sessionTitle: "Coverage Session",
            startedAt: Date(timeIntervalSince1970: 1_700_000_000),
            plannedDuration: 120,
            breakInterval: 30,
            bgTint: "teal",
            coachyEmoji: "focus"
        )
        XCTAssertEqual(attributes.sessionTitle, "Coverage Session")
        XCTAssertEqual(attributes.plannedDuration, 120)
        XCTAssertEqual(attributes.breakInterval, 30)
        XCTAssertEqual(attributes.bgTint, "teal")
        XCTAssertEqual(attributes.coachyEmoji, "focus")
    }

    func testSafeFfiApiAccessorsAndDefaultReports() throws {
        let core = try makeCore()

        XCTAssertFalse(core.appVersion().isEmpty)
        XCTAssertFalse(core.rulesDsl().isEmpty)
        XCTAssertNotNil(core.mascotState())
        XCTAssertNotNil(core.alwaysOn())
        XCTAssertNotNil(core.audit())
        XCTAssertNotNil(core.connector())
        XCTAssertNotNil(core.dataLifecycle())
        XCTAssertNotNil(core.demoSeed())
        XCTAssertNotNil(core.eval())
        XCTAssertNotNil(core.hostEvents())
        XCTAssertNotNil(core.mutations())
        XCTAssertNotNil(core.penalty())
        XCTAssertNotNil(core.policy())
        XCTAssertNotNil(core.rituals())
        XCTAssertNotNil(core.rules())
        XCTAssertNotNil(core.suggester())
        XCTAssertNotNil(core.sync())
        XCTAssertNotNil(core.tasks())
        XCTAssertNotNil(core.templates())
        XCTAssertNotNil(core.wallet())

        _ = try core.alwaysOn().tick()
        XCTAssertTrue(try core.audit().verifyChain())
        XCTAssertNotNil(try core.audit().recent(limit: 1))
        XCTAssertNotNil(try core.eval().tick())
        XCTAssertNotNil(try core.penalty().load())
        XCTAssertNotNil(try core.penalty().quoteBypass(cost: 0))
        XCTAssertNotNil(try core.policy().buildFromRecentDecisions(limit: 5))
        XCTAssertNotNil(try core.rules().listEnabled())
        XCTAssertNotNil(try core.suggester().fetch(windowDays: 7))
        XCTAssertNotNil(core.sync().connectors())
        XCTAssertNotNil(core.sync().tick())
        XCTAssertNotNil(core.templates().listBundled())
        XCTAssertNotNil(try core.wallet().load())
    }

    func testFfiMascotEventCasesRoundTripThroughCore() throws {
        let core = try makeCore()
        let events: [MascotEvent] = [
            .ruleFired(ruleName: "Deep Work"),
            .streakIncremented(name: "focus", count: 3),
            .streakReset(name: "sleep"),
            .creditEarned(amount: 10),
            .bypassSpent(remaining: 2),
            .penaltyEscalated(tier: "strict"),
            .appLaunchedWhileBlocked(bundleId: "com.example.blocked"),
            .focusSessionStarted(minutes: 25),
            .focusSessionCompleted(minutes: 25),
            .dailyCheckIn,
            .sleepDebtReported(hours: 1.5),
            .idle,
        ]

        for event in events {
            _ = core.generateBubble(event: event)
            XCTAssertNotNil(core.pushMascotEvent(event: event))
        }
    }

    func testFfiRuleMutationActionVariantsAndTemplates() throws {
        let core = try makeCore()
        XCTAssertFalse(core.templates().listBundled().isEmpty)
        XCTAssertGreaterThan(try core.templates().install(packId: "deep-work-starter"), 0)

        let ruleId = UUID().uuidString
        try core.mutations().upsert(rule: RuleDraft(
            id: ruleId,
            name: "Coverage action variants",
            triggerEvent: "coverage:event",
            actions: [
                .grantCredit(amount: 1),
                .deductCredit(amount: 1),
                .block(profile: "social", durationSeconds: 60),
                .unblock(profile: "social"),
                .streakIncrement(name: "coverage"),
                .streakReset(name: "coverage"),
                .notify(message: "coverage"),
            ],
            priority: 1,
            cooldownSeconds: 5,
            durationSeconds: 60,
            explanationTemplate: "Coverage rule",
            enabled: true
        ))
        XCTAssertFalse(try core.rules().listEnabled().isEmpty)

        try core.mutations().setEnabled(ruleId: ruleId, enabled: false)
        XCTAssertFalse(try core.rules().listEnabled().contains { $0.id == ruleId })

        try core.mutations().setEnabled(ruleId: ruleId, enabled: true)
        XCTAssertFalse(try core.rules().listEnabled().isEmpty)
    }

    func testFfiWalletPenaltyBackupRitualsAndCoachingSurfaces() throws {
        let core = try makeCore()

        try core.wallet().applyMutation(m: .grantCredit(amount: 25))
        try core.wallet().applyMutation(m: .spendCredit(amount: 5, purpose: "coverage"))
        try core.wallet().applyMutation(m: .streakIncrement(name: "coverage"))
        try core.wallet().applyMutation(m: .streakReset(name: "coverage"))
        try core.wallet().applyMutation(m: .setMultiplier(current: 1.5, expiresIso: nil))
        XCTAssertGreaterThanOrEqual(try core.wallet().load().balance, 0)

        try core.penalty().apply(m: .grantBypass(amount: 3))
        try core.penalty().apply(m: .spendBypass(amount: 1))
        try core.penalty().apply(m: .escalate(tier: "Strict"))
        try core.penalty().apply(m: .addLockout(window: LockoutWindowDto(
            startsAtIso: "2026-04-30T00:00:00Z",
            endsAtIso: "2026-04-30T01:00:00Z",
            reason: "coverage"
        )))
        try core.penalty().apply(m: .clearLockouts)
        try core.penalty().apply(m: .setStrictMode(untilIso: "2033-04-30T02:00:00Z"))
        try core.penalty().apply(m: .clear)
        XCTAssertNotNil(try core.penalty().load())

        let backup = try core.backup().create(passphrase: "coverage-passphrase")
        XCTAssertFalse(backup.isEmpty)

        XCTAssertNotNil(try core.demoSeed().seed())
        try core.demoSeed().reset()

        try core.rituals().captureIntention(date: "2026-04-30", intention: "Cover the basics")
        XCTAssertNotNil(try core.rituals().generateMorningBrief())
        XCTAssertNotNil(try core.rituals().generateEveningShutdown(actuals: [
            TaskActualDto(
                taskId: "A8A1B25D-84F7-46BD-A2D5-5CB9E00AC001",
                actualMinutes: 25,
                completedAtIso: "2026-04-30T01:00:00Z",
                cancelled: false
            ),
        ]))
        XCTAssertNotNil(try core.rituals().generateWeeklyReview())
        XCTAssertNotNil(try core.rituals().generateMonthlyRetro())

        let config = CoachingConfig(
            endpoint: "https://example.com",
            apiKey: "coverage-key",
            model: "coverage-model"
        )
        core.setCoaching(config: config)
        core.setCoaching(config: nil)
    }

    @MainActor
    func testMascotStateAliasesAndViewsRender() {
        XCTAssertEqual(CoachyPose.curiousThinking, .curious)
        XCTAssertEqual(CoachyPose.sternToughLove, .stern)
        XCTAssertEqual(CoachyPose.sleepyDisappointed, .sleepy)
        XCTAssertEqual(CoachyEmotion.warm, .happy)
        XCTAssertEqual(CoachyEmotion.engaged, .focused)
        XCTAssertEqual(CoachyEmotion.supportive, .neutral)

        for pose in CoachyPose.allCases {
            for emotion in CoachyEmotion.allCases {
                let state = CoachyState(
                    pose: pose,
                    emotion: emotion,
                    bubbleText: "\(pose.rawValue)-\(emotion.rawValue)"
                )
                render(CoachyView(state: state, size: 120))
            }
        }

        render(CoachyView(state: CoachyState(pose: .idle, emotion: .neutral), size: 100))
    }

    @MainActor
    private func render<V: View>(_ view: V, file: StaticString = #filePath, line: UInt = #line) {
        let host = UIHostingController(rootView: view)
        host.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        XCTAssertNotNil(host.view, file: file, line: line)

        let renderer = ImageRenderer(content: view.frame(width: 390, height: 844))
        renderer.scale = 1
        XCTAssertNotNil(renderer.uiImage, file: file, line: line)
    }
}
