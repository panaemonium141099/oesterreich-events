import { readFileSync } from 'node:fs';
import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';
const html = readFileSync(`${process.env.USERPROFILE}/tel.html`, 'utf-8');
console.log(JSON.stringify(extractGem2goDetail(html), null, 2));
