import fs from 'node:fs';
import path from 'node:path';

function violation(code, message, shotIds = [], deltaMs) {
  const entry = {code, shotIds, message};
  if (deltaMs !== undefined) entry.deltaMs = deltaMs;
  return entry;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stableTimelineOrder(shots) {
  return shots
    .map((shot, index) => ({shot, index}))
    .sort((left, right) => (left.shot.order ?? left.index) - (right.shot.order ?? right.index) || left.index - right.index)
    .map(({shot}) => shot);
}

function durationMs(shot) {
  return shot.endMs - shot.startMs;
}

function validShot(shot) {
  return shot && nonEmptyString(shot.id) && Number.isFinite(shot.startMs) && Number.isFinite(shot.endMs) && shot.endMs >= shot.startMs;
}

function hasExactGapAuthorization(authorizations, beforeShot, afterShot, gapMs) {
  return authorizations.some((authorization) =>
    authorization?.approved === true &&
    authorization.beforeShotId === beforeShot.id &&
    authorization.afterShotId === afterShot.id &&
    authorization.durationMs === gapMs &&
    nonEmptyString(authorization.purpose)
  );
}

function validateContinuity(data, shots, violations) {
  const fps = data.project?.fps;
  const projectDurationMs = data.project?.durationMs;
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(projectDurationMs) || projectDurationMs < 0) {
    violations.push(violation('TIMELINE_PROJECT_INVALID', 'Project must declare a positive fps and non-negative durationMs.'));
    return;
  }
  if (!shots.every(validShot)) {
    violations.push(violation('TIMELINE_ITEM_INVALID', 'Every timeline item needs an ID and finite startMs/endMs values.'));
    return;
  }

  const toleranceMs = Math.ceil(1000 / fps);
  if (shots.length === 0) {
    if (projectDurationMs !== 0) violations.push(violation('TIMELINE_END_INCOMPLETE', 'Timeline coverage must end at the project duration.', [], projectDurationMs));
    return;
  }
  if (shots[0].startMs !== 0) {
    violations.push(violation('TIMELINE_START_INCOMPLETE', 'Timeline coverage must begin at 0ms.', [shots[0].id], shots[0].startMs));
  }
  if (shots.at(-1).endMs !== projectDurationMs) {
    violations.push(violation('TIMELINE_END_INCOMPLETE', 'Timeline coverage must end at the project duration.', [shots.at(-1).id], projectDurationMs - shots.at(-1).endMs));
  }

  const authorizations = Array.isArray(data.gapAuthorizations) ? data.gapAuthorizations : [];
  for (let index = 1; index < shots.length; index += 1) {
    const beforeShot = shots[index - 1];
    const afterShot = shots[index];
    const deltaMs = afterShot.startMs - beforeShot.endMs;
    if (afterShot.startMs < beforeShot.startMs) {
      violations.push(violation('TIMELINE_OUT_OF_ORDER', 'Timeline items must stay chronological in stable order.', [beforeShot.id, afterShot.id], deltaMs));
    }
    if (deltaMs < 0) {
      violations.push(violation('TIMELINE_OVERLAP', 'Timeline items must not overlap.', [beforeShot.id, afterShot.id], deltaMs));
    } else if (deltaMs > toleranceMs && !hasExactGapAuthorization(authorizations, beforeShot, afterShot, deltaMs)) {
      violations.push(violation('TIMELINE_GAP_UNAUTHORIZED', 'Gaps longer than one frame require an approved exact authorization.', [beforeShot.id, afterShot.id], deltaMs));
    }
  }
}

function validateRipple(data, currentShots, violations) {
  const revision = data.timelineRevision;
  const mode = data.timelineMode;
  if (mode === undefined || mode === null || mode === '') {
    violations.push(violation('TIMELINE_MODE_REQUIRED', 'Timeline mode must be explicitly set to initial or update.'));
    return;
  }
  if (mode !== 'initial' && mode !== 'update') {
    violations.push(violation('TIMELINE_MODE_INVALID', 'timelineMode must be initial or update.'));
    return;
  }
  if (mode === 'initial') {
    if (revision) violations.push(violation('TIMELINE_REVISION_MODE_MISMATCH', 'Initial timelines cannot carry revision metadata.'));
    return;
  }
  if (!revision) {
    violations.push(violation('TIMELINE_REVISION_REQUIRED', 'Timeline updates require approved revision metadata and a prior snapshot.'));
    return;
  }
  if (revision.approved !== true) {
    violations.push(violation('TIMELINE_REVISION_UNAPPROVED', 'Timeline revisions must be approved before they are used.'));
    return;
  }
  if (!Array.isArray(revision.previousSnapshot?.shots)) {
    violations.push(violation('TIMELINE_REVISION_INVALID', 'An approved timeline revision needs previousSnapshot.shots[].'));
    return;
  }

  const previousShots = stableTimelineOrder(revision.previousSnapshot.shots);
  if (!previousShots.every(validShot) || previousShots.length !== currentShots.length || previousShots.some((shot, index) => shot.id !== currentShots[index]?.id)) {
    violations.push(violation('RIPPLE_SHOT_SEQUENCE_CHANGED', 'Ripple comparison requires the same ordered shot IDs in both snapshots.'));
    return;
  }

  let cumulativeDeltaMs = 0;
  let firstDurationChange = -1;
  for (let index = 0; index < currentShots.length; index += 1) {
    const previous = previousShots[index];
    const current = currentShots[index];
    const positionDeltaMs = current.startMs - previous.startMs;
    if (positionDeltaMs !== cumulativeDeltaMs) {
      violations.push(violation('RIPPLE_POSITION_MISMATCH', 'Downstream timeline positions must move by the accumulated duration delta.', [current.id], positionDeltaMs - cumulativeDeltaMs));
    }
    const changeMs = durationMs(current) - durationMs(previous);
    if (changeMs !== 0) {
      if (firstDurationChange === -1) firstDurationChange = index;
      else if (index > firstDurationChange) {
        violations.push(violation('RIPPLE_DOWNSTREAM_DURATION_CHANGED', 'Downstream shot durations must remain unchanged during a ripple revision.', [current.id], changeMs));
      }
      cumulativeDeltaMs += changeMs;
    }
  }
}

function validate(data) {
  if (!Array.isArray(data?.shots)) return [violation('ARRANGEMENT_INVALID', 'Visual arrangement must contain shots[].')];
  const violations = [];
  const shots = stableTimelineOrder(data.shots);
  validateContinuity(data, shots, violations);
  validateRipple(data, shots, violations);
  return violations;
}

function writeReport(violations) {
  process.stdout.write(`${JSON.stringify({ok: violations.length === 0, violations})}\n`);
  process.exit(violations.length === 0 ? 0 : 2);
}

const inputPath = process.argv[2];
if (!inputPath) writeReport([violation('INVALID_ARGUMENTS', 'Usage: node scripts/check-timeline.mjs <visual-arrangement.json>')]);
let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  writeReport([violation('ARRANGEMENT_UNREADABLE', `Cannot read visual arrangement JSON: ${error.message}`)]);
}
writeReport(validate(data));
