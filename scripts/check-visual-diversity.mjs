import fs from 'node:fs';
import path from 'node:path';

const compositionDimensions = ['viewpoint', 'framing', 'position', 'action', 'gaze', 'environment'];
const requiredInterfaceStructure = ['windowShell', 'contextRegion', 'activeWorkspace', 'interaction', 'stateFeedback'];
const supportedTextModes = new Set(['keywords', 'source-content']);

function violation(code, message, shotIds) {
  return {code, shotIds, message};
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function isDominantNarrationCopy(onScreenText, narration) {
  const displayed = normalizeText(onScreenText);
  const source = normalizeText(narration);
  return Boolean(displayed && source) && (displayed === source || (
    displayed.length / source.length >= 0.7 && (source.includes(displayed) || displayed.includes(source))
  ));
}

function orderedShots(shots) {
  return shots
    .map((shot, index) => ({shot, index}))
    .sort((left, right) => (left.shot.order ?? left.index) - (right.shot.order ?? right.index) || left.index - right.index)
    .map(({shot}) => shot);
}

function validateArolls(shots, violations) {
  const signatures = new Map();
  const artifacts = new Map();
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    if (shot?.visualClass !== 'a-roll' && shot?.visualClass !== 'mixed') continue;
    if (!nonEmptyString(shot.aRollSignature)) {
      violations.push(violation('AROLL_SIGNATURE_MISSING', 'Every A-roll-bearing shot needs a non-empty composition signature.', [shot.id]));
    } else {
      const previous = signatures.get(shot.aRollSignature);
      if (previous) violations.push(violation('AROLL_SIGNATURE_REUSED', 'A-roll composition signatures must not repeat.', [previous.id, shot.id]));
      else signatures.set(shot.aRollSignature, shot);
    }
    if (!nonEmptyString(shot.artifactHash)) {
      violations.push(violation('AROLL_ARTIFACT_HASH_MISSING', 'Every A-roll-bearing shot needs a non-empty artifact hash.', [shot.id]));
    } else {
      const previous = artifacts.get(shot.artifactHash);
      if (previous) violations.push(violation('AROLL_IMAGE_REUSED', 'A-roll image artifacts must not repeat.', [previous.id, shot.id]));
      else artifacts.set(shot.artifactHash, shot);
    }
    if (!compositionDimensions.every((dimension) => nonEmptyString(shot[dimension]))) {
      violations.push(violation('AROLL_COMPOSITION_INCOMPLETE', 'Every A-roll-bearing shot needs all six composition dimensions.', [shot.id]));
    }
    const previous = shots[index - 1];
    if (previous?.visualClass !== 'a-roll' && previous?.visualClass !== 'mixed') continue;
    const differences = compositionDimensions.filter((dimension) => previous[dimension] !== shot[dimension]);
    if (differences.length < 3) {
      violations.push(violation('AROLL_ADJACENT_TOO_SIMILAR', 'Adjacent A-rolls must differ in at least three composition dimensions.', [previous.id, shot.id]));
    }
  }
}

function hasValidKeywordSet(keywordSet) {
  return Array.isArray(keywordSet) && keywordSet.length >= 2 && keywordSet.length <= 6 && keywordSet.every(nonEmptyString);
}

function hasOverlongChineseKeyword(keywordSet) {
  return Array.isArray(keywordSet) && keywordSet.some((keyword) => (keyword.match(/\p{Script=Han}/gu) ?? []).length > 8);
}

