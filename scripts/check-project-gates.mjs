import fs from 'node:fs';
import path from 'node:path';

const allowedPreviewStatuses = new Set([
  'waiting_for_approval',
  'changes_requested',
  'approved',
]);
const supportedActions = new Set([
  'record-intake',
  'synthesize-and-align',
  'generate-initial-arrangement',
  'approve-initial-arrangement',
  'update-internal-arrangement',
  'apply-timeline-revision',
  'build-shot',
  'record-post-jump-choice',
  'request-shot-changes',
  'downgrade-approved',
  'approve-shot',
  'assemble-preview',
  'approve-preview-batch',
  'select-music',
  'render-final',
]);

const sameIds = (left, right) =>
  Array.isArray(left) && Array.isArray(right) &&
  left.length === right.length && left.every((id, index) => id === right[index]);

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function violation(code, message, shotIds) {
  return shotIds === undefined ? {code, message} : {code, message, shotIds};
}

function firstUnapprovedShot(state) {
  return [...state.shots]
    .sort((a, b) => a.order - b.order || a.startMs - b.startMs)
    .find((shot) => shot.status !== 'approved');
}

function activeDirectiveAllows(state, action, shotIds) {
  const directive = state.adminDirective;
  return directive?.approved === true && directive.action === action &&
    sameIds(directive.shotIds, shotIds);
}

function actionAuthorizationViolations(state, action, requestedShotIds, expectedShotIds) {
  const authorization = state.actionAuthorization;
  if (authorization?.approved !== true || authorization.action !== action) {
    return [violation('ACTION_UNAUTHORIZED', `Action ${action} requires an explicit structured authorization for that action.`)];
  }
  const hasRepeatedId = (ids) => Array.isArray(ids) && new Set(ids).size !== ids.length;
  if (hasRepeatedId(requestedShotIds) || hasRepeatedId(expectedShotIds) || hasRepeatedId(authorization.shotIds)) {
    return [violation('ACTION_SCOPE_INVALID', `Action ${action} cannot contain repeated shot IDs.`)];
  }
  if (!sameIds(requestedShotIds, expectedShotIds) || !sameIds(authorization.shotIds, expectedShotIds)) {
    return [violation('ACTION_SCOPE_MISMATCH', `Action ${action} must use the exact authorized shot scope in order.`, expectedShotIds)];
  }
  return [];
}

function scopedShots(state, shotIds) {
  const shotsById = new Map(state.shots.map((shot) => [shot.id, shot]));
  if (new Set(shotIds).size !== shotIds.length) {
    return {shots: [], violations: [violation('ACTION_SCOPE_INVALID', 'This action requires unique shot IDs in its exact ordered scope.')]};
  }
  const unknown = shotIds.filter((shotId) => !shotsById.has(shotId));
  if (shotIds.length === 0) {
    return {shots: [], violations: [violation('ACTION_SCOPE_REQUIRED', 'This action requires a non-empty exact shot scope.')]};
  }
  if (unknown.length) {
    return {shots: [], violations: [violation('ACTION_SHOT_UNKNOWN', 'Every scoped shot must exist in current project state.', unknown)]};
  }
  return {shots: shotIds.map((shotId) => shotsById.get(shotId)), violations: []};
}

