const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {spawnSync} = require('node:child_process');

const skillRoot = path.resolve(__dirname, '..');
const validator = path.join(skillRoot, 'scripts', 'check-project-gates.mjs');
const fixture = (name) => path.join(__dirname, 'fixtures', 'project-state', name);

function run(name, action, extraArgs = []) {
  const result = spawnSync(process.execPath, [validator, fixture(name), '--action', action, ...extraArgs], {
    encoding: 'utf8',
    windowsHide: true,
  });
  let report = null;
  if (result.stdout.trim()) report = JSON.parse(result.stdout);
  return {...result, report};
}

function runState(state, action, shotIds = []) {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-video-project-gate-'));
  const statePath = path.join(temporaryDirectory, 'project-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state), 'utf8');
  const args = [validator, statePath, '--action', action];
  if (shotIds.length) args.push('--shots', shotIds.join(','));
  const result = spawnSync(process.execPath, args, {encoding: 'utf8', windowsHide: true});
  let report = null;
  if (result.stdout.trim()) report = JSON.parse(result.stdout);
  fs.rmSync(temporaryDirectory, {recursive: true, force: true});
  return {...result, report};
}

function mutationState(action, shotIds = [], authorize = true) {
  const state = {
    voice: {confirmed: true},
    characterIp: {confirmed: true},
    cta: {confirmed: true},
    requiredImages: {confirmed: true},
    alignment: {verified: true},
    initialArrangement: {displayed: true, approved: true},
    internalArrangementRevision: {approved: true, revisionId: 'arr-2', shotIds: ['S001']},
    timelineRevision: {approved: true, revisionId: 'timeline-2', shotIds: ['S001']},
    postJumpChoiceRequired: false,
    shots: [
      {id: 'S001', order: 1, startMs: 0, status: 'planned', currentVersion: 'v1'},
    ],
  };

  if (action === 'record-post-jump-choice') {
    state.postJumpChoiceRequired = true;
    state.postJumpChoice = 'earliest-unfinished';
  }
  if (action === 'request-shot-changes' || action === 'downgrade-approved') {
    state.shots[0].status = 'approved';
    state.shots[0].approvedVersion = 'v1';
  }
  if (action === 'approve-shot' || action === 'assemble-preview') {
    state.shots[0].status = 'waiting_for_approval';
    state.previewManifestCurrent = true;
    state.previewManifest = [
      {shotId: 'S001', version: 'v1', status: 'waiting_for_approval', order: 1},
    ];
  }
  if (action === 'select-music' || action === 'render-final') {
    state.shots[0].status = 'approved';
    state.shots[0].approvedVersion = 'v1';
    state.music = {selectedTrackId: 'music-1', approved: true};
  }
  if (action === 'render-final') {
    state.finalAssembly = {
      approved: true,
      phrase: '确认合成',
      manifest: [{shotId: 'S001', version: 'v1', order: 1}],
    };
  }
  if (authorize) state.actionAuthorization = {approved: true, action, shotIds};
  return state;
}

test('rejects an unknown mutation action instead of silently allowing it', () => {
  const result = run('missing-intake.json', 'delete-all-shots');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'ACTION_UNSUPPORTED');
});

test('blocks initial arrangement before voice, IP, CTA and required-image decisions are confirmed', () => {
  const result = run('missing-intake.json', 'generate-initial-arrangement');
  assert.equal(result.status, 2);
  assert.deepEqual(result.report.violations.map((violation) => violation.code), [
    'VOICE_UNCONFIRMED',
    'CHARACTER_IP_UNCONFIRMED',
    'CTA_UNCONFIRMED',
    'REQUIRED_IMAGES_UNCONFIRMED',
    'ALIGNMENT_UNVERIFIED',
  ]);
});

test('blocks a later shot while the earliest timeline item is unfinished', () => {
  const result = run('ordered-production.json', 'build-shot', ['--shots', 'S002']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'EARLIER_SHOT_NOT_APPROVED');
  assert.deepEqual(result.report.violations[0].shotIds, ['H001']);
});

