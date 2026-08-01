# Master Context Append

Reads plain text files dropped into a Google Drive folder and applies each one as an edit to a Google Doc, the document that holds the strategy behind the job search. An LLM node turns the file into structured fields, a Gmail node sends the exact text the workflow will search for and the exact text it will write, and the execution parks until that email is answered. Approving takes a backup and writes. Declining writes nothing.

**Status.** Built 21 July 2026. Re-architected onto a scheduled sweep 23 July 2026. Backup lifecycle rebuilt 27 July 2026. Nineteen nodes. Active.

## Input

A file is picked up if its name starts with `CONTEXT_PENDING`. The convention in use is `CONTEXT_PENDING_[YYYY-MM-DD]_[HHMM]_[slug]`, plain text, with conversion to Google format switched off. The time is part of the name so two edits to the same section on the same day cannot collide.

The contents are read as prose rather than parsed, because the input is closer to a note written in a hurry than to a fixed set of known keys. A file needs to make four things recoverable: whether it is an ADD or a REPLACE, which section it targets, the text to write, and for a REPLACE the existing text to find.

```text
Section: 7
Action: ADD
New text:
SQL sprint venue, decided 22 July 2026. The sprint runs inside a Snowflake 30 day
free trial rather than a local environment, for near zero setup friction and because
standard SQL transfers to any warehouse. Cost guard: set warehouse auto suspend on
day one.
```

Four working rules, learned rather than designed.

**One operation per file.** The extractor returns exactly one action, section, search text and new text. A file holding two edits gets flattened into one corrupted edit. Two changes means two files.

**Prefer ADD over REPLACE.** An ADD targets an anchor token that is known to exist and always lands. A REPLACE depends on quoting the live document perfectly.

**REPLACE search text must be verbatim plain text**, quoted from a live read of the Doc at the moment the file is written, never paraphrased and never reconstructed. No markdown syntax, because the Doc stores formatting as styling rather than as characters, so a hash mark or an asterisk in the search string guarantees zero matches.

**A REPLACE that matches nothing is a silent no-op.** The workflow runs green and writes nothing. The approval email is the only checkpoint that catches it, which is why the email quotes the search string in full.

## Flow

```text
Schedule Trigger -> List Inbox -> Filter -> Loop Over Items
Loop Over Items [loop] -> Claim File -> Download file -> Extract from File
  -> Information Extractor -> Build Replacement (Code)
  -> Send message and wait for response -> If
If [true]  -> Copy file -> Update a document -> Move to Done -> Loop Over Items
                        -> List Backups -> Select Backups to Delete (Code) -> Delete Backup
If [false] -> Move to Declined -> Loop Over Items
Anthropic Chat Model --(ai_languageModel)--> Information Extractor
```

`Copy file` feeds two branches. One writes the document. The other prunes old backups.

## Nodes worth knowing about

`Filter` keeps names starting with `CONTEXT_PENDING`. The other automation sweeping this same folder keeps `TRACKER_PENDING`, and that prefix split is the whole routing mechanism between them.

`Claim File` moves the file to `_processing` as the first action inside the loop, and the reason is re-entrancy rather than concurrency. This workflow parks on an unanswered approval email, sometimes for hours. Without the claim, every sweep during that wait would list the same file again and send another approval email. It addresses the file as `{{ $json.id }}`, and every node after it uses `{{ $('Loop Over Items').item.json.id }}` instead, because after the move `$json` refers to the output of the move node.

`Information Extractor` is backed by a Claude Haiku 4.5 sub node and returns five named attributes: `action`, `section`, `search_text`, `new_text` and `summary`. The fifth one does no work in the flow. It exists to become the subject line of the approval email, so the inbox shows what an edit is for without the message having to be opened.

`Send message and wait for response` is a Gmail node in send and wait mode, configured for double approval, so the Approve button asks for confirmation. The body carries the action, the target section, the exact string the workflow will find, and the exact string it will write. Given that a failed REPLACE is silent, that preview is the real safety mechanism in this workflow, more than the backup is.

`Copy file` sits inside the true branch, between the approval check and the write. It copies the Doc into `_backups` as `MASTER_CONTEXT_backup_{{ $now.format('yyyy-MM-dd_HHmm') }}`. It used to sit ahead of the approval email, which produced backups for edits nobody applied and, worse, took the snapshot at the moment approval was requested rather than at the moment of the write. Decision record 0004 covers the move.

`Update a document` performs a single `replaceAll` action, taking both strings from `Build Replacement`.

## Code

One Code node in this workflow, plus one in the retention branch. Both JavaScript, for the reasons in decision record 0003.