function finalGateViolations(state) {
  const violations = [];
  const unapproved = state.shots.filter((shot) => shot.status !== 'approved');
  if (unapproved.length) {
    violations.push(violation('SHOTS_NOT_APPROVED', 'Every shot must be approved before final rendering.', unapproved.map((shot) => shot.id)));
  }
  if (state.music?.approved !== true || !nonEmptyString(state.music?.selectedTrackId)) {
    violations.push(violation('MUSIC_UNCONFIRMED', 'Music must have a selected track identity and approval before final rendering.'));
  }
  if (state.finalAssembly?.approved !== true || state.finalAssembly?.phrase !== '确认合成') {
    violations.push(violation('FINAL_PHRASE_MISSING', 'Final rendering requires the exact approval phrase 确认合成.'));
  }
  const versionMissing = state.shots.filter((shot) => !nonEmptyString(shot.currentVersion) || !nonEmptyString(shot.approvedVersion));
  if (versionMissing.length) {
    violations.push(violation('SHOT_VERSION_MISSING', 'Every final shot needs non-empty currentVersion and approvedVersion values.', versionMissing.map((shot) => shot.id)));
  }
  const versionMismatch = state.shots.filter((shot) => nonEmptyString(shot.currentVersion) && nonEmptyString(shot.approvedVersion) && shot.currentVersion !== shot.approvedVersion);
  if (versionMismatch.length) {
    violations.push(violation('SHOT_VERSION_NOT_APPROVED', 'Every final shot currentVersion must equal its approvedVersion.', versionMismatch.map((shot) => shot.id)));
  }
  const manifest = state.finalAssembly?.manifest;
  if (!Array.isArray(manifest) || manifest.length === 0) {
    violations.push(violation('FINAL_MANIFEST_MISSING', 'Final assembly requires a non-empty exact shot-version manifest.'));
  } else {
    const orderedShots = [...state.shots].sort((a, b) => a.order - b.order || a.startMs - b.startMs);
    const manifestMatches = manifest.length === orderedShots.length && manifest.every((entry, index) =>
      entry?.shotId === orderedShots[index].id &&
      entry?.version === orderedShots[index].approvedVersion &&
      entry?.order === orderedShots[index].order
    );
    if (!manifestMatches) {
      violations.push(violation('FINAL_MANIFEST_MISMATCH', 'Final manifest must reference every current approved shot version in timeline order.'));
    }
  }
  return violations;
}

function intakeDecisionViolations(state) {
  const violations = [];
  if (state.voice?.confirmed !== true) {
    violations.push(violation('VOICE_UNCONFIRMED', 'Voice choice and ID must be confirmed.'));
  }
  if (state.characterIp?.confirmed !== true) {
    violations.push(violation('CHARACTER_IP_UNCONFIRMED', 'Character IP must be confirmed.'));
  }
  if (state.cta?.confirmed !== true) {
    violations.push(violation('CTA_UNCONFIRMED', 'Account and CTA must be confirmed.'));
  }
  if (state.requiredImages?.confirmed !== true) {
    violations.push(violation('REQUIRED_IMAGES_UNCONFIRMED', 'Required-image decisions must be confirmed.'));
  }
  return violations;
}

function intakeViolations(state) {
  const violations = intakeDecisionViolations(state);
  if (state.alignment?.verified !== true) {
    violations.push(violation('ALIGNMENT_UNVERIFIED', 'Voice alignment must be verified.'));
  }
  return violations;
}

function arrangementRevisionViolations(state, field, prefix, shotIds) {
  const scope = scopedShots(state, shotIds);
  if (scope.violations.length) return scope.violations;
  if (state.initialArrangement?.displayed !== true || state.initialArrangement?.approved !== true) {
    return [violation('INITIAL_ARRANGEMENT_UNAPPROVED', 'The displayed initial arrangement must be approved first.')];
  }
  const revision = state[field];
  if (revision?.approved !== true || !nonEmptyString(revision.revisionId)) {
    return [violation(`${prefix}_REVISION_UNAPPROVED`, 'The exact proposed revision must be explicitly approved before it is applied.')];
  }
  if (!sameIds(revision.shotIds, shotIds)) {
    return [violation(`${prefix}_REVISION_SCOPE_MISMATCH`, 'The approved revision must match the exact affected shot scope in order.', shotIds)];
  }
  return [];
}

function requestShotChangesViolations(state, shotIds, approvedOnly = false) {
  const scope = scopedShots(state, shotIds);
  if (scope.violations.length) return scope.violations;
  const allowedStatuses = approvedOnly ? ['approved'] : ['approved', 'waiting_for_approval'];
  const invalid = scope.shots.filter((shot) => !allowedStatuses.includes(shot.status));
  return invalid.length
    ? [violation('SHOT_STATUS_NOT_CHANGEABLE', 'Only approved or waiting-for-approval shots may be changed or downgraded.', invalid.map((shot) => shot.id))]
    : [];
}

