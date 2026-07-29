# 0001. Sweep on a schedule instead of subscribing to Drive changes

Status: Accepted, 23 July 2026

## Context

Both workflows consume small text files dropped into a Google Drive folder called
`_inbox`. The first build used the n8n Google Drive Trigger, set to watch that folder
for newly created files. It polls Drive's change feed, keeps a cursor, and hands
downstream nodes whatever is new since the last poll.

It worked, until files arrived close together.

On 22 July 2026 three pending files were created within a few seconds of each other.
One was processed. The other two stayed in `_inbox` and were never delivered, on that
poll or any later one. It happened a second time with two files. Nothing errored. The
executions were green. From the system's point of view the files did not exist, and
the only reason it was caught was that an expected edit to the document never
appeared.

Drive's change feed is eventually consistent. When several creations land inside one
poll window, the trigger can advance its cursor past files it never saw. Once the
cursor has moved, those files are permanently invisible to it, because "new" is
defined against a timestamp rather than against what has actually been handled. The
failure mode is silence, which is the worst available failure mode for a system whose
whole job is keeping a record accurate.

Two further caveats came with the same design. The trigger only sees files created
after the workflow was activated, so anything already sitting in `_inbox` needed a
manual run to flush. And the state of files created while n8n was not running was
never clear.

## Decision

Replace the Drive change trigger with a Schedule Trigger on a ten minute interval,
followed by a Google Drive node that lists everything currently in `_inbox`, followed
by a Filter on the filename prefix.

The queue is now the folder itself rather than a cursor. Presence in `_inbox` means
unprocessed. The first action taken on any file is to move it to `_processing`, which
is what removes it from the queue.

## Consequences

A file cannot be missed by construction. There is no cursor to advance past anything.
If a file is in the folder, the next sweep sees it. If n8n was off for two days, the
first sweep after it comes back picks up everything waiting.

Two operational rituals disappeared. There is no pre-activation blind spot, and no
manual flush run.

A new problem is introduced and has to be solved. The sweep re-lists files it has
already started work on. This matters most in Master Context Append, which parks on an
unanswered approval email for as long as it takes to answer. Without a fix, every ten
minutes would send another approval email for the same edit. The fix is the claim
step, moving the file to `_processing` as the first action inside the loop. It is a
consequence of this decision rather than an independent one, which is why it does not
have a record of its own.

Latency is now bounded by the schedule rather than by the poll, up to ten minutes in
the worst case. The system's tolerance is hours, so this costs nothing real.

Drive is called every ten minutes whether or not there is work to do. At this volume
that is negligible. At a much higher volume it would be worth reconsidering.

A file left in `_processing` after a sweep now means a run that started and did not
finish. That is a diagnostic the previous design did not have.

## What would change this

A push notification channel with delivery guarantees strong enough to trust, and a
volume high enough that listing an idle folder became wasteful. Neither is true here.

Drive push channels also expire and need renewing, which is its own operational task,
and the failure mode of a lapsed channel is silence. That is precisely the failure
mode this decision exists to remove, so a move back would need the delivery guarantee
and a way to notice the channel had lapsed.
