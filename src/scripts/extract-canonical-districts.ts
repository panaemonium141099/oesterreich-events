// One-shot helper: dump every canonical district from districtsAT.ts as
// SQL VALUES rows so the constraint migration can stay self-contained
// without manually re-typing 117 names. Output goes to stdout.
import { DISTRICTS_BY_BUNDESLAND } from '../lib/districtsAT';

const rows: string[] = [];
for (const [bl, ds] of Object.entries(DISTRICTS_BY_BUNDESLAND)) {
  for (const d of ds) {
    rows.push(`('${bl}', '${d.name.toLowerCase().replace(/'/g, "''")}')`);
  }
}
console.log(`-- ${rows.length} canonical districts`);
console.log(rows.join(',\n'));
