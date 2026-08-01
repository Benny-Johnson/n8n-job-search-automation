const HEADERS = ["ID","Date Applied","Who","Company","Role Title","Location","Track",
  "Posted Range","My Number","Source","Resume Version","Cover Letter","Method","Status",
  "Last Update","Follow-up Due","Follow-up Sent","Contact","Notes","Furthest Stage"];

const parsed = $('Parse Pending File').first().json;
const rows = $input.all().map(i => i.json);
const errors = [];

if (parsed.parseError) {
  return [{ json: { valid: false, op: "INVALID", reason: parsed.parseError,
    fileName: parsed.fileName, row: {} } }];
}

const fields = { ...parsed.fields };
const known = new Set(HEADERS);
for (const k of Object.keys(fields)) {
  if (!known.has(k)) errors.push(`Unknown field name "${k}".`);
}

const idRaw = String(fields.ID || "").trim();
let op = null;
let targetRow = null;

if (idRaw === "" || idRaw.toUpperCase() === "NEW") {
  op = "APPEND";
  const ids = rows.map(r => parseInt(r.ID, 10)).filter(n => !isNaN(n));
  fields.ID = String((ids.length ? Math.max(...ids) : 0) + 1);
} else {
  targetRow = rows.find(r => String(r.ID).trim() === idRaw) || null;
  if (targetRow) {
    op = "UPDATE";
  } else {
    op = "INVALID";
    errors.push(`ID ${idRaw} is not on the Applications tab. Refusing to create a row under a supplied ID.`);
  }
}

if (op === "APPEND") {
  for (const req of ["Who", "Company", "Role Title", "Status"]) {
    if (!fields[req]) errors.push(`New application is missing ${req}.`);
  }
  const key = r => ["Who", "Company", "Role Title"]
    .map(h => String(r[h] || "").trim().toLowerCase()).join("::");
  const dup = rows.find(r => key(r) === key(fields));
  if (dup && !parsed.allowDuplicate) {
    errors.push(`Looks like a duplicate of ID ${dup.ID}. Add a line reading "Allow Duplicate: yes" to override.`);
  }
}

if (parsed.notesAppend) {
  const existing = targetRow ? String(targetRow.Notes || "").trim() : "";
  fields.Notes = existing ? `${existing} | ${parsed.notesAppend}` : parsed.notesAppend;
}

for (const k of Object.keys(fields)) {
  if (fields[k] === "CLEAR") fields[k] = "";
}

return [{ json: {
  valid: errors.length === 0 && op !== "INVALID",
  op,
  reason: errors.join(" "),
  fileName: parsed.fileName,
  row: fields
}}];
