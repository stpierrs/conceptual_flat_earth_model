#!/usr/bin/env node
// fetchDE405.mjs — fetch live DE405 reference positions from astropixels.com
// Parses same format as scrape_astropixels.mjs, stores as JSON for calibration.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';

const BODIES = ['mars', 'jupiter', 'saturn', 'venus', 'mercury', 'sun'];
const YEARS  = [2019, 2020, 2021, 2022, 2023, 2024];
const CACHE  = '/tmp/de405_cache';
mkdirSync(CACHE, { recursive: true });

const URL = {
  sun:     y => `https://www.astropixels.com/ephemeris/sun/sun${y}.html`,
  moon:    y => `https://www.astropixels.com/ephemeris/moon/moon${y}.html`,
  mars:    y => `https://www.astropixels.com/ephemeris/planets/mars${y}.html`,
  jupiter: y => `https://www.astropixels.com/ephemeris/planets/jupiter${y}.html`,
  saturn:  y => `https://www.astropixels.com/ephemeris/planets/saturn${y}.html`,
  venus:   y => `https://www.astropixels.com/ephemeris/planets/venus${y}.html`,
  mercury: y => `https://www.astropixels.com/ephemeris/planets/mercury${y}.html`,
};

const PREFIX_RE = /^\s*([A-Z][a-z][a-z])\s+(\d+)\b/;
const RADEC_RE  = /\b(\d{1,2})\s+(\d{1,2})\s+(\d{1,2}\.\d+)\s+([+-]\d{1,2})\s+(\d{1,2})\s+(\d{1,2}\.\d+)\b/;

const MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

function parseHTML(html, year) {
  const rows = [];
  for (const line of html.split(/\r?\n/)) {
    if (!PREFIX_RE.test(line)) continue;
    const pm = line.match(PREFIX_RE);
    if (!pm) continue;
    const mon = MONTHS[pm[1]];
    const day = parseInt(pm[2], 10);
    if (mon === undefined) continue;
    const m = line.match(RADEC_RE);
    if (!m) continue;
    const [, rh, rm, rs, ds, dm, dss] = m;
    const raSec    = (+rh)*3600 + (+rm)*60 + (+rs);
    const decSign  = ds.startsWith('-') ? -1 : 1;
    const decArcs  = decSign * (Math.abs(+ds)*3600 + (+dm)*60 + (+dss));
    const date = new Date(Date.UTC(year, mon, day, 0, 0, 0));
    rows.push({ ts: date.getTime(), raSec, decArcs });
  }
  return rows;
}

async function fetchCached(url, cacheFile) {
  if (existsSync(cacheFile)) {
    const { readFileSync } = await import('node:fs');
    return readFileSync(cacheFile, 'utf8');
  }
  process.stdout.write(`  fetch ${url.slice(40)} … `);
  const r = await fetch(url, { headers: {'User-Agent':'Mozilla/5.0'} });
  if (!r.ok) { console.log(`HTTP ${r.status}`); return null; }
  const text = await r.text();
  writeFileSync(cacheFile, text);
  console.log(`${text.length} bytes`);
  await new Promise(r=>setTimeout(r,500));
  return text;
}

const result = {};
for (const body of BODIES) {
  result[body] = [];
  for (const year of YEARS) {
    const url = URL[body](year);
    const cache = `${CACHE}/${body}${year}.html`;
    const html = await fetchCached(url, cache);
    if (!html) continue;
    const rows = parseHTML(html, year);
    result[body].push(...rows);
    console.log(`  ${body} ${year}: ${rows.length} rows`);
  }
}

writeFileSync('/home/claude/epicycle_ephemeris/de405_reference.json', JSON.stringify(result));
const total = Object.values(result).reduce((s,a)=>s+a.length,0);
console.log(`\nWrote de405_reference.json  (${total} total rows)`);