function approveShotViolations(state, shotIds) {
  if (shotIds.length !== 1) {
    return [violation('SINGLE_SHOT_SCOPE_REQUIRED', 'approve-shot requires exactly one shot ID; use explicit batch approval for multiple displayed shots.')];
  }
  const scope = scopedShots(state, shotIds);
  if (scope.violations.length) return scope.violations;
  const invalid = scope.shots.filter((shot) =>
    !['waiting_for_approval', 'changes_requested'].includes(shot.status) || !nonEmptyString(shot.currentVersion)
  );
  if (invalid.length) {
    return [violation('SHOT_NOT_REVIEWABLE', 'Every approved shot must have a current version in a reviewable state.', invalid.map((shot) => shot.id))];
  }
  const manifestViolation = previewManifestViolation(state, 'PREVIEW_MANIFEST_MISSING');
  if (manifestViolation) return [manifestViolation];
  const manifestShotIds = new Set(state.previewManifest.map((entry) => entry.shotId));
  const absent = shotIds.filter((shotId) => !manifestShotIds.has(shotId));
  return absent.length
    ? [violation('SHOT_PREVIEW_MISSING', 'Every shot approval must reference its current preview entry.', absent)]
    : [];
}

function musicSelectionViolations(state, shotIds) {
  const orderedShotIds = [...state.shots]
    .sort((a, b) => a.order - b.order || a.startMs - b.startMs)
    .map((shot) => shot.id);
  if (!sameIds(shotIds, orderedShotIds)) {
    return [violation('MUSIC_SCOPE_MISMATCH', 'Music selection must cover every current timeline shot in order.', orderedShotIds)];
  }
  const unapproved = state.shots.filter((shot) => shot.status !== 'approved');
  if (unapproved.length) {
    return [violation('SHOTS_NOT_APPROVED', 'Every shot must be approved before music selection.', unapproved.map((shot) => shot.id))];
  }
  const versionMissing = state.shots.filter((shot) => !nonEmptyString(shot.currentVersion) || !nonEmptyString(shot.approvedVersion));
  if (versionMissing.length) {
    return [violation('SHOT_VERSION_MISSING', 'Every shot needs non-empty current and approved versions before music selection.', versionMissing.map((shot) => shot.id))];
  }
  const mismatch = state.shots.filter((shot) => shot.currentVersion !== shot.approvedVersion);
  if (mismatch.length) {
    return [violation('SHOT_VERSION_NOT_APPROVED', 'Every current shot version must be its approved version before music selection.', mismatch.map((shot) => shot.id))];
  }
  if (!nonEmptyString(state.music?.selectedTrackId) || state.music?.approved !== true) {
    return [violation('MUSIC_SELECTION_UNCONFIRMED', 'Music selection requires an explicit selected track and approval.')];
  }
  return [];
}

function buildShotPrerequisiteViolations(state) {
  const violations = intakeViolations(state);
  if (state.initialArrangement?.displayed !== true || state.initialArrangement?.approved !== true) {
    violations.push(violation('INITIAL_ARRANGEMENT_UNAPPROVED', 'The displayed initial arrangement must be approved before shot production.'));
  }
  const validPostJumpChoices = new Set(['earliest-unfinished', 'continue-from-current']);
  if (state.postJumpChoiceRequired === true) {
    violations.push(violation('POST_JUMP_CHOICE_REQUIRED', 'Choose whether to return to the earliest unfinished shot or continue from the current position before further production.'));
  }
  if (state.postJumpChoice !== undefined && state.postJumpChoice !== null && !validPostJumpChoices.has(state.postJumpChoice)) {
    violations.push(violation('POST_JUMP_CHOICE_INVALID', 'postJumpChoice must be earliest-unfinished or continue-from-current.'));
  }
  return violations;
}

