# Architecture

## The problem this solves

Two documents run a job search. A Google Sheet logs every application, its status and
its outcome. A Google Doc holds the strategy and the reasoning behind those
applications. Both have to stay current, and both get updated as a side effect of
ordinary work rather than in a dedicated sitting.

The updates are drafted in a chat assistant. That assistant can create a file in
Google Drive, but it cannot edit an existing Doc or Sheet in place. So an update
arrives as a small plain text file dropped into a Drive folder, and something else has
to apply it to the real document.

These two workflows are that something else. Put more usefully, the design problem
here is not how to write a row to a Sheet. It is how to accept instructions from a
source that is fast, helpful and occasionally wrong, and apply them to documents that
must not corrupt silently. Most of what follows is a consequence of that sentence.

## The two workflows

| Workflow | Consumes | Writes to | Gate before writing |
|---|---|---|---|
| Tracker Append/Update | `TRACKER_PENDING_*` | Applications tab of the tracker Sheet | Automated validation |
| Master Context Append | `CONTEXT_PENDING_*` | The master context Doc | Human approval by email |

Both sweep the same `_inbox` folder every ten minutes. The filename prefix is the only
thing routing a file to one workflow rather than the other. That is deliberate. A
third workflow can be added later by choosing a new prefix, with no change to either
existing flow.

A third workflow, `00 Error Handler`, has no schedule and no inbox. It is covered
under failure handling below.

## The shared intake pattern

The first steps are identical in both workflows.

```
Schedule Trigger (10 minutes)
  -> List Inbox        Drive, list everything currently in _inbox
  -> Filter            keep names starting with the prefix
  -> Loop Over Items   batch size 1
       -> Claim File   Drive, move the file to _processing
       -> ...
```

Three things here are load bearing.

**Listing, not subscribing.** An earlier version used the Google Drive Trigger, which
tracks a cursor over Drive's change feed. That feed is eventually consistent, and when
several files were created inside one poll window only the newest was delivered. The
rest sat in `_inbox` permanently and silently. Listing the folder cannot miss a file,
because the current contents of the folder are the queue. See decision record 0001.

**Batch size 1.** n8n hands a node every matching item at once. Without an explicit
loop, a node written against `$input.first()` quietly processes one file and drops the
others, and a single approval email cannot gate three separate edits. Batch size 1
makes each file its own pass through the whole pipeline, with its own backup, its own
approval and its own write.

**Claim by move.** The first action inside the loop moves the file out of `_inbox` and
into `_processing`. The reason is re-entrancy rather than concurrency. Master Context
Append parks on an unanswered approval email, sometimes for hours. Without the claim,
every sweep during that wait would list the same file again and send another approval
email. Moving the file removes it from the queue the moment work starts. A Drive move
does not change a file ID, so every downstream reference still resolves.

One detail that is easy to get wrong. `Claim File` addresses the file as
`{{ $json.id }}`, because at that point the incoming item is the loop item. Every node
after the claim addresses it as `{{ $('Loop Over Items').item.json.id }}` instead.
After the move, `$json` refers to the output of the move node, whose shape varies
between node versions. Referring back to the loop item is stable.

## Automation 1: Tracker Append/Update

Sixteen nodes.

```
Schedule Trigger -> List Inbox -> Filter -> Loop Over Items
Loop Over Items [loop] -> Claim File -> Download file -> Extract from File
  -> Parse Pending File (Code) -> Get Rows -> Resolve and Validate (Code) -> If
If [true]  -> Row Only (Code) -> Upsert Row     -> Move to Done   -> Loop Over Items
If [false] -> Send a message  -> Move to Failed -> Loop Over Items
```

`Get Rows` reads the Applications tab with no filter configured, so it returns the
whole sheet. That one call answers three questions at once. Does the supplied ID
exist. What is the highest ID currently in use. What does the existing Notes cell say,
so an append can be built rather than an overwrite.

`Parse Pending File` reads the file as keyed lines, one field per line written as
`Field: value`. A line that does not start with a recognised field name is folded into
the previous field, so a wrapped line does not become a lost line. If the file
contains no keyed fields at all, the parser falls back to the older positional format,
splitting on pipe characters against a fixed twenty column header list. That fallback
is kept for files written before the format changed, and it retains an overflow guard
that folds surplus values into Notes. The guard is also the mechanism behind the
defect described under verification history below.

