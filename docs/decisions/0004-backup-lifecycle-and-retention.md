# 0004. Back up inside the approved branch, and cap retention at five

Status: Accepted, 27 July 2026

## Context

Master Context Append has taken a backup of the Doc since it was first built. The
backup existed. Its lifecycle did not. Nobody had decided when it should be taken,
what should distinguish an applied edit from a rejected one, or what should ever
remove a copy.

Three gaps surfaced at once, and they surfaced because this repository was being
written rather than because anything failed. Documenting a system forces you to state
what it does, and stating it makes the difference between that and what you meant it
to do impossible to miss.

**The backup was taken before the approval email, not before the write.** `Copy file`
sat between `Build Replacement` and the Gmail send and wait node. Two consequences.
Every declined edit produced a backup of a document nobody was about to change. More
importantly, the execution parks on that email for as long as it takes to answer, and
the Doc is editable by hand throughout. A backup taken at the moment approval was
requested is not a snapshot of the state about to be overwritten. It is a snapshot of
some earlier state that happens to share a name with one.

**Declined edits landed in `_done`.** The architecture claimed that folder counts alone
report the health of the system. They did not. `_done` held applied edits and rejected
ones together, and telling them apart meant opening the execution log, which is the
thing folder counts exist to avoid.

**Nothing ever deleted a backup.** There were twenty five copies of the same document
in `_backups` and no mechanism that would ever have produced twenty four.

## Decision

Three changes, taken as one subject.

**Move `Copy file` into the `If` true branch,** between the approval check and
`Update a document`. The backup is now taken immediately before the write, with
nothing between them that can wait on a human. A declined edit produces no backup at
all, which is correct, since nothing was overwritten.

**Add a `_declined` folder.** The `If` false branch moves the pending file there
instead of into `_done`. There are now four terminal states: `_done`, `_declined`,
`_failed` and `_processing`.

**Add a retention branch off `Copy file`.** `List Backups` lists `_backups`,
`Select Backups to Delete` sorts the names descending and returns everything past the
newest five, and `Delete Backup` trashes them rather than deleting permanently.

Two implementation details carry more weight than they look.

Sorting is done on the filename as text, not on a parsed date. The naming pattern is
`MASTER_CONTEXT_backup_yyyy-MM-dd_HHmm`, which sorts chronologically as a string
because the fields run from most significant to least. There is no date parsing to get
wrong, no timezone to be wrong about, and no dependence on Drive's own timestamps.

The branch hangs off `Copy file` rather than sitting inline between the copy and the
write. In n8n, a node that emits zero items halts everything downstream of it. An
inline prune on the first run, or on any run with nothing to delete, would have stopped
the execution before `Update a document` and stalled the write path. Housekeeping goes
on a branch that is allowed to produce nothing.

## Consequences

The backup now means what the word means. It is the state of the document immediately
before this workflow changed it.

`_backups` is bounded. Five copies, trashed rather than destroyed, so a retention bug
is recoverable for thirty days instead of instantly.

Folder counts became honest. The claim the architecture had been making about them is
now true, which it was not when it was written.

Retention is by count and not by age. Five copies is roughly a week of quiet use and
under two days of heavy use. Nothing guarantees a minimum span of history.

A branch that can fail without failing the run is a branch that can fail without
telling you. That is the right behaviour for housekeeping in production and it cost a
debugging cycle to learn. On the first attempt the prune deleted nothing, because the
folder ID on `List Backups` was wrong and On Error on that node had been set to
Continue from the start. A failed node under Continue emits a single item carrying an
error key, the downstream Code node filtered it out as not matching the backup name
pattern, and the branch ran green having done nothing at all. The rule that came out of
it: build a branch loud, with On Error left at Stop Workflow, verify it, and only then
make it quiet.

## Verification

Two runs on 27 July 2026, against a purpose built pending file targeting Section 13 of
the Doc, which is the Open Questions section and therefore harmless to write to.

The declined run produced no backup, wrote nothing, and moved the file to `_declined`.

The approved run wrote the edit, took one backup, and collapsed `_backups` from twenty
five files to the keep count in a single execution. Twenty three deletions in one pass
also verified that the delete step iterates rather than handling only the first item.

## What would change this

The strongest argument against keeping backups at all is that Google Docs already has
native version history, which is finer grained than this, costs nothing, and cannot be
forgotten. That is a fair challenge and it is worth answering rather than ignoring.

Two reasons this stays. A named copy timestamped to the minute of an automated write is
findable in a way a revision timeline is not, because the timeline also contains every
hand edit and offers no way to tell which revision was the one the workflow made. And
the copies are separate files, so a problem that damages the Doc does not necessarily
take its history with it.

If Drive exposed revision labelling through the API, so a workflow could tag its own
revision by name, that argument would weaken considerably and this branch could
probably be deleted.

The retention count itself is one constant in one Code node. Changing it is not a
decision, it is a number.
