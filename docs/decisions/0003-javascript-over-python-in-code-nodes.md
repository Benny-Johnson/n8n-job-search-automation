# 0003. Keep the Code nodes in JavaScript

Status: Accepted, 26 July 2026

Amended 28 July 2026. The retention branch added by decision 0004 introduced a fifth
Code node one day after this record was accepted. The decision itself is unchanged and
the new node is JavaScript for the same reasons. The counts below have been corrected,
because a record that quietly disagrees with the repository it describes stops being
worth reading.

## Context

There are five Code nodes across the two workflows. Three parse, resolve and reshape
data in the tracker workflow. Two sit in the master context workflow, one building the
search and replacement strings and one selecting which backups to prune. All five are
JavaScript, which is the n8n default.

Python is the more natural language for data work and the one more often asked about
in analyst interviews, so it was worth checking whether these nodes could be written
in Python instead. The Code node offers Python as a language option, so on the face of
it this was a settings change.

It is not. There are two independent reasons, and they carry different weight, so the
evidence is separated here by how it was obtained.

**Tested directly on this install.** A two line Python Code node on n8n 2.30.8, self
hosted, installed through npm on Windows, returns
`Python runner unavailable: Python 3 is missing from this system`. No Python 3 binary
is visible to n8n on that machine.

**Observed directly in the editor.** The Code node's own hint text states that the
Python option supports `_items` in all items mode and `_item` in per item mode. It
offers no equivalent of `$('Node Name')`.

**Read in issue trackers and release notes, not verified here.** That n8n v2 removed
Pyodide. That the replacement native runner resolves a hardcoded Linux path to its
virtual environment. That the `@n8n/task-runner-python` package is missing from the
published npm release. That Windows users who installed Python 3 and set
`N8N_PYTHON_BINARY` still report failures. That standard library imports are disabled
by default and require an allowlist entry, which on this install would mean building a
custom Docker image.

**Independent of the runtime entirely.** Three of the five Code nodes take input from a
node other than the one immediately upstream. `Parse Pending File` reads the file
contents from its own input and the filename through `$('Loop Over Items')`.
`Resolve and Validate` reads the sheet rows from its own input and the parsed file
through `$('Parse Pending File')`. `Row Only` sits downstream of an If node and reads
`$('Resolve and Validate')`. With no cross node reference available in Python, a
translation would have required restructuring the data flow, most likely with a Merge
node feeding both sources into a single input. That is a rewrite of the pipeline
rather than a change of language, and it would have been true even with a working
Python runtime.

The two nodes in the master context workflow read only their own input, so the cross
node argument does not apply to them. The runtime argument still does.

## Decision

The Code nodes stay in JavaScript. n8n keeps the orchestration.

Python is planned as a separate portable module, outside n8n, sharing no code with
these workflows. It does not exist yet. When it does it will live in `lib/` in this
repository with its own README, and the status line above will change from planned to
built.

## Consequences

The workflows work today, which they would not have if this had been treated as a
settings change and pushed through.

The runtime question is settled and written down, so it does not get re-opened every
time Python comes up.

Anyone reading this repository sees JavaScript in the Code nodes and JavaScript in
`code/`. Nothing here claims Python powers any part of the running system, because it
does not.

The evaluation produced no running code. That is the honest cost of it. What it bought
was a decision with evidence behind it rather than an assumption, and a clear boundary
between what was tested and what was read, which is the more defensible position if
somebody asks.

## What would change this

Two things, both of them, not either.

Moving the n8n install to Docker, which removes the runtime problem and turns the
standard library allowlist into a build step rather than a blocker.

Proving that a Merge node can feed both the parsed file and the sheet rows into a
single Code node input without losing the pairing between them. Until that is
demonstrated on a real execution, the cross node reference problem stands on its own,
and fixing the runtime alone would not be enough.
