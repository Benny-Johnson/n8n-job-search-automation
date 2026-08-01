const e = $input.first().json.output;
const clean = (t) => (t ?? '').replace(/\*\*/g, '');

let searchFor, replaceWith;
if (e.action === 'ADD') {
  const anchor = `[[S${e.section}]]`;
  searchFor = anchor;
  replaceWith = clean(e.new_text) + '\n\n' + anchor;
} else {
  searchFor = clean(e.search_text);
  replaceWith = clean(e.new_text);
}

return [{ json: { searchFor, replaceWith,
  summary: e.summary, action: e.action, section: e.section } }];
