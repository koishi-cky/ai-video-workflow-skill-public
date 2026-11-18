const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const skillRoot = path.resolve(__dirname, '..');
const validator = path.join(skillRoot, 'scripts', 'check-timeline.mjs');
const fixture = (name) => path.join(__dirname, 'fixtures', 'timeline', name);

function run(name) {
  const result = spawnSync(process.execPath, [validator, fixture(name)], {
    encoding: 'utf8',
    windowsHide: true,
  });
  let report = null;
  if (result.stdout && result.stdout.trim()) report = JSON.parse(result.stdout);
  return {...result, report};
}

function codes(result) {
  return result.report.violations.map((entry) => entry.code);
}

test('allows an initial timeline without revision metadata when it has full coverage and frame-sized seam tolerance', () => {
  const result = run('valid-frame-tolerance.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('blocks an altered timeline when it omits both timeline mode and revision metadata', () => {
  const result = run('altered-without-mode-revision.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_MODE_REQUIRED'));
});

test('blocks timeline items whose declared order reverses their timestamps', () => {
  const result = run('out-of-order.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_OUT_OF_ORDER'));
});

test('blocks overlapping shots', () => {
  const result = run('overlap.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_OVERLAP'));
  assert.equal(result.report.violations.find((entry) => entry.code === 'TIMELINE_OVERLAP').deltaMs, -100);
});

test('blocks gaps longer than one frame without exact authorization', () => {
  const result = run('unauthorized-gap.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_GAP_UNAUTHORIZED'));
  assert.equal(result.report.violations.find((entry) => entry.code === 'TIMELINE_GAP_UNAUTHORIZED').deltaMs, 200);
});

test('allows a longer gap only with an approved exact adjacent-shot authorization and purpose', () => {
  const result = run('authorized-gap.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('rejects a gap authorization whose stated duration does not match the gap', () => {
  const result = run('wrong-gap-authorization.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_GAP_UNAUTHORIZED'));
});

test('requires timeline coverage to begin at zero and end at the project duration', () => {
  const result = run('incomplete-coverage.json');
  assert.equal(result.status, 2);
  assert.deepEqual(codes(result), ['TIMELINE_START_INCOMPLETE', 'TIMELINE_END_INCOMPLETE']);
});

test('allows an approved ripple revision when shortened timing moves downstream shots by the same delta', () => {
  const result = run('approved-ripple.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('blocks timeline update mode when it omits approved revision metadata and a prior snapshot', () => {
  const result = run('update-without-revision.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_REVISION_REQUIRED'));
});

test('blocks a shortened shot that leaves downstream timestamps fixed with a blank hold', () => {
  const result = run('blank-hold-ripple.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('RIPPLE_POSITION_MISMATCH'));
});

test('blocks a ripple revision that changes an unchanged downstream duration', () => {
  const result = run('downstream-duration-changed.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('RIPPLE_DOWNSTREAM_DURATION_CHANGED'));
});

test('rejects a pending timeline revision proposal', () => {
  const result = run('pending-ripple.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('TIMELINE_REVISION_UNAPPROVED'));
});
