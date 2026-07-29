# Tracker Append/Update

Reads small plain text files dropped into a Google Drive folder and turns each one into a row on the Applications tab of a Google Sheet, either creating a new row or updating an existing one. Nothing waits for a human. A file that does not survive validation is refused, reported by email, and moved out of the way rather than written in a damaged form.

**Status.** Built 20 July 2026 as an append only flow. Reworked into an upsert and re-architected onto a scheduled sweep on 23 July 2026. Sixteen nodes. Active.

## Input

A file is picked up if its name starts with `TRACKER_PENDING`. The convention in use is `TRACKER_PENDING_[YYYY-MM-DD]_[HHMM]_[Company]`, plain text, with conversion to Google format switched off.

Inside, one field per line, written as `Field: value`. Position carries no meaning, and a field that is not mentioned is not written. A new application:

```text
ID: NEW
Date Applied: 2026-07-24
Who: Sam
Company: Northwind Logistics
Role Title: Financial Analyst
Location: Remote
Track: US
Posted Range: $60K - $75K
My Number: $70K
Source: Company careers page
Resume Version: Financial Analyst (tailored)
Cover Letter: Yes
Method: Workday
Status: Applied
Last Update: 2026-07-24
Follow-up Due: 2026-08-07
Follow-up Sent: No
Contact: UNKNOWN
Notes: Applied through their own portal rather than a job board.
Furthest Stage: Application only
```

An outcome on an existing application is three or four lines, and cannot damage a field it does not mention:

```text
ID: 14
Status: Rejected
Last Update: 2026-08-01
Furthest Stage: Recruiter screen
Notes+: Rejected after the screen. They wanted day to day reps this background does not have.
```

Four values behave specially.

`ID: NEW` asks the workflow to assign the number itself, so no conversation has to guess it. An ID that is supplied but is not already on the sheet is refused rather than appended.

`Notes+` appends to the existing note with a pipe separator instead of overwriting it, so the history of an application survives its outcome.

`CLEAR` writes an empty cell, which is how a field gets deliberately blanked now that omitting it means leave alone.

`Allow Duplicate: yes` overrides the duplicate check, for a genuine second application to the same person, company and role.

A line that does not begin with a recognised field name is folded into the field above it, so a wrapped line is not a lost line. The consequence is that a continuation line must never itself start with something that looks like `Field: value`.

## Flow

```text
Schedule Trigger -> List Inbox -> Filter -> Loop Over Items
Loop Over Items [loop] -> Claim File -> Download file -> Extract from File
  -> Parse Pending File (Code) -> Get Rows -> Resolve and Validate (Code) -> If
If [true]  -> Row Only (Code) -> Upsert Row     -> Move to Done   -> Loop Over Items
If [false] -> Send a message  -> Move to Failed -> Loop Over Items
```

`Move to Done` and `Move to Failed` return to the loop independently. Neither feeds the other, which is what keeps `_failed` from emptying itself on the next pass. The loop's done output is unconnected.

## Nodes worth knowing about

`Filter` keeps names starting with `TRACKER_PENDING`. That prefix is the entire routing mechanism between this workflow and the other one sweeping the same folder.

`Claim File` moves the file to `_processing` and addresses it as `{{ $json.id }}`, because at that point the incoming item is still the loop item. Every node after the claim addresses the file as `{{ $('Loop Over Items').item.json.id }}` instead. After the move, `$json` refers to the output of the move node, whose shape varies between node versions, and referring back to the loop item is stable.

`Get Rows` reads the Applications tab with no filter configured, so it returns the whole sheet. One call answers three questions at once. Does the supplied ID exist, what is the highest ID currently in use, and what does the existing Notes cell say, so an append can be built rather than an overwrite.

`Upsert Row` is Append or Update Row, matching on the `ID` column, mapping mode set to automatic, and handling of extra fields set to ignore. That last setting carries more weight than it looks. The default inserts a new column for any unrecognised field, so a single typo in a pending file would grow a twenty first column and the Dashboard tab's formulas would begin reading a sheet whose shape had moved underneath them.

`Send a message` is a plain Gmail send rather than send and wait. Nothing here is waiting on an answer. The message names the file and the reason it was refused.

## Code

Three Code nodes, all JavaScript. Decision record 0003 covers why they are not Python.

[`code/parse-pending-file.js`](code/parse-pending-file.js) turns the file text into a field map. It reads keyed lines against a fixed list of twenty column names plus `Notes+` and `Allow Duplicate`. If the file contains no keyed fields at all it falls back to the older positional format, splitting the first line containing a pipe against the same twenty names, with a guard that folds surplus values into Notes. That fallback is still live, for files written before the format changed. It is also the mechanism behind the defect described under verification below.

