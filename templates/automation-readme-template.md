# [Automation name]

Template. Copy this folder, fill each section, and delete every line that starts with a `>` before committing. If a section does not apply, delete the section rather than writing "N/A" under it. An empty heading reads as an unfinished document.

> [One paragraph. What this automation consumes, what it writes to, and what stands between the two. Written for somebody who has not read the architecture document and may never open the JSON.]

**Status.** [Built date. Any date it was significantly reworked. Node count in words. Whether it is active.]

## Input

> [What a file has to be named for this workflow to pick it up, and what has to be inside it. Give one complete example, short enough to read in ten seconds.]

```text
[example pending file]
```

> [If the format has special values, list them here with one line each. Anything a reader would otherwise have to infer from a Code node belongs in this section.]

## Flow

> [Node graph, copied from the architecture document so the two cannot drift. Branches shown explicitly. Name the nodes exactly as they are named on the canvas, because a reader with the JSON open should be able to match them without translating.]

## Nodes worth knowing about

> [Not every node. The ones where the configuration is load bearing, or where the obvious setting is the wrong one. Prose, one short paragraph each, with the node name in backticks so it can be found on the canvas.]

> [The test for including a node here: would somebody rebuilding this get it wrong by default? If the answer is no, leave it out and let the JSON speak.]

## Code

> [One entry per Code node. What it takes in, what it hands on, and any behaviour that is not obvious from the name. Link to the file in `code/` rather than pasting the source, so there is one copy of it.]

[`code/example.js`](code/example.js) [what it does, in a sentence or two.]

## What it refuses, and what happens then

> [The validation or approval this workflow applies, stated as cases. What the file does next in each case: which folder, and whether anybody is told.]

## Terminal states

> [Which folders a file can end in for this workflow, and what each one means. If this automation has fewer states than another in the repository, say why rather than leaving the reader to notice the gap.]

## Verification

> [What was actually run against this workflow, with dates, and what the result was. Only things that happened. A test that was intended and not run does not belong here, and a reader who finds one unverifiable stops trusting the rest of the document.]

## Setup

> [Credentials the workflow needs. The schedule. The error workflow, if it names one.]

Placeholders in `workflow.json`:

| **Placeholder** | **Stands for** |
|---|---|
| `EXAMPLE_FOLDER_ID` | [what it is] |

## Limitations

> [Specific to this automation. The general ones live in the architecture document, so link there rather than repeating them. Real limitations only. A list that reads as modesty rather than as fact is worse than no list.]

## Decisions that shaped this

[0000](../../docs/decisions/0000-example.md), [one line on what it decided and why it matters here.]
