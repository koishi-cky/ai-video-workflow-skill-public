# End-to-end workflow

This sequence is mandatory for every new project. Read-only inspection and recommendations may happen at any time, but no state-changing action may begin without authorization for that action.

## 1. Script

Receive the theme and complete script. Confirm the script is the current production source. Do not synthesize narration, estimate a timeline, or start a shot from an incomplete draft unless the user explicitly changes the project scope.

## 2. Voice name and ID

Ask for the voice name and exact voice ID, then wait for confirmation. Record the selection and speech rate in `project-state.json`; speech rate defaults to `1.0` only when the user does not specify one. Never invent or silently substitute an ID.

## 3. Existing character IP

Ask whether the project should use an existing character IP and wait for an explicit yes/no decision. When confirmed yes, ask the user to provide the references or identify their project-local paths, then use the turnaround, scene reference, and detail reference as their assigned authorities. These assets are user-provided and are not bundled with this public Skill. Do not redesign the identity. If no IP is selected, continue with character-free compositions.

## 4. Account and CTA

Ask whether the video contains an account avatar, follow button, CTA, or ending guidance. Record the chosen assets and copy, or record an explicit decision that none are needed. This confirmation does not authorize publication or any account action.

## 5. Required images

Ask whether any image must appear. Record the exact list and availability, or an explicit decision that no image is mandatory. If a later shot alone needs a special asset, ask only for that shot's missing information.

Before committing these intake decisions, stage the exact candidate state with `actionAuthorization.action: "record-intake"`, `shotIds: []`, and run the project gate. A normal conversational acknowledgment is not structured authorization.

## 6. Continuous narration and alignment

After the intake decisions and the operation are authorized, perform these two steps continuously without pausing for another confirmation:

1. Synthesize the complete script once into `audio/vo-full.wav` with the confirmed voice ID and rate.
2. Align that file at Chinese phrase level into `audio/vo-align.txt`.

Use the one project-wide `synthesize-and-align` authorization and gate for this paired operation. It authorizes only the narration and alignment writes.

Verify the decoded audio, 44100 Hz mono format, total duration in milliseconds, alignment segment count, and final aligned end time. Actual acoustic timing is authoritative. Never allocate initial shots from reading-speed estimates once narration exists. Follow the Doubao/Whisper contract in [internal-production-contracts.md](internal-production-contracts.md).

## 7. Initial visual arrangement

Run:

`node scripts/check-project-gates.mjs <candidate-project-state.json> --action generate-initial-arrangement`

Only an `ok: true` report permits generation. Build the arrangement from the verified alignment, run all arrangement validators in [visual-arrangement.md](visual-arrangement.md), then display the readable arrangement to the user. This initial display is mandatory.

## 8. Initial arrangement approval

Wait for explicit approval of the displayed arrangement. Gate the project-wide `approve-initial-arrangement` mutation, then record the approved revision. Suggestions remain proposals until approved; do not silently rewrite the arrangement, create a replacement copy, or treat discussion as approval. Later internal arrangement edits use `update-internal-arrangement` with the exact affected IDs; timing/ripple changes additionally require the matching approved proposal and `apply-timeline-revision` gate.

## 9. Chronological per-shot production

Sort every hook, body shot, and ending item by `order` then `startMs`. Produce the earliest unfinished item first. For each item:

1. Present the concrete production proposal and any affected scope.
2. Obtain authorization to build or revise that exact shot.
3. Run `check-project-gates.mjs` with `--action build-shot` and the exact ordered shot IDs; it rechecks intake/alignment, initial-arrangement approval, pending post-jump choice, and chronological/directive scope.
4. Build an independently renderable shot, run the visual/timeline/balance validators, and verify the media.
5. Present the actual versioned preview and set the shot to `waiting_for_approval`.
6. On explicit approval of that version, gate `approve-shot` for its exact ID before setting it to `approved`; on explicit feedback, gate `request-shot-changes` before setting it to `changes_requested`. Use the narrower `downgrade-approved` action when reopening an already approved shot.

An administrator may explicitly jump to a shot or request a continuous batch. Record the directive's exact action and ordered shot IDs; never expand its scope. A batch may render without pausing between its listed items, but every item keeps its own preview/version and none becomes `approved` until the user approves the displayed version. After a jump, set the pending-choice flag and ask whether to return to the earliest unfinished item or continue from the current location; gate that state update with `record-post-jump-choice`, consume the directive, and do not build another shot first.

Temporary connected previews follow [approval-state.md](approval-state.md). Gate `assemble-preview` against its exact current manifest IDs, and gate any single or batch approval separately. They are review artifacts, not final renders and not implicit permission to continue production.

## 10. Music after all shots are approved

Do not search, audition, select, or apply production music until every timeline item is `approved`. Then offer several relevant, voice-compatible, playable candidates and state each source and usage condition. Wait for the user's selection and confirmation; gate `select-music` against all timeline shot IDs in order before recording the approved track/version.

## 11. Exact final approval and render

Explain the three final conditions: all shots approved, music approved, and the user's exact phrase `确认合成`. Run:

`node scripts/check-project-gates.mjs <candidate-project-state.json> --action render-final --shots <all-final-manifest-IDs-in-order>`

Exit `2` blocks rendering. If blocked, report only the missing conditions and the next permitted action. If allowed, assemble only the non-empty `currentVersion` that exactly equals each shot's `approvedVersion`, using the exact ordered `finalAssembly.manifest`; keep narration and music continuous, run [qa.md](qa.md), and deliver the verified final video. Final approval does not authorize publication, upload, or account changes.