test('blocks shot production when intake confirmations are incomplete', () => {
  const result = run('build-missing-intake.json', 'build-shot', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert(result.report.violations.some((violation) => violation.code === 'VOICE_UNCONFIRMED'));
});

test('blocks shot production until the displayed initial arrangement is approved', () => {
  const result = run('build-unapproved-arrangement.json', 'build-shot', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'INITIAL_ARRANGEMENT_UNAPPROVED');
});

test('blocks further shot production until the required post-jump choice is consumed', () => {
  const result = run('post-jump-choice-pending.json', 'build-shot', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'POST_JUMP_CHOICE_REQUIRED');
});

test('does not treat a recorded post-jump choice as consumed while the pending flag remains true', () => {
  const result = run('post-jump-choice-still-pending.json', 'build-shot', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'POST_JUMP_CHOICE_REQUIRED');
});

test('rejects an invalid post-jump choice value even after the pending flag is cleared', () => {
  const result = run('post-jump-choice-invalid.json', 'build-shot', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'POST_JUMP_CHOICE_INVALID');
});

test('allows an administrator jump only for its exact shot scope and returns the post-jump prompt flag', () => {
  const result = run('admin-jump.json', 'build-shot', ['--shots', 'S002']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.report.violations, []);
  assert.deepEqual(result.report.context, {postJumpChoiceRequired: true});
});

test('allows an administrator batch directive only for its exact production range', () => {
  const result = run('admin-batch.json', 'build-shot', ['--shots', 'S002,S003']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.report.violations, []);
});

test('does not expand an administrator directive beyond its recorded scope', () => {
  const result = run('admin-batch.json', 'build-shot', ['--shots', 'S002,S003,S004']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'EARLIER_SHOT_NOT_APPROVED');
});

test('allows temporary previews with current manifest entries in approved reviewable statuses', () => {
  const result = run('preview-manifest-valid.json', 'assemble-preview', ['--shots', 'S001,S002,S003']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.report.violations, []);
});

test('rejects a temporary preview manifest without an exact shot version, status, and order', () => {
  const result = run('preview-manifest-invalid.json', 'assemble-preview');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_MANIFEST_INVALID');
});

test('rejects a preview manifest that references a shot outside project state', () => {
  const result = run('preview-unknown-shot.json', 'assemble-preview');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_SHOT_UNKNOWN');
});

test('rejects a preview manifest whose version is not the shot currentVersion', () => {
  const result = run('preview-stale-version.json', 'assemble-preview');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_VERSION_STALE');
});

test('rejects a preview manifest whose status no longer matches project state', () => {
  const result = run('preview-stale-status.json', 'assemble-preview');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_STATUS_STALE');
});

test('rejects an explicitly invalidated preview manifest', () => {
  const result = run('preview-manifest-stale.json', 'assemble-preview');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_MANIFEST_STALE');
});

test('rejects ambiguous batch approval when there is no current preview manifest', () => {
  const result = run('preview-manifest-missing.json', 'approve-preview-batch');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'BATCH_APPROVAL_AMBIGUOUS');
});

test('rejects a valid current preview when no explicit batch-approval directive exists', () => {
  const result = run('preview-manifest-valid.json', 'approve-preview-batch', ['--shots', 'S001,S002,S003']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'BATCH_APPROVAL_UNAUTHORIZED');
});

test('allows batch approval only for an approved directive matching the whole preview manifest in order', () => {
  const result = run('preview-batch-authorized.json', 'approve-preview-batch', ['--shots', 'S001,S002,S003']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.report.violations, []);
});

test('requires explicit non-empty CLI shot scope for preview batch approval', () => {
  const result = run('preview-batch-authorized.json', 'approve-preview-batch');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'BATCH_APPROVAL_SCOPE_REQUIRED');
});

