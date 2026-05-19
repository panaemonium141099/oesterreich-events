import { readFileSync } from 'node:fs';
import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';

const html = readFileSync(`${process.env.HOME ?? process.env.USERPROFILE}/mellau.html`, 'utf8');
const out = extractGem2goDetail(html);
console.log(JSON.stringify(out, null, 2));
