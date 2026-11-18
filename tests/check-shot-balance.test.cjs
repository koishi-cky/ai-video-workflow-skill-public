const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const skillRoot = path.resolve(__dirname, '..');
const validator = path.join(skillRoot, 'scripts', 'check-shot-balance.mjs');
const fixture = (name) => path.join(__dirname, 'fixtures', name);

function run(name) {
  const result = spawnSync(process.execPath, [validator, fixture(name)], {
    encoding: 'utf8',
    windowsHide: true,
  });
  let report = null;
  if (result.stdout.trim()) report = JSON.parse(result.stdout);
  return {...result, report};
}

test('allows a plan without three consecutive pure roll shots', () => {
  const result = run('alternating.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('blocks three consecutive B-roll shots and reports their IDs', () => {
  const result = run('unauthorized-three-broll.json');
  assert.equal(result.status, 2);
  assert.equal(result.report.ok, false);
  assert.deepEqual(result.report.violations[0].shotIds, ['S002', 'S003', 'S004']);
  assert.equal(result.report.violations[0].visualClass, 'b-roll');
});

test('sorts by order and startMs so array order cannot hide a three-shot run', () => {
  const result = run('out-of-order-balance-bypass.json');
  assert.equal(result.status, 2);
  assert.deepEqual(result.report.violations[0].shotIds, ['S001', 'S002', 'S003']);
});

test('rejects duplicate shot IDs', () => {
  const result = run('duplicate-shot-id.json');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SHOT_ID_DUPLICATE');
});

test('rejects duplicate shot order values', () => {
  const result = run('duplicate-shot-order.json');
  assert.equal(result.status, 2);
  assert.equal(result.report.violations[0].code, 'SHOT_ORDER_DUPLICATE');
});

test('rejects timeline items without finite order and startMs values', () => {
  const result = run('invalid-shot-position.json');
  assert.equal(result.status, 2);
  assert.deepEqual(result.report.violations.map((violation) => violation.code), ['SHOT_ORDER_INVALID', 'SHOT_START_INVALID']);
});

test('allows a matching explicit authorization with a reason', () => {
  const result = run('authorized-three-aroll.json');
  assert.equal(result.status, 0);
  assert.deepEqual(result.report, {ok: true, violations: []});
});

test('does not accept an authorization without a reason', () => {
  const result = run('incomplete-authorization.json');
  assert.equal(result.status, 2);
  assert.equal(result.report.ok, false);
});