test('rejects repeated IDs when the preview manifest, CLI scope, and batch directive all repeat them', () => {
  const shotIds = ['S001', 'S001'];
  const state = mutationState('approve-preview-batch', shotIds);
  state.shots[0].status = 'waiting_for_approval';
  state.previewManifestCurrent = true;
  state.previewManifest = [
    {shotId: 'S001', version: 'v1', status: 'waiting_for_approval', order: 1},
    {shotId: 'S001', version: 'v1', status: 'waiting_for_approval', order: 2},
  ];
  state.adminDirective = {approved: true, action: 'approve-preview-batch', shotIds};
  const result = runState(state, 'approve-preview-batch', shotIds);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'ACTION_SCOPE_INVALID');
});

test('cannot approve preview entries when project state has no matching shots', () => {
  const result = run('preview-batch-empty-shots.json', 'approve-preview-batch', ['--shots', 'S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_SHOT_UNKNOWN');
});

test('rejects a batch directive whose shot order differs from the current preview manifest', () => {
  const result = run('preview-batch-mismatched.json', 'approve-preview-batch', ['--shots', 'S001,S002']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'BATCH_APPROVAL_SCOPE_MISMATCH');
});

test('final render requires all approved, music approved and exact phrase', () => {
  const result = run('final-missing-phrase.json', 'render-final');
  assert.equal(result.status, 2);
  assert(result.report.violations.some((violation) => violation.code === 'FINAL_PHRASE_MISSING'));
});

test('final render rejects an approved shot without non-empty current and approved versions', () => {
  const result = run('final-missing-version.json', 'render-final');
  assert.equal(result.status, 2);
  assert(result.report.violations.some((violation) => violation.code === 'SHOT_VERSION_MISSING'));
});

test('final render rejects a shot whose current version differs from its approved version', () => {
  const result = run('final-version-mismatch.json', 'render-final');
  assert.equal(result.status, 2);
  assert(result.report.violations.some((violation) => violation.code === 'SHOT_VERSION_NOT_APPROVED'));
});

test('final render rejects a manifest that references a stale shot version', () => {
  const result = run('final-stale-manifest.json', 'render-final');
  assert.equal(result.status, 2);
  assert(result.report.violations.some((violation) => violation.code === 'FINAL_MANIFEST_MISMATCH'));
});

for (const name of ['final-confirm.json', 'final-can.json', 'final-continue.json', 'final-preview-approved.json', 'final-batch-approved.json']) {
  test(`does not let ${name} authorize final render`, () => {
    const result = run(name, 'render-final');
    assert.equal(result.status, 2);
    assert(result.report.violations.some((violation) => violation.code === 'FINAL_PHRASE_MISSING'));
  });
}

test('allows final render only after every final condition is satisfied', () => {
  const result = run('final-ready.json', 'render-final', ['--shots', 'H001,S001']);
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, action: 'render-final', violations: []});
});

const mutationCases = [
  ['record-intake', []],
  ['synthesize-and-align', []],
  ['generate-initial-arrangement', []],
  ['approve-initial-arrangement', []],
  ['update-internal-arrangement', ['S001']],
  ['apply-timeline-revision', ['S001']],
  ['build-shot', ['S001']],
  ['record-post-jump-choice', []],
  ['request-shot-changes', ['S001']],
  ['downgrade-approved', ['S001']],
  ['approve-shot', ['S001']],
  ['assemble-preview', ['S001']],
  ['select-music', ['S001']],
  ['render-final', ['S001']],
];

for (const [action, shotIds] of mutationCases) {
  test(`allows ${action} only with its explicit action-bound authorization and exact scope`, () => {
    const result = runState(mutationState(action, shotIds), action, shotIds);
    assert.equal(result.status, 0, JSON.stringify(result.report));
    assert.deepEqual(result.report.violations, []);
  });

  test(`rejects ${action} when its explicit authorization is missing`, () => {
    const state = mutationState(action, shotIds, false);
    state.lastUserReply = '可以';
    const result = runState(state, action, shotIds);
    assert.equal(result.status, 2);
    assert.equal(result.report.violations[0].code, 'ACTION_UNAUTHORIZED');
  });

  test(`rejects ${action} when its authorization scope differs from the requested scope`, () => {
    const state = mutationState(action, shotIds);
    state.actionAuthorization.shotIds = shotIds.length ? ['S999'] : ['S001'];
    const result = runState(state, action, shotIds);
    assert.equal(result.status, 2);
    assert.equal(result.report.violations[0].code, 'ACTION_SCOPE_MISMATCH');
  });
}

