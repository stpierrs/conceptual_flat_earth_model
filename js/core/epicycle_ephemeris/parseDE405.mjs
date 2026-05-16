#!/usr/bin/env node
// Parse cached AstroPixels HTML into de405_reference.json
import { readFileSync, writeFileSync } from 'node:fs';

const MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
const PREFIX_RE = /^\s*([A-Z][a-z][a-z])\s+(\d+)\b/;
const RADEC_RE  = /\b(\d{1,2})\s+(\d{1,2})\s+(\d{1,2}\.\d+)\s+([+-]\d{1,2})\s+(\d{1,2})\s+(\d{1,2}\.\d+)\b/;

const RAD = Math.PI/180, DEG = 180/Math.PI;

function parseHTML(html, year) {
  const rows = [];
  for (const line of html.split(/\r?\n/)) {
    const pm = line.match(PREFIX_RE);
    if (!pm) continue;
    const mon = MONTHS[pm[1]];
    const day = parseInt(pm[2],10);
    if (mon === undefined) continue;
    const m = line.match(RADEC_RE);
    if (!m) continue;
    const [,rh,rm,rs,ds,dm,dss] = m;
    const raSec   = (+rh)*3600 + (+rm)*60 + (+rs);
    const decSign = ds.startsWith('-') ? -1 : 1;
    const decArcs = decSign*(Math.abs(+ds)*3600 + (+dm)*60 + (+dss));
    // Convert to radians for use in calibration
    const ra  = (raSec  / 240) * RAD;   // raSec/240 = degrees; ×RAD = radians
    const dec = (decArcs / 3600) * RAD;
    const ts  = Date.UTC(year, mon, day, 0, 0, 0);
    rows.push({ ts, ra, dec });
  }
  return rows;
}

const BODIES = ['sun','mars','jupiter','saturn','venus','mercury'];
const YEARS  = [2019,2020,2021,2022,2023,2024];
const result = {};

for (const body of BODIES) {
  result[body] = [];
  for (const year of YEARS) {
    const f = `/tmp/de405_cache/${body}${year}.html`;
    try {
      const html = readFileSync(f,'utf8');
      const rows = parseHTML(html, year);
      result[body].push(...rows);
    } catch(e) { console.error(`Missing: ${f}`); }
  }
  console.log(`${body}: ${result[body].length} rows`);
}

writeFileSync('/home/claude/epicycle_ephemeris/de405_reference.json', JSON.stringify(result));
const total = Object.values(result).reduce((s,a)=>s+a.length,0);
console.log(`\nWrote de405_reference.json  (${total} total rows, ${(JSON.stringify(result).length/1024/1024).toFixed(1)} MB)`);