`Resolve and Validate` is where a file becomes a decision. It refuses rather than
writing something wrong in four cases: an unrecognised field name, an ID that is not
on the sheet, a new application missing Who, Company, Role Title or Status, and an
apparent duplicate of an existing Who plus Company plus Role Title. A refusal sends an
email naming the file and the reason, then moves the file to `_failed`.

`Upsert Row` uses Append or Update Row, matching on the ID column, with mapping set to
automatic and extra field handling set to ignore. That last setting matters more than
it looks. The default behaviour inserts a new column for any unrecognised field, so a
single typo in a pending file would grow a twenty first column, and the Dashboard
tab's formulas would start reading a sheet whose shape had moved underneath them.

`Row Only` exists because automatic mapping reads the top level keys of its input.
`Resolve and Validate` returns a wrapper object holding `valid`, `op`, `reason`,
`fileName` and `row`. Passing that straight to the Sheets node would map the wrapper
and not the row. `Row Only` unwraps it.

The keyed line format, ID assignment and partial updates are covered in decision
record 0002.

## Automation 2: Master Context Append

Nineteen nodes.

```
Schedule Trigger -> List Inbox -> Filter -> Loop Over Items
Loop Over Items [loop] -> Claim File -> Download file -> Extract from File
  -> Information Extractor -> Build Replacement (Code)
  -> Send message and wait for response -> If

If [true]  -> Copy file -> Update a document -> Move to Done -> Loop Over Items
                        -> List Backups -> Select Backups to Delete (Code) -> Delete Backup
If [false] -> Move to Declined -> Loop Over Items

Anthropic Chat Model --(ai_languageModel)--> Information Extractor
```

The intake is identical and then the two workflows stop resembling each other.

`Information Extractor` is an LLM node backed by Claude Haiku 4.5. It reads the
pending file as prose and returns five fields: `action` (ADD or REPLACE), `section`,
`search_text`, `new_text` and `summary`. The tracker workflow parses its input with a
regular expression because its input is a fixed set of known keys. This input is
closer to a note written in a hurry, so it gets extraction instead. The fifth field,
`summary`, exists to become the subject line of the approval email, so the inbox shows
what an edit is for without the message having to be opened.

`Build Replacement` turns those fields into the two strings the Docs API needs. For an
ADD it builds an anchor token, `[[S7]]` for section 7, sets that anchor as the search
string, and sets the replacement to the new text followed by a blank line and the
anchor again. The effect is an insertion, expressed as a replacement, using an anchor
that survives its own use. Every section of the master context Doc carries one of
these tokens at its end for exactly this purpose. For a REPLACE, the search and
replacement strings pass through as written. In both branches a small helper strips
`**` from the text, because the Doc stores bold as styling rather than as characters,
so asterisks in a pending file would never match anything.

`Send message and wait for response` is a Gmail node in send and wait mode, configured
for double approval. The execution parks until the email is answered. The body shows
the action, the target section, the exact text the workflow will search for and the
exact text it will write. That preview is the real safety mechanism, for the reason
given under limitations below.

Everything after the `If` node is the backup lifecycle, and it is the subject of
decision record 0004. In short: the approved branch takes a timestamped copy of the
Doc immediately before writing to it, then writes, then moves the pending file to
`_done`. A side branch off that same copy node lists `_backups`, works out which
copies are surplus to the newest five, and trashes them. The declined branch takes no
backup, writes nothing, and moves the pending file to `_declined`.

## The asymmetry between the two, which is the point

Automation 1 has a `_failed` folder and an alert email. Automation 2 has neither. That
is not an inconsistency waiting to be tidied up.

A tracker row is low stakes and relatively high volume. It gets validated by code and
written without asking, and a bad file is an error to be reported. A master context
edit is low volume and hard to reverse, because it rewrites a document that later work
reads as ground truth. It gets a backup, a preview and a human. A declined edit there
is not an error, it is the system working, so it needs no failure folder and no alert,
only a folder of its own so the two outcomes stay countable.

One workflow fails loudly. The other asks permission. The difference is a read of the
risk rather than an accident of when they were built.

## Terminal states

Every file ends in exactly one of four folders.

- `_done`, applied successfully.
- `_declined`, reviewed by a human and rejected. Automation 2 only.
- `_failed`, refused by validation, with an email explaining why. Automation 1 only.
- `_processing`, still in flight, or left behind by a run that did not finish.

The useful property is that folder counts alone report the health of the system
without opening n8n. An edit that was considered and turned down is a different
outcome from an edit that was applied, and the folders now say which is which.