test('synthesize-and-align still requires every non-alignment intake decision', () => {
  const state = mutationState('synthesize-and-align');
  state.voice.confirmed = false;
  const result = runState(state, 'synthesize-and-align');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'VOICE_UNCONFIRMED');
});

test('update-internal-arrangement requires an approved revision for the exact affected shots', () => {
  const state = mutationState('update-internal-arrangement', ['S001']);
  state.internalArrangementRevision.approved = false;
  const result = runState(state, 'update-internal-arrangement', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'INTERNAL_ARRANGEMENT_REVISION_UNAPPROVED');
});

test('apply-timeline-revision requires an approved revision for the exact affected shots', () => {
  const state = mutationState('apply-timeline-revision', ['S001']);
  state.timelineRevision.shotIds = ['S002'];
  const result = runState(state, 'apply-timeline-revision', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'TIMELINE_REVISION_SCOPE_MISMATCH');
});

test('approve-shot requires a current reviewable manifest entry for the current shot version', () => {
  const state = mutationState('approve-shot', ['S001']);
  state.previewManifest[0].version = 'v0';
  const result = runState(state, 'approve-shot', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'PREVIEW_VERSION_STALE');
});

test('request-shot-changes cannot downgrade a shot that is not in a review state', () => {
  const state = mutationState('request-shot-changes', ['S001']);
  state.shots[0].status = 'planned';
  const result = runState(state, 'request-shot-changes', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SHOT_STATUS_NOT_CHANGEABLE');
});

test('select-music requires every scoped shot to have an approved current version', () => {
  const state = mutationState('select-music', ['S001']);
  state.shots[0].approvedVersion = 'v0';
  const result = runState(state, 'select-music', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SHOT_VERSION_NOT_APPROVED');
});

test('a repeated shot ID cannot masquerade as an exact mutation scope', () => {
  const shotIds = ['S001', 'S001'];
  const state = mutationState('update-internal-arrangement', shotIds);
  state.internalArrangementRevision.shotIds = shotIds;
  const result = runState(state, 'update-internal-arrangement', shotIds);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'ACTION_SCOPE_INVALID');
});

test('an administrator directive cannot use repeated shot IDs to bypass exact build scope validation', () => {
  const shotIds = ['S001', 'S001'];
  const state = mutationState('build-shot', shotIds);
  state.adminDirective = {approved: true, action: 'build-shot', shotIds};
  const result = runState(state, 'build-shot', shotIds);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'ACTION_SCOPE_INVALID');
});

test('build-shot cannot overwrite a version that is waiting for approval', () => {
  const state = mutationState('build-shot', ['S001']);
  state.shots[0].status = 'waiting_for_approval';
  const result = runState(state, 'build-shot', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SHOT_STATUS_NOT_BUILDABLE');
});

test('render-final rejects a music approval with no selected track identity', () => {
  const state = mutationState('render-final', ['S001']);
  delete state.music.selectedTrackId;
  const result = runState(state, 'render-final', ['S001']);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'MUSIC_UNCONFIRMED');
});

test('approve-shot cannot turn a multi-shot reply into implicit batch approval', () => {
  const shotIds = ['S001', 'S002'];
  const state = mutationState('approve-shot', shotIds);
  state.shots.push({id: 'S002', order: 2, startMs: 1000, status: 'waiting_for_approval', currentVersion: 'v1'});
  state.previewManifest.push({shotId: 'S002', version: 'v1', status: 'waiting_for_approval', order: 2});
  const result = runState(state, 'approve-shot', shotIds);
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SINGLE_SHOT_SCOPE_REQUIRED');
});