function validateBrolls(shots, violations) {
  const templates = new Map();
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index];
    if (shot?.visualClass !== 'b-roll' && shot?.visualClass !== 'mixed') continue;
    if (!nonEmptyString(shot.narration)) violations.push(violation('SHOT_NARRATION_MISSING', 'Every B-roll-bearing shot needs its exact narration.', [shot.id]));
    if (!nonEmptyString(shot.templateId)) {
      violations.push(violation('BROLL_TEMPLATE_MISSING', 'Every B-roll-bearing shot needs a unique templateId.', [shot.id]));
    } else {
      const previous = templates.get(shot.templateId);
      if (previous) violations.push(violation('BROLL_TEMPLATE_REUSED', 'B-roll template IDs must not repeat.', [previous.id, shot.id]));
      else templates.set(shot.templateId, shot);
    }
    if (!nonEmptyString(shot.layoutArchetype)) violations.push(violation('BROLL_LAYOUT_MISSING', 'Every B-roll-bearing shot needs a layoutArchetype.', [shot.id]));
    if (!nonEmptyString(shot.motionFamily)) violations.push(violation('BROLL_MOTION_MISSING', 'Every B-roll-bearing shot needs a motionFamily.', [shot.id]));
    if (!nonEmptyString(shot.transitionAnchor)) violations.push(violation('TRANSITION_ANCHOR_MISSING', 'Every B-roll-bearing shot needs a transitionAnchor.', [shot.id]));
    const previous = shots[index - 1];
    const previousBrollBearing = previous?.visualClass === 'b-roll' || previous?.visualClass === 'mixed';
    if (previousBrollBearing && previous.layoutArchetype === shot.layoutArchetype && previous.motionFamily === shot.motionFamily) {
      violations.push(violation('BROLL_ADJACENT_SAME_SKELETON', 'Adjacent B-rolls cannot reuse both layout archetype and motion family.', [previous.id, shot.id]));
    }
    if (!nonEmptyString(shot.visualMetaphor)) violations.push(violation('VISUAL_METAPHOR_MISSING', 'Every B-roll needs a visual metaphor.', [shot.id]));
    if (!hasValidKeywordSet(shot.keywordSet)) violations.push(violation('KEYWORDS_MISSING', 'Every B-roll needs two to six non-empty keyword phrases.', [shot.id]));
    if (shot.subtype !== 'interface-demo' && hasOverlongChineseKeyword(shot.keywordSet)) {
      violations.push(violation('KEYWORD_TOO_LONG', 'Ordinary B-roll keyword phrases may contain at most eight Chinese characters.', [shot.id]));
    }
    if (!nonEmptyString(shot.textMode)) violations.push(violation('BROLL_TEXT_MODE_MISSING', 'Every B-roll needs a textMode.', [shot.id]));
    if (nonEmptyString(shot.textMode) && !supportedTextModes.has(shot.textMode)) {
      violations.push(violation('BROLL_TEXT_MODE_INVALID', 'B-roll textMode must be keywords or source-content.', [shot.id]));
    }
    if (!nonEmptyString(shot.onScreenText)) violations.push(violation('BROLL_ON_SCREEN_TEXT_MISSING', 'Every B-roll needs onScreenText.', [shot.id]));
    const sourceContentAuthorized = shot.textMode === 'source-content' && shot.subtype === 'interface-demo' && nonEmptyString(shot.sourceContentPurpose);
    if (isDominantNarrationCopy(shot.onScreenText, shot.narration) && !sourceContentAuthorized) {
      violations.push(violation('NARRATION_COPIED', 'B-roll text cannot copy narration exactly or dominantly without authorized source content.', [shot.id]));
    }
    if (shot.textMode === 'source-content' && !sourceContentAuthorized) {
      violations.push(violation('SOURCE_CONTENT_UNAUTHORIZED', 'Source content is allowed only for an interface demo with a stated purpose.', [shot.id]));
    }
    if (shot.subtype === 'interface-demo' && !requiredInterfaceStructure.every((field) => shot.interfaceStructure?.[field] === true)) {
      violations.push(violation('INTERFACE_STRUCTURE_INCOMPLETE', 'Interface demos require window shell, context, workspace, interaction, and state feedback.', [shot.id]));
    }
  }
}

function validate(data) {
  if (!Array.isArray(data?.shots)) return [violation('ARRANGEMENT_INVALID', 'Visual arrangement must contain shots[].', [])];
  const violations = [];
  const shots = orderedShots(data.shots);
  validateArolls(shots, violations);
  validateBrolls(shots, violations);
  return violations;
}

function writeReport(violations) {
  process.stdout.write(`${JSON.stringify({ok: violations.length === 0, violations})}\n`);
  process.exit(violations.length === 0 ? 0 : 2);
}

const inputPath = process.argv[2];
if (!inputPath) writeReport([violation('INVALID_ARGUMENTS', 'Usage: node scripts/check-visual-diversity.mjs <visual-arrangement.json>', [])]);
let data;
try {
  data = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
} catch (error) {
  writeReport([violation('ARRANGEMENT_UNREADABLE', `Cannot read visual arrangement JSON: ${error.message}`, [])]);
}
writeReport(validate(data));