function previewManifestViolation(state, missingCode) {
  const manifest = state.previewManifest;
  if (!Array.isArray(manifest) || manifest.length === 0) {
    return violation(missingCode, 'A current preview manifest is required.');
  }
  const invalid = manifest.some((entry) =>
    !entry ||
    typeof entry.shotId !== 'string' || !entry.shotId.trim() ||
    typeof entry.version !== 'string' || !entry.version.trim() ||
    !allowedPreviewStatuses.has(entry.status) ||
    !Number.isFinite(entry.order)
  );
  if (invalid) return violation('PREVIEW_MANIFEST_INVALID', 'Every preview entry needs shot ID, version, reviewable status, and order.');
  if (state.previewManifestCurrent !== true) {
    return violation('PREVIEW_MANIFEST_STALE', 'The preview manifest must be explicitly marked current.');
  }
  const shotsById = new Map(state.shots.map((shot) => [shot.id, shot]));
  for (const entry of manifest) {
    const shot = shotsById.get(entry.shotId);
    if (!shot) return violation('PREVIEW_SHOT_UNKNOWN', 'Every preview entry must reference a current project shot.', [entry.shotId]);
    if (entry.version !== shot.currentVersion) {
      return violation('PREVIEW_VERSION_STALE', 'Every preview version must equal the shot currentVersion.', [entry.shotId]);
    }
    if (entry.status !== shot.status) {
      return violation('PREVIEW_STATUS_STALE', 'Every preview status must equal the current project-state status.', [entry.shotId]);
    }
  }
  return null;
}

function previewBatchViolations(state, shotIds) {
  const manifestViolation = previewManifestViolation(state, 'BATCH_APPROVAL_AMBIGUOUS');
  if (manifestViolation) return [manifestViolation];
  const scope = scopedShots(state, shotIds);
  if (scope.violations.length) {
    if (scope.violations[0].code === 'ACTION_SCOPE_REQUIRED') {
      return [violation('BATCH_APPROVAL_SCOPE_REQUIRED', 'Batch approval requires the exact non-empty preview shot scope.')];
    }
    return scope.violations;
  }

  const manifestShotIds = state.previewManifest.map((entry) => entry.shotId);
  const directive = state.adminDirective;
  if (directive?.approved !== true || directive.action !== 'approve-preview-batch') {
    return [violation('BATCH_APPROVAL_UNAUTHORIZED', 'Batch approval requires an explicit approved directive for the current preview.')];
  }
  if (!sameIds(directive.shotIds, manifestShotIds) || !sameIds(shotIds, manifestShotIds)) {
    return [violation('BATCH_APPROVAL_SCOPE_MISMATCH', 'Batch approval must match every current preview shot in display order.', manifestShotIds)];
  }
  return [];
}

