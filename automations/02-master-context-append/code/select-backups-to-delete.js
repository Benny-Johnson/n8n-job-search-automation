// Keep the newest N backups of the master context Doc, delete the rest.
// Backup names end in yyyy-MM-dd_HHmm, which sorts lexicographically in
// chronological order, so there is no date parsing to get wrong.

const KEEP = 5;

const backups = $input.all()
  .map(item => item.json)
  .filter(f => String(f.name || '').startsWith('MASTER_CONTEXT_backup_'));

backups.sort((a, b) => String(b.name).localeCompare(String(a.name)));

return backups.slice(KEEP).map(f => ({ json: { id: f.id, name: f.name } }));
