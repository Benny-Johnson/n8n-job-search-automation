# Adding an automation

Run through this every time. Six of these exist because something was forgotten once.

## Before it is a repository item at all

- [ ] The workflow has run unattended against real data at least once.
- [ ] It names `00 Error Handler` as its error workflow in workflow settings.
- [ ] Every file it consumes ends in exactly one terminal folder.
- [ ] I have deliberately broken one node and watched it fail the way I expected.

## Scrub

- [ ] Export the workflow fresh. Do not reuse an older export.
- [ ] Add any new folder or document ID to `ID_MAP` in `scrub_workflow.py` first.
- [ ] Run `scrub_workflow.py` against the fresh export.
- [ ] Read the audit output line by line. Do not assume it is clean.
- [ ] Search the scrubbed file for `cachedResultUrl`, `cachedResultName`, and my email
      address. Node types that cache display values hide real links in fields nobody
      thinks to check.

## Repository

- [ ] Copy `templates/automation-readme-template.md` into the new folder as `README.md`.
- [ ] `workflow.json`, the scrubbed export, renamed before upload.
- [ ] `code/`, one file per Code node, pasted verbatim from the export.
- [ ] `sample_data/`, fully fictional, including at least one file that fails validation.
- [ ] `sample_data/README.md` explaining what each file exercises. Do not put comments
      inside the sample files themselves; the parser folds unrecognised lines into the
      field above.
- [ ] `assets/`, canvas screenshot cropped to the canvas only.
- [ ] One row added to the automations table in the top level README.
- [ ] The repository map in the top level README updated, including any changed counts.

## Decisions

- [ ] Does anything here reverse or amend an existing record? Amend it.
- [ ] Does anything here need a new record? Only if the reasoning is invisible in the
      code and somebody would otherwise re-derive it or reverse it by accident.
      Consequences of an existing decision go inside that record, not into a new number.
- [ ] If a new record was added, add its row to the table in `docs/decisions/README.md`.
- [ ] If an existing record was amended, update its Status line and date.
- [ ] Numbering continues across the whole repository, not per automation.

## Honesty pass

- [ ] Every claim in the README is true of the export a reader can open.
- [ ] Node counts, Code node counts and folder counts match reality in every document
      that states them, including the older ones.
- [ ] Nothing is called production ready that has not run unattended.
- [ ] Anything planned rather than built is in future tense and marked as planned.
- [ ] Read the README as a stranger looking for a reason to stop reading.
