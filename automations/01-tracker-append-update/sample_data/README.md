# Sample pending files

Fictional. No real company, person or outcome appears here.

Each file is what the workflow actually consumes, one keyed field per line. Do not add
comment lines. Any line that does not begin with a recognised field name is folded into
the field above it, so a comment silently becomes part of the previous value.

`new-application.txt` exercises the append path. `ID: NEW` means the workflow reads the
sheet, takes the highest existing ID and adds one, so no caller has to guess a number.

`outcome-update.txt` exercises a partial update. Five lines change five cells and leave
the other fifteen exactly as they were. `Notes+` appends to the existing note rather
than overwriting it, so the history of an application survives.

`unknown-id.txt` is refused. ID 900 is not on the Applications tab, so the file is
rejected rather than appended, an alert email goes out, and the file lands in the
failed folder. Its explanation sits inside a `Notes+` value, which is safe only
because this file never reaches the sheet.
