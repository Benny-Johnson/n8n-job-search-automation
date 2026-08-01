# n8n Job Search Automation

Two n8n workflows that keep the records of a job search accurate without anybody maintaining them by hand. One writes to a Google Sheet holding every application and its outcome. The other edits a Google Doc holding the strategy behind those applications.

They have run against real data since 20 July 2026. Both have since been broken by things that were not obvious in advance, diagnosed, and rebuilt. Most of what is interesting in this repository is in that second sentence, so the reasoning is written down properly in [`docs/decisions/`](docs/decisions/README.md) rather than summarised into a feature list.

## The problem

Updates to both documents are drafted in a chat assistant during ordinary work. That assistant can create a file in Google Drive but cannot edit an existing Doc or Sheet in place. So an update leaves the conversation as a small plain text file dropped into a Drive folder, and something else has to apply it.

That framing makes it sound like a data entry problem. It is not. The real problem is accepting instructions from a source that is fast, helpful and occasionally wrong, and applying them to documents that later work reads as ground truth. Almost every design choice here follows from that.

## The automations

| **#** | **Automation** | **Reads** | **Writes to** | **Gate before writing** | **Nodes** |
|---|---|---|---|---|---|
| 01 | [Tracker Append/Update](automations/01-tracker-append-update/README.md) | `TRACKER_PENDING_*` | Applications tab of a Google Sheet | Automated validation | Sixteen |
| 02 | [Master Context Append](automations/02-master-context-append/README.md) | `CONTEXT_PENDING_*` | A Google Doc | Human approval by email | Nineteen |

A third workflow, `00 Error Handler`, has no schedule and no inbox. Both automations name it as their error workflow, and it emails on a failed execution.

## How it works, briefly

Both automations sweep the same Drive folder every ten minutes and list everything currently in it. The filename prefix is the only thing that routes a file to one workflow rather than the other, so a third automation can be added by choosing a new prefix without touching either existing flow.

Each file is processed on its own, and the first action taken on it is a move to a `_processing` folder, which is what removes it from the queue. Every file ends in exactly one of four folders, so folder counts alone report the health of the system without opening n8n.

The two workflows are deliberately not symmetrical. A tracker row is low stakes and relatively frequent, so it is validated by code and written without asking, and a bad file produces an alert and lands in `_failed`. A change to the strategy document is infrequent and hard to reverse, so it gets a backup, a preview of the exact text it will search for and write, and a human answering an email. One workflow fails loudly. The other asks permission.

The full description is in [`docs/architecture.md`](docs/architecture.md), including the failure modes that are still open.

## Decision records

Four decisions have their own record, in the format Nygard proposed, each with a section on what would change it. They are the part of this repository most worth reading.

| **#** | **Decision** | **Status** |
|---|---|---|
| [0001](docs/decisions/0001-schedule-sweep-over-drive-change-trigger.md) | Sweep on a schedule instead of subscribing to Drive changes | Accepted |
| [0002](docs/decisions/0002-upsert-by-natural-key-with-partial-updates.md) | Upsert on a natural key, with partial field updates | Accepted |
| [0003](docs/decisions/0003-javascript-over-python-in-code-nodes.md) | Keep the Code nodes in JavaScript | Accepted, amended |
| [0004](docs/decisions/0004-backup-lifecycle-and-retention.md) | Back up inside the approved branch, and cap retention at five | Accepted |

Choices that follow from a decision already recorded are written up as consequences inside that record rather than given a number of their own, and choices where no real alternative was ever on the table are covered in the architecture document. Four records for two workflows is the honest count.

## Repository map

```text
README.md
LICENSE
.gitignore
docs/
  architecture.md            how the system works, and what it does not handle
  decisions/                 the four decision records, plus an index
automations/
  01-tracker-append-update/
    README.md
    workflow.json            scrubbed export, documentation not import
    code/                    the three Code nodes, as separate files
    sample_data/             fictional pending files, with a README
    assets/                  canvas and execution screenshots
  02-master-context-append/
    README.md
    workflow.json
    code/                    two Code nodes
    sample_data/
    assets/
templates/
  automation-readme-template.md
  CHECKLIST.md               run through this when adding an automation
```

Adding an automation is one folder copied from `templates/`, plus one row in the table above. Decision records are numbered across the whole repository rather than per automation, because a decision like the sweep pattern applies to every workflow here.

## What this repository is honest about

**The exported JSON is scrubbed.** Document IDs, folder IDs, credential references and email addresses are replaced with placeholders. The files are there to be read, not imported and run.

**The sample data is fictional.** The real tracker holds a real application history and it is not published here.

**The Code nodes are JavaScript.** A portable Python module is planned and does not exist. Decision record 0003 explains why the nodes are not Python, and separates what was tested on this install from what was read in issue trackers and not verified.

**It runs on one machine.** n8n is self hosted on a Windows laptop, so the automations run only while that machine is awake. The system tolerates hours of latency, so this costs nothing real, but it is a property of the deployment rather than a claim about the design.

## Stack

Self hosted n8n 2.30.8, installed through npm on Windows. Google Drive, Google Sheets and Google Docs through OAuth2. Gmail for alerts and for the approval gate. Claude Haiku 4.5 behind the Information Extractor node in automation 02. Five Code nodes in JavaScript.

## Licence

MIT. See [LICENSE](LICENSE).