function validateAction(state, action, shotIds = []) {
  if (!supportedActions.has(action)) {
    return [violation('ACTION_UNSUPPORTED', `Unsupported state-changing action: ${action}.`)];
  }
  if (action === 'record-intake' || action === 'synthesize-and-align') {
    const violations = intakeDecisionViolations(state);
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, []);
  }
  if (action === 'generate-initial-arrangement') {
    const violations = intakeViolations(state);
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, []);
  }
  if (action === 'approve-initial-arrangement') {
    const violations = intakeViolations(state);
    if (state.initialArrangement?.displayed !== true) {
      violations.push(violation('INITIAL_ARRANGEMENT_NOT_DISPLAYED', 'The initial arrangement must be displayed before approval.'));
    }
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, []);
  }
  if (action === 'update-internal-arrangement' || action === 'apply-timeline-revision') {
    const isInternal = action === 'update-internal-arrangement';
    const violations = arrangementRevisionViolations(
      state,
      isInternal ? 'internalArrangementRevision' : 'timelineRevision',
      isInternal ? 'INTERNAL_ARRANGEMENT' : 'TIMELINE',
      shotIds,
    );
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, shotIds);
  }
  if (action === 'record-post-jump-choice') {
    const validPostJumpChoices = new Set(['earliest-unfinished', 'continue-from-current']);
    const violations = [];
    if (state.postJumpChoiceRequired !== true) {
      violations.push(violation('POST_JUMP_CHOICE_NOT_PENDING', 'A post-jump choice may be recorded only while that choice is pending.'));
    }
    if (!validPostJumpChoices.has(state.postJumpChoice)) {
      violations.push(violation('POST_JUMP_CHOICE_INVALID', 'postJumpChoice must be earliest-unfinished or continue-from-current.'));
    }
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, []);
  }
  if (action === 'request-shot-changes' || action === 'downgrade-approved') {
    const violations = requestShotChangesViolations(state, shotIds, action === 'downgrade-approved');
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, shotIds);
  }
  if (action === 'approve-shot') {
    const violations = approveShotViolations(state, shotIds);
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, shotIds);
  }
  if (action === 'assemble-preview') {
    const manifestViolation = previewManifestViolation(state, 'PREVIEW_MANIFEST_MISSING');
    if (manifestViolation) return [manifestViolation];
    const manifestShotIds = state.previewManifest.map((entry) => entry.shotId);
    return actionAuthorizationViolations(state, action, shotIds, manifestShotIds);
  }
  if (action === 'approve-preview-batch') return previewBatchViolations(state, shotIds);
  if (action === 'select-music') {
    const violations = musicSelectionViolations(state, shotIds);
    return violations.length ? violations : actionAuthorizationViolations(state, action, shotIds, shotIds);
  }
  if (action === 'render-final') {
    const violations = finalGateViolations(state);
    if (violations.length) return violations;
    const finalShotIds = state.finalAssembly.manifest.map((entry) => entry.shotId);
    return actionAuthorizationViolations(state, action, shotIds, finalShotIds);
  }
  if (action === 'build-shot') {
    const violations = buildShotPrerequisiteViolations(state);
    const scope = scopedShots(state, shotIds);
    violations.push(...scope.violations);
    const unbuildable = scope.shots.filter((shot) => !['planned', 'in_progress', 'changes_requested'].includes(shot.status));
    if (unbuildable.length) {
      violations.push(violation('SHOT_STATUS_NOT_BUILDABLE', 'Only planned, in-progress, or changes-requested shots may be built.', unbuildable.map((shot) => shot.id)));
    }
    const directiveAllows = activeDirectiveAllows(state, action, shotIds);
    if (!directiveAllows) {
      const next = firstUnapprovedShot(state);
      if (!next || !sameIds([next.id], shotIds)) {
        violations.push(violation('EARLIER_SHOT_NOT_APPROVED', 'Only the earliest unapproved timeline item may be built without an administrator directive.', next ? [next.id] : []));
      }
    }
    if (violations.length) return violations;
    if (!directiveAllows) return actionAuthorizationViolations(state, action, shotIds, shotIds);
    return violations;
  }
  return [violation('ACTION_UNVALIDATED', `No validation branch is registered for action: ${action}.`)];
}

function parseArguments(args) {
  const [inputPath, ...options] = args;
  const actionIndex = options.indexOf('--action');
  const shotsIndex = options.indexOf('--shots');
  const action = actionIndex === -1 ? undefined : options[actionIndex + 1];
  const rawShots = shotsIndex === -1 ? '' : options[shotsIndex + 1];
  const shotIds = rawShots ? rawShots.split(',').filter(Boolean) : [];
  return {inputPath, action, shotIds};
}

function blocked(action, violations, context) {
  const report = {ok: violations.length === 0, action, violations};
  if (context) report.context = context;
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(violations.length === 0 ? 0 : 2);
}

const {inputPath, action, shotIds} = parseArguments(process.argv.slice(2));
if (!inputPath || !action) {
  blocked(action ?? '', [violation('INVALID_ARGUMENTS', 'Usage: node scripts/check-project-gates.mjs <project-state.json> --action <action> [--shots S001,S002]')]);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  blocked(action, [violation('STATE_UNREADABLE', `Cannot read project state JSON: ${error.message}`)]);
}

if (!Array.isArray(state.shots)) {
  blocked(action, [violation('STATE_INVALID', 'Project state must contain shots[].')]);
}

const violations = validateAction(state, action, shotIds);
const context = action === 'build-shot' && activeDirectiveAllows(state, action, shotIds)
  ? {postJumpChoiceRequired: true}
  : undefined;
blocked(action, violations, context);