[`code/build-replacement.js`](code/build-replacement.js) turns the extracted fields into the two strings the Docs API needs. For an ADD it builds an anchor token, `[[S7]]` for section 7, sets that token as the search string, and sets the replacement to the new text followed by a blank line and the token again. The effect is an insertion, expressed as a replacement, using an anchor that survives its own use. Every section of the target document ends with one of these tokens for exactly this purpose. For a REPLACE both strings pass through as written. In both branches a helper strips `**` from the text, because the Doc stores bold as styling rather than as characters, so asterisks would never match anything.

[`code/select-backups-to-delete.js`](code/select-backups-to-delete.js) returns everything past the newest five. It sorts the filenames as text rather than parsing dates, which works because the naming pattern runs from most significant field to least, so it sorts chronologically as a string. There is no date parsing to get wrong and no timezone to be wrong about.

## What it refuses, and what happens then

Nothing, by design. This workflow has no validation branch and no `_failed` folder, because the gate is a person rather than a rule. Approving takes the backup and writes. Declining moves the file to `_declined`, and a declined edit is not an error, it is the system working.

The other automation in this repository does the opposite, and the reasoning behind that asymmetry is in [`docs/architecture.md`](../../docs/architecture.md).

## Terminal states

`_done` for an applied edit, `_declined` for one that was reviewed and turned down, `_processing` for a file still in flight or left behind by a run that did not finish. Until 27 July 2026 the declined files landed in `_done` alongside the applied ones, which quietly broke the claim that folder counts alone report what happened.

## Verification

**23 July 2026.** Run with two pending files present at once, producing two sequential approval emails and two separate writes. That also verified the batch size 1 loop rather than leaving it as an intention.

**27 July 2026.** Two runs against a purpose built pending file targeting section 13 of the document, which is the open questions section and therefore harmless to write to. The declined run produced no backup, wrote nothing, and moved the file to `_declined`. The approved run wrote the edit, took one backup, and collapsed `_backups` from twenty five files to the keep count in a single execution. Twenty three deletions in one pass also demonstrated that the delete step iterates rather than handling only the first item.

**27 July 2026.** The retention branch silently did nothing on its first attempt. The folder ID on `List Backups` was wrong, and On Error on that node had been set to Continue from the start, so the node failed, emitted a single item carrying an error key, and the downstream Code node filtered it out as not matching the backup name pattern. The branch ran green having deleted nothing. The rule that came out of it is in decision record 0004: build a branch loud, verify it, and only then make it quiet.

## Setup

Credentials: Google Drive OAuth2, Google Docs OAuth2, Gmail OAuth2, and an Anthropic API key for the chat model sub node. The schedule trigger runs on a ten minute interval.

The target document needs an anchor token at the end of every section, `[[S1]]` through to the last one, or an ADD has nothing to attach to.

Placeholders in `workflow.json`:

| **Placeholder** | **Stands for** |
|---|---|
| `INBOX_FOLDER_ID` | Drive folder the sweep lists |
| `PROCESSING_FOLDER_ID` | Claim folder, holds files in flight |
| `DONE_FOLDER_ID` | Applied terminal state |
| `DECLINED_FOLDER_ID` | Reviewed and rejected terminal state |
| `BACKUPS_FOLDER_ID` | Timestamped copies of the document |
| `MASTER_CONTEXT_DOC_ID` | The Google Doc this workflow edits |
| `CREDENTIAL_ID` | An n8n credential reference, never a secret |

n8n stores credentials separately from workflows, so an export carries only a reference by name and ID. No secret was ever present in these files.

## Limitations

A `replaceAll` that matches nothing reports success. The workflow runs green and writes nothing, and no folder count shows it, because the file still lands in `_done`. Reading the approval email before approving is the only defence, and preferring ADD is the way to avoid needing one.

Retention is by count rather than by age. Five copies is roughly a week of quiet use and under two days of heavy use, so nothing guarantees a minimum span of history.

The extraction is an LLM reading prose, which is the right tool for the input and is not deterministic. The approval preview exists partly because of that.

General limitations of both automations, including what the error handler does not catch, are in [`docs/architecture.md`](../../docs/architecture.md).

## Decisions that shaped this

[0001](../../docs/decisions/0001-schedule-sweep-over-drive-change-trigger.md), sweeping a folder on a schedule rather than subscribing to Drive's change feed. The claim step in this workflow is a direct consequence, and this is the workflow that made it necessary.

[0004](../../docs/decisions/0004-backup-lifecycle-and-retention.md), taking the backup inside the approved branch, adding `_declined`, and capping retention at five.

[0003](../../docs/decisions/0003-javascript-over-python-in-code-nodes.md), why the Code nodes here are JavaScript.
