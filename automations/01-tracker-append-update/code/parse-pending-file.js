const HEADERS = ["ID","Date Applied","Who","Company","Role Title","Location","Track",
  "Posted Range","My Number","Source","Resume Version","Cover Letter","Method","Status",
  "Last Update","Follow-up Due","Follow-up Sent","Contact","Notes","Furthest Stage"];
const KEYS = new Set([...HEADERS, "Notes+", "Allow Duplicate"]);

const text = String($input.first().json.data || "").replace(/\r/g, "");
const lines = text.split("\n");

const fields = {};
let notesAppend = null;
let allowDuplicate = false;
let lastKey = null;
let keyed = false;

for (const raw of lines) {
  const m = raw.match(/^([A-Za-z][A-Za-z0-9 +\-]*?)\s*:\s*(.*)$/);
  if (m && KEYS.has(m[1].trim())) {
    keyed = true;
    const k = m[1].trim();
    const v = m[2].trim();
    if (k === "Notes+") { notesAppend = v; lastKey = "Notes+"; }
    else if (k === "Allow Duplicate") { allowDuplicate = /^y/i.test(v); lastKey = null; }
    else { fields[k] = v; lastKey = k; }
  } else if (lastKey && raw.trim() !== "") {
    if (lastKey === "Notes+") notesAppend = ((notesAppend || "") + " " + raw.trim()).trim();
    else fields[lastKey] = ((fields[lastKey] || "") + " " + raw.trim()).trim();
  }
}

if (!keyed) {
  const rowLine = lines.find(l => l.includes("|"));
  if (!rowLine) {
    return [{ json: { parseError: "No keyed fields and no pipe row found in this file." } }];
  }
  const parts = rowLine.split("|").map(s => s.trim());
  const notesIdx = HEADERS.indexOf("Notes");
  const extra = parts.length - HEADERS.length;
  if (extra > 0) {
    const folded = parts.splice(notesIdx, extra + 1).join(" | ");
    parts.splice(notesIdx, 0, folded);
  }
  HEADERS.forEach((h, i) => {
    if (parts[i] !== undefined && parts[i] !== "") fields[h] = parts[i];
  });
}

for (const k of Object.keys(fields)) {
  if (fields[k] === "") delete fields[k];
}

return [{ json: {
  fields,
  notesAppend,
  allowDuplicate,
  fileName: $('Loop Over Items').first().json.name || "unknown file"
}}];
