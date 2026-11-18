# Internal production contracts

These contracts organize internal model work. Do not recite or expose their full text during normal production. Show the user only the current proposal, authorization scope, actual preview, version/status, timeline impact, missing dependency, and verification result. Reveal a contract only when the user explicitly asks to inspect internal templates.

All contracts inherit the v2 rules: an exact authorization is required before state change; existing IP identity cannot be redesigned; visual uniqueness cannot be traded away for convenience; external facts and media must be truthful; and final rendering remains separately gated.

## A-roll generation contract

### Required inputs

- the authorized shot ID, version, narration interval, takeaway, and complete current arrangement row;
- the user's confirmed existing-IP decision;
- all user-provided character, scene, and detail references, when the project uses an existing IP;
- selected `viewpoint`, `framing`, `position`, `action`, `gaze`, and `environment`;
- all existing A-roll signatures and artifact hashes;
- the exact intended entry/exit handoff and caption-safe area.

### Internal sequence

1. Reduce the line to one visible semantic intent: what the character must prove, feel, demonstrate, discover, or hand off.
2. Choose host, protagonist, supporting-character, or first-person viewpoint because it serves that intent, not because it is the easiest familiar pose.
3. Plan focal hierarchy, body pose, gesture, gaze target, camera distance/angle, foreground/background depth, negative space, and transition anchor.
4. Compare all six composition dimensions with adjacent A-rolls. Change at least three dimensions without changing identity.
5. Build a canonical `aRollSignature` and reject it if any planned or produced A-roll already uses it.
6. When references are provided, constrain face, glasses, proportions, clothing, silhouette, line work, color treatment, and scene style to them. Without a personal IP, follow the approved project visual direction.
7. Generate a new image for this shot. Do not crop, reframe, recolor, or repurpose an earlier A-roll artifact.
8. Compute the actual artifact hash, update the arrangement, and run the visual-diversity validator.
9. Present the actual versioned preview. Keep the shot `waiting_for_approval` until the user approves that exact version.

If a required reference cannot be inspected or generation fails, stop and report the missing evidence. Never claim a generated or verified image exists when it does not.

## B-roll generation contract

### Source priority

Consider reusable motion knowledge in this order:

1. the current project's local B-roll library;
2. `heygen-com/hyperframes-launches`;
3. `Vincentwei1021/video-shotcraft`;
4. an original semantic design for this shot.

Sources provide methods or skeleton ideas, not ready-made shots. Access, license, and local availability must be checked before use.

### Internal sequence

1. Identify the audience takeaway, semantic structure, concrete entities/relationships, visible state change, and transition anchors.
2. Select or invent a skeleton by semantic fit: element relationships, primary action, and phase order come before UI styling.
3. Assign a globally unique `templateId`, then choose `layoutArchetype`, `motionFamily`, `visualMetaphor`, and `transitionAnchor`.
4. Reject a candidate if it repeats any `templateId` or if an adjacent B-roll would share both layout archetype and motion family.
5. Express ordinary B-roll with two to six short keyword phrases. Keep each Chinese phrase normally within eight Han characters. Do not paste the narration exactly or dominantly into on-screen text.
6. Use `source-content` only for a truthful interface demonstration in which a prompt, document, code block, or error is itself the operation object; record the purpose.
7. Design hierarchy, whitespace, controlled spatial depth, natural easing, one focal action at a time, and a semantic handoff. Do not use particles, glow, grids, drifting decoration, or irrelevant English to hide a weak structure.
8. Before implementation, show the user the selected motion proposal, semantic reason, skeleton, neighboring handoff, exact shot scope, and intended modifications; wait for authorization.
9. Implement only the authorized version, run diversity/timeline/balance checks, render the actual preview, and wait for approval.

For interface demonstrations, also enforce [interface-demo.md](interface-demo.md). If no source skeleton satisfies uniqueness and truthfulness, create a new one instead of weakening the rules.

## Visual-arrangement generation contract

### Sources of truth

- complete approved script;
- `audio/vo-full.wav` duration and `audio/vo-align.txt` verified phrase timestamps;
- confirmed IP, account/CTA, required-image, format, and asset decisions;
- real asset availability and any facts that require external verification.

### Internal sequence

1. Segment complete semantic units across the real alignment. Do not cut mechanically at punctuation or silence and do not estimate initial timestamps.
2. Ensure continuous coverage from audio start to audio end with no overlaps or invented empty holds.
3. For each shot, answer: what must the audience understand; what exactly appears; what subject changes; what final state remains; how it enters and exits.
4. Choose a visible type from character, scene, truthful interface material, infographic, or typography, then assign `a-roll`, `b-roll`, or materially mixed classification.
5. Populate shared fields plus the applicable A-roll, B-roll, interface, uniqueness, and transition fields in `visual-arrangement.json`.
6. When a real product, dataset, case, image, or result is unavailable or unverified, mark the shot as needing material. Do not fabricate it.
7. Run timeline and shot-balance validators before displaying the initial arrangement, and verify that every planned uniqueness/template field is present. Do not invent an A-roll artifact hash before generation; run visual diversity as soon as actual hashes exist and again before final delivery.
8. Display the first arrangement with the exact columns `镜头`, `时间`, `配音文案`, `画面类型`, `画面设计`, `动态变化`, and `画面衔接`, then wait for approval.
9. Keep the internal arrangement current after approval. Do not automatically regenerate, export, normalize, or fully redisplay it. Later timing changes require an approved ripple proposal and a prior snapshot.

## Doubao TTS and Whisper alignment contract

### Preconditions

The complete script, voice name, exact voice ID, speech rate, and authorization for narration/alignment are confirmed. Rate defaults to `1.0` only when the user has not specified one. Use the provider's default volume unless the user explicitly chooses another value.

### Continuous operation

1. Submit the entire script once to Volcengine Doubao Speech Synthesis 2.0 with the confirmed voice ID and rate. Do not split the script into sentence or paragraph synthesis calls.
2. Decode and save `audio/vo-full.wav` as 44100 Hz mono. Probe the actual file and record its exact duration in milliseconds.
3. Without asking another question between steps, align that WAV in Chinese phrase units using Whisper large-v3 by default.
4. Form segments of 5–15 Chinese characters when the acoustic boundaries allow. Preserve the approved script's characters as transcript authority; use recognition only for timestamps.
5. Write `audio/vo-align.txt`, one line per segment, in this form: `[0-1860] 智能体先理解目标`.
6. Make the timeline continuous: the first segment starts at 0, each segment starts when the previous segment ends, segments do not overlap, and the final segment ends at the probed audio duration.
7. Verify and report the audio duration, segment count, and last segment end time. If they disagree, redo the alignment rather than changing the audio fact or inventing timestamps.

If a dependency can be installed or configured within the user's authorized scope, do so and verify it. If login, provider authorization, entitlement, credentials, or an API key requires the user, stop before that manual/authenticated step and state exactly what the user must complete. Never fabricate provider success, an audio file, alignment data, or verification results.
