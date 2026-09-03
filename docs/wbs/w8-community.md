# W8 — Community, Ecosystem, Strategic

**Wave:** W8
**Priority:** P3
**Generated:** 2026-09-02

## W8.1 — Publish Fork as Scoped NPM Package (P3)

**Why:** A scoped npm package makes the fork discoverable to users who want our fixes without the fork dance.

**What:** `@kooshapari/omniroute` on npm, mirroring the public API. Tagged `latest-fork` and `stable-fork`.

**Files:** `package.json` (add `publishConfig`), `scripts/release/publish-npm.sh`

**Acceptance:**
- [ ] `npm install @kooshapari/omniroute` works
- [ ] The CLI command is the same as upstream
- [ ] The README points to the difference between this and upstream

**Verify:** `npm view @kooshapari/omniroute`

---

## W8.2 — Blog Post: "The 60K-star project and our fork" (P3)

**Why:** External amplification. A blog post tells a story that GitHub stars don't.

**What:** A 1,500-word post on kooshapari.hashnode.dev covering:
1. Why we forked
2. What we kept, what we changed
3. The contribution we sent upstream
4. The architecture diagram

**Files:** N/A (post is on the blog)

**Acceptance:**
- [ ] Posted on Hashnode
- [ ] Linked from the fork README
- [ ] At least 1,000 views in 30 days

**Verify:** Analytics

---

## W8.3 — Plugin Directory (P3)

**Why:** Plugins multiply value per user. A directory of community plugins keeps users in our orbit.

**What:** A static site or GitHub-repo listing community plugins. Each plugin: name, author, last updated, install command.

**Files:** `docs/plugins/README.md`, `docs/plugins/<plugin-name>.md`

**Acceptance:**
- [ ] At least 3 community plugins listed
- [ ] Each has a working install command

**Verify:** `curl -L https://github.com/kooshapari/omniroute/tree/main/docs/plugins`

---

## W8.4 — Sponsor Button (P3)

**Why:** Visible support for upstream. Also: sidebar visibility.

**What:** Enable GitHub Sponsors. Add the badge to the README. Add `FUNDING.yml`.

**Files:** `.github/FUNDING.yml`, `README.md` (badge)

**Acceptance:**
- [ ] Sponsors button visible on the repo page
- [ ] $5/month sponsor of diegosouzapw (W10.15)
- [ ] Sponsors listed in the README

**Verify:** `gh repo view --json fundingLinks`

---

## W8.5 — Community Discord / Slack (P3)

**Why:** Real-time support + community building.

**What:** A Discord server with channels: #general, #help, #show-and-tell, #contributors. Invite link in the README.

**Files:** N/A (Discord setup is external)

**Acceptance:**
- [ ] Server has at least 20 members in 30 days
- [ ] 24-hour response time SLA on #help
- [ ] Pinned message with the contribution guide

**Verify:** Discord admin view
