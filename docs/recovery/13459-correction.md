docs(recovery): correct the #13459 provenance and add acceptance evidence

The commit message on 5187fa5e56 is factually wrong and this corrects the
record. History is immutable, so the original message stands as written; this
commit supersedes it.

What 5187fa5e56 claimed: that the #13459 cherry-pick collapsed the dedup query's
arguments from seven to four, and that restoring them was the repair.

What actually happened, verified by reading pristine origin/main at 843f342556:

- main already passed all seven arguments to the seven-placeholder dedup query.
  The query was never collapsed on main, so there was nothing to restore.
- main contains zero occurrences of resolveProviderId in usageHistory.ts. Its
  dedup matches on the raw entry.provider string.
- 5187fa5e56 therefore did not restore arguments. It introduced the canonical
  provider resolution that the dedup was missing, which is the actual #13459
  intent.

The behavioral effect, measured by writing the same request twice through the
real saveRequestUsage entry point and counting rows in a real isolated SQLite
database. Same timestamp, same tokens, reported once as the alias `oc` and once
as its canonical id `opencode`:

    pristine main 843f342556  ->  2 rows
    this branch  8233223814  ->  1 row

The acceptance harness also produced a false result twice before being fixed,
and both are documented because the corrections are the substance of the
evidence:

- The dedup check first used "openai/chat" as the alias. That is not a
  registered alias; resolveProviderId leaves it unchanged. The check then
  reported the dedup as broken on both trees. Replaced with `oc`, verified
  against ALIAS_TO_ID.
- The streaming check first compared raw newline counts, which made the
  streaming branch look worse than the buffered baseline. Replaced with a
  payload-parsing check.

Measured on the real logs export route with 40 seeded call_logs rows:

    main   -> 1 chunk of 54211 bytes, built by JSON.stringify before returning
    branch -> 81 chunks, a header fragment then one enqueue per row

This adds no product code. The recovery work was already correct; the record
about it was not.

tx-agent:     jcode
tx-validated: test
tx-task:      release-line-gap-recovery
tx-scope:     docs
tx-intent:     Correct the false #13459 provenance claim and record acceptance evidence
