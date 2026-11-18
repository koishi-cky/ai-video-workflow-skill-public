const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const skillRoot = path.resolve(__dirname, '..');
const validator = path.join(skillRoot, 'scripts', 'check-visual-diversity.mjs');
const fixture = (name) => path.join(__dirname, 'fixtures', 'visual-diversity', name);

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

test('allows a visual arrangement whose A-rolls and B-rolls are distinct', () => {
  const result = run('valid.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('blocks a repeated A-roll composition signature', () => {
  const result = run('duplicate-aroll-signature.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_SIGNATURE_REUSED'));
});

test('requires every A-roll fingerprint, artifact hash, and composition dimension', () => {
  const result = run('missing-aroll-required-fields.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_SIGNATURE_MISSING'));
  assert(codes(result).includes('AROLL_ARTIFACT_HASH_MISSING'));
  assert(codes(result).includes('AROLL_COMPOSITION_INCOMPLETE'));
});

test('blocks a repeated A-roll artifact image', () => {
  const result = run('duplicate-aroll-image.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_IMAGE_REUSED'));
});

test('blocks adjacent A-rolls that change fewer than three composition dimensions', () => {
  const result = run('similar-adjacent-arolls.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_ADJACENT_TOO_SIMILAR'));
});

test('blocks reused B-roll templates', () => {
  const result = run('duplicate-broll-template.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('BROLL_TEMPLATE_REUSED'));
});

test('requires every B-roll template, skeleton, transition anchor, and shot narration', () => {
  const result = run('missing-broll-required-fields.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('BROLL_TEMPLATE_MISSING'));
  assert(codes(result).includes('BROLL_LAYOUT_MISSING'));
  assert(codes(result).includes('BROLL_MOTION_MISSING'));
  assert(codes(result).includes('TRANSITION_ANCHOR_MISSING'));
  assert(codes(result).includes('SHOT_NARRATION_MISSING'));
});

test('blocks adjacent B-rolls with the same layout and motion skeleton', () => {
  const result = run('same-adjacent-broll-skeleton.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('BROLL_ADJACENT_SAME_SKELETON'));
});

test('requires every B-roll to declare a visual metaphor and two to six keyword phrases', () => {
  const result = run('missing-broll-metaphor-keywords.json');
  assert.equal(result.status, 2);
  assert.deepEqual(codes(result), ['VISUAL_METAPHOR_MISSING', 'KEYWORDS_MISSING']);
});

test('rejects an invalid B-roll keyword set', () => {
  const result = run('invalid-keyword-set.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('KEYWORDS_MISSING'));
});

test('rejects an ordinary B-roll keyword phrase longer than eight Chinese characters', () => {
  const result = run('overlong-keyword-phrase.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('KEYWORD_TOO_LONG'));
});

test('requires B-roll text mode and on-screen text', () => {
  const result = run('missing-broll-text-fields.json');
  assert.equal(result.status, 2);
  assert.deepEqual(codes(result), ['BROLL_TEXT_MODE_MISSING', 'BROLL_ON_SCREEN_TEXT_MISSING']);
});

test('rejects keyword-mode text that copies the narration exactly or dominantly', () => {
  const result = run('narration-copied.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('NARRATION_COPIED'));
});

test('detects narration copying against the current shot narration rather than top-level narration', () => {
  const result = run('shot-narration-copied.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('NARRATION_COPIED'));
});

test('rejects an unknown text mode and does not let it bypass narration-copy protection', () => {
  const result = run('invalid-text-mode-copied-narration.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('BROLL_TEXT_MODE_INVALID'));
  assert(codes(result).includes('NARRATION_COPIED'));
});

test('allows full source content only for an interface demo with a stated purpose', () => {
  const result = run('source-content-interface-demo.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('rejects source content outside a purposeful interface demo', () => {
  const result = run('source-content-not-allowed.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('SOURCE_CONTENT_UNAUTHORIZED'));
});

test('requires every interface-demo to show the complete interface structure', () => {
  const result = run('incomplete-interface-structure.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('INTERFACE_STRUCTURE_INCOMPLETE'));
});

test('applies both A-roll and B-roll required-field contracts to mixed shots', () => {
  const result = run('mixed-missing-subcontracts.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_SIGNATURE_MISSING'));
  assert(codes(result).includes('BROLL_TEMPLATE_MISSING'));
});

test('applies A-roll and B-roll uniqueness checks across adjacent mixed shots', () => {
  const result = run('mixed-reuses-aroll-broll.json');
  assert.equal(result.status, 2);
  assert(codes(result).includes('AROLL_SIGNATURE_REUSED'));
  assert(codes(result).includes('BROLL_TEMPLATE_REUSED'));
});

test('allows a mixed shot that satisfies both subcontracts', () => {
  const result = run('valid-mixed.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});
