# Decision records

Short records of the decisions that shaped this system, in the format Michael Nygard
proposed: context, decision, consequences. Each one also carries a section on what
would change it, because most of them are genuinely revisitable and a record that
reads as permanent is a record nobody revisits when it should be.

There are four, and there will not be many more. A decision record earns its place
when the reasoning behind a choice is not visible in the code, and when someone,
including me in six months, would otherwise re-derive it or reverse it by accident.
Choices that follow from a decision already recorded are written up as consequences
inside that record rather than given their own number. Choices where no real
alternative was ever on the table are documented in the architecture and left out of
here entirely.

Numbering runs across the whole repository rather than per automation, because these
decisions apply to every workflow here.

| # | Decision | Status |
|---|---|---|
| [0001](0001-schedule-sweep-over-drive-change-trigger.md) | Sweep on a schedule instead of subscribing to Drive changes | Accepted |
| [0002](0002-upsert-by-natural-key-with-partial-updates.md) | Upsert on a natural key, with partial field updates | Accepted |
| [0003](0003-javascript-over-python-in-code-nodes.md) | Keep the Code nodes in JavaScript | Accepted, amended 28 July 2026 |
| [0004](0004-backup-lifecycle-and-retention.md) | Back up inside the approved branch, and cap retention at five | Accepted |

An amended record keeps its original acceptance date and carries the amendment as a
note beneath it. A record is only superseded when the decision itself changes, which
has not happened yet.