[`code/resolve-and-validate.js`](code/resolve-and-validate.js) is where a file becomes a decision. It takes the parsed fields from `Parse Pending File` and the sheet rows from its own input, works out whether this is an append or an update, assigns the next ID when asked to, builds the appended note, applies `CLEAR`, and returns a wrapper object carrying `valid`, `op`, `reason`, `fileName` and `row`.

[`code/row-only.js`](code/row-only.js) unwraps that object and returns the row alone. It exists because automatic mapping reads the top level keys of its input, so passing the wrapper to the Sheets node would map `valid` and `op` and `reason` into columns rather than the row.

## What it refuses, and what happens then

Four cases, all decided in `Resolve and Validate`.

A field name that is not one of the twenty columns. An ID that is supplied but is not on the sheet, because appending under an unknown key forks a record silently and leaves two rows each holding part of the truth. A new application missing Who, Company, Role Title or Status. An apparent duplicate, meaning an append whose Who plus Company plus Role Title already exist, unless the file carries `Allow Duplicate: yes`.

In every case the file takes the false branch, an email arrives naming the file and the reason, and the file moves to `_failed`. Nothing is written. Several of these would have written something wrong and said nothing under the append only design.

## Terminal states

`_done` for an applied write, `_failed` for a refusal, `_processing` for a file still in flight or left behind by a run that did not finish. There is no `_declined` here, because nothing in this workflow asks a human anything. The reasoning behind the asymmetry between the two automations is in [`docs/architecture.md`](../../docs/architecture.md).

## Verification

**23 July 2026.** Run with four files present at once: a new application, an unknown ID, a duplicate, and a real outcome update. Result was two writes, two alert emails, and correct routing, with the two refused files ending in `_failed` and staying there.

**23 July 2026.** A defect found and repaired, and it is the best evidence in this repository for why the format changed. The standing protocol that generates pending files specified nineteen fields ending at Notes. The sheet has twenty, ending at Furthest Stage. A pending file carried twenty positional values, and the parser's overflow guard did exactly what it was built to do, folding the surplus into the Notes cell. The correct value for Furthest Stage was appended to the end of a note. Nothing failed and the row looked plausible. Two definitions of the same row had drifted apart and a positional format had no way to say so. The first production write of the reworked workflow was repairing the row the old one damaged.

## Setup

Credentials: Google Drive OAuth2, Google Sheets OAuth2, Gmail OAuth2. The schedule trigger runs on a ten minute interval. The workflow names `00 Error Handler` as its error workflow in workflow settings.

Placeholders in `workflow.json`:

| **Placeholder** | **Stands for** |
|---|---|
| `INBOX_FOLDER_ID` | Drive folder the sweep lists |
| `PROCESSING_FOLDER_ID` | Claim folder, holds files in flight |
| `DONE_FOLDER_ID` | Successful terminal state |
| `FAILED_FOLDER_ID` | Refused terminal state |
| `TRACKER_SHEET_ID` | The Google Sheet holding the application log |
| `CREDENTIAL_ID` | An n8n credential reference, never a secret |

n8n stores credentials separately from workflows, so an export carries only a reference by name and ID. No secret was ever present in these files.

## Limitations

`Get Rows` reads the entire Applications tab for every file. At a few hundred rows that is one API call and no meaningful cost, and it is not a pattern that survives a large sheet. It is one of the reasons a database would eventually be the answer.

The Code nodes assume batch size 1. Two of the three call `.first()` on their input or on a named node. Raising the batch size would not make this faster, it would silently process one file per batch.

The positional parser is still live as a fallback. It is dead weight once the last old file is gone, and it is kept deliberately rather than by neglect.

General limitations of both automations, including what the error handler does not catch, are in [`docs/architecture.md`](../../docs/architecture.md).

## Decisions that shaped this

[0001](../../docs/decisions/0001-schedule-sweep-over-drive-change-trigger.md), sweeping a folder on a schedule rather than subscribing to Drive's change feed, which is why this workflow lists `_inbox` and claims by move.

[0002](../../docs/decisions/0002-upsert-by-natural-key-with-partial-updates.md), the keyed line format, `ID: NEW`, and matching on ID so an update touches only the fields it names. This is the record that explains most of this document.

[0003](../../docs/decisions/0003-javascript-over-python-in-code-nodes.md), why the three Code nodes here are JavaScript.
