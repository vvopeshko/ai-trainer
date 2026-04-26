#!/usr/bin/env node
/**
 * Fetch missing GIF URLs from ExerciseDB OSS API.
 * Run when rate limits allow: node server/data/fetch-missing-gifs.js
 *
 * ExerciseDB OSS free tier has aggressive rate limiting (~25-50 requests before 503).
 * Increase DELAY_MS if you're getting rate limited.
 */
const fs = require('fs');
const path = require('path');

const DELAY_MS = 4000;
const DATA_FILE = path.join(__dirname, 'enriched-exercises.json');

const manualSearches = {
  'Cable Face Pull': 'face pull',
  'Triceps Pulldown Rope': 'triceps pushdown',
  'Biceps Curl Cable': 'cable curl',
  'Hammer Curl DB': 'hammer curl',
  'Pull Up': 'pull-up',
  'Adductor Machine': 'adductor',
  'Lat Pulldown Narrow': 'close-grip pulldown',
  'Machine Chest Fly': 'pec deck',
  'Biceps Curl DB': 'dumbbell biceps curl',
  'Upright Row Cable': 'cable upright row',
  'Seated Row Wide': 'cable seated row',
  'Reverse Curl Barbell': 'barbell reverse curl',
  'Pec Fly': 'chest fly',
  'Push Up': 'push-up',
  'Front Plank': 'plank',
  'Box Jump': 'box jump',
  'Plié Squat': 'sumo squat',
  'Bench Pullover DB': 'dumbbell pullover',
  'Overhead Press Seated DB': 'dumbbell shoulder press seated',
  'Standing Cable Crossover': 'cable crossover',
  'Reverse Fly DB': 'dumbbell reverse fly',
  'Lateral Raise DB': 'dumbbell lateral raise',
  'Seated Leg Curl': 'seated leg curl',
  'Shoulder Press Machine': 'machine shoulder press',
  'Incline Bench DB': 'incline dumbbell press',
  'Leg Raises (lying)': 'lying leg raise',
  'Incline Bench Press Barbell': 'incline barbell bench press',
  'Incline Row DB': 'incline dumbbell row',
  'RFESS L DB': 'bulgarian split squat',
  'RFESS R DB': 'bulgarian split squat',
  'Machine Shoulder Fly': 'rear delt fly',
  'One-arm Biceps Curl Machine': 'machine biceps curl',
  'Single Arm Row L Cable': 'single arm cable row',
  'Single Arm Row R Cable': 'single arm cable row',
  'Row Single Arm L DB': 'one arm dumbbell row',
  'Row Single Arm R DB': 'one arm dumbbell row',
};

async function searchOSS(query) {
  const url = `https://oss.exercisedb.dev/api/v1/exercises/search?search=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url);
  if (res.status === 503) return null; // rate limited
  if (res.status !== 200) return [];
  const text = await res.text();
  if (text.startsWith('<')) return null;
  return JSON.parse(text).data || [];
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const missing = data.filter(e => !e.gifUrl);

  console.log(`Missing GIFs: ${missing.length}/${data.length}`);
  if (missing.length === 0) { console.log('All GIFs present!'); return; }

  let found = 0;
  for (let i = 0; i < missing.length; i++) {
    const ex = missing[i];
    const query = manualSearches[ex.nameEn] || ex.nameEn;

    const results = await searchOSS(query);
    if (results === null) {
      console.log(`RATE LIMITED at ${i + 1}/${missing.length}. Try again later.`);
      break;
    }

    const best = results.find(r => r.gifUrl);
    if (best) {
      ex.gifUrl = best.gifUrl;
      found++;
      console.log(`${i + 1}/${missing.length} V ${ex.nameEn} -> ${best.name}`);
    } else {
      console.log(`${i + 1}/${missing.length} X ${ex.nameEn}`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nNew GIFs: ${found}. Total: ${data.filter(e => e.gifUrl).length}/${data.length}`);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('Saved.');
}

main().catch(console.error);
