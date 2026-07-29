# 0002. Upsert on a natural key, with partial field updates

Status: Accepted, 23 July 2026

## Context

The tracker Sheet holds one row per application across twenty columns, from ID through
to Furthest Stage. Applications are not written once. A row is created when an
application goes out, changed when a recruiter replies, changed again when a screen
happens, and changed again on the outcome. The interesting information accumulates in
the Notes column.

The first build only appended. Every pending file carried a full row, written as pipe
separated values in positional order, and every event added a new line to the sheet.
Three problems followed.

The conversation writing the file had to supply an ID, which meant guessing the next
number or reading the sheet first. A wrong guess forks a record silently, leaving two
rows that each hold part of the truth.

An outcome update had to restate the entire row, because in a positional format a
blank field and a deliberately cleared field look identical. Restating a twenty field
row weeks later is how a row acquires details that were never true.

And the format was positional, which is the part that actually bit.

On 23 July 2026 a pending file was written for row 21 carrying twenty values. The
standing protocol that generates those files listed nineteen fields, ending at Notes.
The sheet has twenty, ending at Furthest Stage. The parser had an overflow guard for
stray pipe characters inside free text, and it did exactly what it was built to do. It
saw one more value than the header list expected and folded the surplus into Notes.
The correct value for Furthest Stage was appended to the end of a note.

Nothing failed. The row looked plausible. Two definitions of the same row had drifted
apart, and the format had no way to say so.

## Decision

Three changes, taken together.

**Keyed lines instead of positional values.** A pending file is now one field per
line, written as `Field: value`. Position carries no meaning. A field that is not
mentioned is not written.

**`ID: NEW` instead of a supplied number.** The workflow reads the Applications tab,
takes the highest existing ID and adds one. A supplied ID that is not already on the
sheet is refused rather than appended, because appending under an unknown key is the
fork this is meant to prevent.

**Append or Update Row, matching on the ID column.** One node handles both cases. New
applications append. Outcomes update, and every column not named in the file is left
exactly as it was.

Four supporting behaviours come with it. `Notes+` appends to the existing note with a
pipe separator rather than overwriting, so the history of an application survives.
`CLEAR` as a value writes an empty cell, which is how a field gets deliberately blanked
now that omission means leave alone. An append whose Who, Company and Role Title
already exist is refused as a probable duplicate unless the file carries
`Allow Duplicate: yes`. And extra field handling on the Sheets node is set to ignore,
so an unrecognised field name cannot grow a twenty first column and move the sheet out
from under the Dashboard formulas.

The parser still accepts the old positional format when a file contains no keyed lines
at all. That fallback is kept for files written before the change, and it retains the
overflow guard described above.

## Consequences

An outcome update is now three or four lines instead of twenty values, and it cannot
damage a field it does not mention. Day to day, that is the change that matters most.

No conversation has to know or guess an ID for a new application.

A whole class of failure moved from silent to loud. An unknown ID, a missing required
field or a suspected duplicate now produces a refusal, an email naming the file and
the reason, and a move to `_failed`. Several of those would previously have written
something wrong and said nothing.

The workflow now reads the entire Applications tab on every file, which it did not do
before. At a few hundred rows that is one API call and no meaningful cost. It is not a
pattern that scales to a large sheet, and it is one of the reasons a real database
would eventually be the answer.

Validation logic now lives in a Code node rather than in the shape of the data. That
is more code to maintain, and it is worth it, because the shape of the data was the
thing that failed.

The first production write of the new workflow was repairing row 21, the row damaged
by the old one.

## What would change this

Moving the tracker off Google Sheets. A Sheet is a reasonable store for a few hundred
rows edited by one person, and a poor one for anything with real concurrency or
referential integrity. If this became a database, matching on ID would become a
primary key, the duplicate check would become a unique constraint, and most of
`Resolve and Validate` would stop being application code.

The keyed line format on the input side would survive that move unchanged, which is a
point in its favour. The decision recorded here is really two decisions bundled, and
only the storage half is fragile.
