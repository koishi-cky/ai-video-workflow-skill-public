import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) fail('Usage: node scripts/check-shot-balance.mjs <visual-arrangement.json>');

let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  fail(`Cannot read arrangement JSON: ${error.message}`);
}

if (!Array.isArray(data.shots)) fail('Arrangement JSON must contain shots[].');

const authorizations = Array.isArray(data.authorizations) ? data.authorizations : [];
const metadataViolations = [];
const seenIds = new Set();
const seenOrders = new Set();

for (const shot of data.shots) {
  if (!shot || typeof shot.id !== 'string' || !shot.id.trim()) {
    metadataViolations.push({code: 'SHOT_ID_INVALID', message: 'Every shot must have a non-empty id.'});
  } else if (seenIds.has(shot.id)) {
    metadataViolations.push({code: 'SHOT_ID_DUPLICATE', shotIds: [shot.id], message: 'Shot IDs must be unique.'});
  } else {
    seenIds.add(shot.id);
  }
  if (!Number.isFinite(shot?.order)) {
    metadataViolations.push({code: 'SHOT_ORDER_INVALID', shotIds: shot?.id ? [shot.id] : [], message: 'Every shot must have a finite order.'});
  } else if (seenOrders.has(shot.order)) {
    metadataViolations.push({code: 'SHOT_ORDER_DUPLICATE', shotIds: shot?.id ? [shot.id] : [], message: 'Shot order values must be unique.'});
  } else {
    seenOrders.add(shot.order);
  }
  if (!Number.isFinite(shot?.startMs)) {
    metadataViolations.push({code: 'SHOT_START_INVALID', shotIds: shot?.id ? [shot.id] : [], message: 'Every shot must have a finite startMs.'});
  }
}

if (metadataViolations.length) {
  process.stdout.write(`${JSON.stringify({ok: false, violations: metadataViolations})}\n`);
  process.exit(2);
}

const orderedShots = [...data.shots].sort((left, right) => left.order - right.order || left.startMs - right.startMs);
const runs = [];
let current = null;

for (const shot of orderedShots) {
  const visualClass = shot.visualClass;
  const isPure = visualClass === 'a-roll' || visualClass === 'b-roll';
  if (!isPure) {
    if (current && current.shotIds.length >= 3) runs.push(current);
    current = null;
    continue;
  }
  if (!current || current.visualClass !== visualClass) {
    if (current && current.shotIds.length >= 3) runs.push(current);
    current = {visualClass, shotIds: [shot.id]};
  } else {
    current.shotIds.push(shot.id);
  }
}
if (current && current.shotIds.length >= 3) runs.push(current);

function sameIds(left, right) {
  return Array.isArray(right) && left.length === right.length && left.every((id, index) => id === right[index]);
}

function isAuthorized(run) {
  return authorizations.some((entry) =>
    entry &&
    entry.approved === true &&
    typeof entry.reason === 'string' &&
    entry.reason.trim().length > 0 &&
    sameIds(run.shotIds, entry.shotIds)
  );
}

const violations = runs.filter((run) => !isAuthorized(run));
process.stdout.write(`${JSON.stringify({ok: violations.length === 0, violations})}\n`);
process.exit(violations.length === 0 ? 0 : 2);
