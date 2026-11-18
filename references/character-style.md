# Character identity and A-roll uniqueness

## User-provided reference authorities

This public Skill contains no personal character images. If the user chooses to use an existing IP, ask them to provide the reference images or point to files already present in the current project. Record only project-relative paths in project artifacts when possible; do not copy private references into this Skill repository.

Use the provided turnaround for face, body, clothing, proportions, and silhouette; the scene reference for environment and background layers; and the detail reference for line weight, coloring, grain, and rendering. If a reference is missing, ask whether to proceed without it or wait for the user to provide it. Never claim a missing reference was inspected.

Do not alter the face, glasses, body ratio, clothing, silhouette, head-to-body proportion, or drawing system to manufacture novelty. Identity consistency and composition uniqueness are separate requirements.

## Per-shot composition

Every A-roll is newly designed and generated for its shot. Choose the viewpoint that proves the narration:

- `host`: direct address, transition, or conclusion; do not default every shot to a centered medium host.
- `protagonist`: the character acts inside a concrete environment and looks toward that action.
- `supporting-character`: another subject carries the action while the IP character is secondary or absent; preserve the same drawing system.
- `first-person`: show the IP character's view, usually without the full body, for entry, discovery, or inspection.

Record `viewpoint`, `framing`, `position`, `action`, `gaze`, and `environment` before generation. Build a deterministic `aRollSignature` from the selected values. Compare it with every A-roll already planned or produced.

Hard uniqueness rules:

1. Every A-roll has a unique `aRollSignature`.
2. Every A-roll image is newly generated; never reuse, crop, reframe, or cosmetically recolor an earlier A-roll artifact as the new shot.
3. Store the produced file's `artifactHash`; no A-roll hash may repeat.
4. Adjacent A-rolls differ in at least three of the six recorded composition dimensions.
5. A changed camera crop alone is only one dimension and cannot satisfy the adjacency rule.

Run `node scripts/check-visual-diversity.mjs visual-arrangement.json` before implementation and after storing the actual artifact hash. A passing validator does not replace visual inspection or the user's approval of the shown version.

## Optional visual system

- A-roll: clean warm cream backdrop with controlled depth and minimal clutter.
- B-roll: deep green-black background, ivory text, warm-gold anchor, restrained premium finish.
- Captions: bottom-center ivory with selected warm-gold keywords; protect the caption safe area.

When references exist, their palette and line treatment preserve identity. Without supplied references, establish a project-specific visual system with the user. Staging, action, gaze, spatial arrangement, and semantic proof create shot-level variety.