## Failure handling

A third workflow, `00 Error Handler`, contains an Error Trigger and a Gmail send. Both
other workflows name it as their Error Workflow in workflow settings. When an
execution fails, the email carries the workflow name, the node that failed, the error
message, a direct link to the failed execution, and a reminder to check `_processing`
for a stranded file.

It has no decision record because there was no real alternative under consideration,
and a decisions folder padded with records that had one option is a decisions folder
nobody reads.

Two things are worth stating precisely, because "we have error alerting" is a weaker
claim than knowing what it catches.

**It fires on production executions.** Testing it by clicking Execute Workflow produces
a failure and no email, which looks like a broken error handler and is not.

**It catches crashes, not silent no-ops.** A workflow that throws now announces itself.
A workflow that runs green and writes nothing does not, and that is the failure class
this project has actually hit repeatedly. That one is closed by loud validation, by
anchoring ADDs to a token known to exist, and by reading the approval email before
approving it.

## Known limitations

These are real. Better stated than discovered.

**A REPLACE that matches nothing succeeds.** The Google Docs `replaceAll` action
reports success when it replaces zero occurrences. The workflow runs green and writes
nothing. This is why the approval email quotes the exact search string, and why the
working rule is to prefer ADD, which targets an anchor token known to exist.

**Nothing notices a file stranded in `_processing`.** The error email names the
workflow that crashed and prompts a look, but no scheduled check reports a file that
has been sitting there since yesterday. Closing that properly needs a fourth workflow.

**The Code nodes assume batch size 1.** Four of the five call `$input.first()` or
reach back to a named node with `.first()`. Raising the batch size would not speed
these workflows up, it would silently process one file per batch.

**Retention is by count, not by age.** Five backups is roughly a week of quiet use and
under two days of heavy use. There is no floor on how much history survives a busy
afternoon.

**These run only while one machine is awake.** n8n is self hosted on a Windows laptop.
The latency tolerance of the whole system is hours, so this is acceptable, but it is a
property of the deployment and not of the design.

**The exported JSON in this repository is scrubbed.** Document IDs, folder IDs,
credential references and email addresses are replaced with placeholders, so the files
are documentation rather than something you can import and run.

## Verification history

Not a changelog. These are the events that produced the design.

**22 July 2026.** The Drive change trigger stranded files created in quick succession.
Two occurrences, one of three files and one of two.

**23 July 2026.** Both workflows re-architected onto a schedule plus a folder listing.
Master Context Append verified with two pending files present at once, producing two
sequential approval emails and two separate writes.

**23 July 2026.** Tracker Append reworked from append only into an upsert, and verified
with four files present at once: a new application, an unknown ID, a duplicate and a
real outcome update. Result was two writes, two alerts and correct routing.

**23 July 2026.** A defect found and repaired. The standing protocol that generates
pending files specified nineteen fields ending at Notes. The sheet has twenty, ending
at Furthest Stage. A pending file carried twenty values, and the positional parser's
overflow guard did exactly what it was built to do, folding the surplus value into the
Notes cell. The correct value for Furthest Stage was appended to the end of a note.
Nothing failed and the row looked plausible. The first production write of the new
workflow was repairing the row damaged by the old one, and the protocol that generates
the files was rewritten the same day.

The lesson is not about parsing. Two definitions of the same row had drifted apart,
and a positional format has no way to say so.

**26 July 2026.** Python evaluated for the Code nodes and rejected. See decision record
0003.

**27 July 2026.** Writing this document exposed three gaps between what the system
claimed and what it did, and the system was changed rather than the claims softened.
Backup placement, the `_declined` terminal state, and backup retention. See decision
record 0004. Verified across two runs: the declined path produced no backup and routed
to `_declined`, and the approved path wrote the edit, took one backup, and collapsed
`_backups` from twenty five files to the keep count in a single run.

**27 July 2026.** The retention branch silently did nothing on its first attempt. The
folder ID on `List Backups` was wrong, and On Error on that node had been set to
Continue from the start, so the node failed, emitted a single item carrying an error
key, and the downstream Code node filtered it out. The branch ran green having deleted
nothing. Build a branch loud, verify it, then make it quiet.

**27 July 2026.** `00 Error Handler` added and verified by deliberately reproducing the
same wrong folder ID with On Error set back to Stop Workflow. The scheduled sweep
failed and the email arrived within seconds.
