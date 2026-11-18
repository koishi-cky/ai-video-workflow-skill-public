# Approval state and exact-scope authorization

`project-state.json` is the workflow ledger. Keep only structured decisions and current facts; never copy the full conversation into it. Read-only inspection and recommendations do not mutate this file.

## Project-state contract

A state file carries at least these domains:

```json
{
  "schemaVersion": 2,
  "projectId": "agent-course-2026-09",
  "stage": "shot-production",
  "voice": {
    "name": "旁白女声",
    "id": "example-only-not-a-provider-id",
    "rate": 1.0,
    "confirmed": true,
    "audioPath": "audio/vo-full.wav",
    "durationMs": 186115
  },
  "alignment": {
    "path": "audio/vo-align.txt",
    "verified": true,
    "segmentCount": 38,
    "finalEndMs": 186115
  },
  "characterIp": {
    "useExisting": true,
    "confirmed": true
  },
  "cta": {
    "avatar": true,
    "followButton": true,
    "endingGuidance": "关注后获取下一期教程",
    "confirmed": true
  },
  "requiredImages": {
    "items": ["assets/source/workflow-map.png"],
    "confirmed": true
  },
  "initialArrangement": {
    "revision": 1,
    "displayed": true,
    "approved": true
  },
  "actionAuthorization": {
    "approved": true,
    "action": "approve-shot",
    "shotIds": ["S001"]
  },
  "internalArrangementRevision": null,
  "timelineRevision": null,
  "shots": [
    {
      "id": "H001",
      "order": 1,
      "startMs": 0,
      "endMs": 3200,
      "status": "approved",
      "currentVersion": "v2",
      "approvedVersion": "v2"
    },
    {
      "id": "S001",
      "order": 2,
      "startMs": 3200,
      "endMs": 7400,
      "status": "waiting_for_approval",
      "currentVersion": "v3",
      "approvedVersion": null
    }
  ],
  "adminDirective": null,
  "postJumpChoiceRequired": false,
  "postJumpChoice": null,
  "previewManifestCurrent": true,
  "previewManifest": [
    {
      "shotId": "S001",
      "version": "v3",
      "status": "waiting_for_approval",
      "order": 1
    }
  ],
  "music": {
    "selectedTrackId": null,
    "approved": false
  },
  "finalAssembly": {
    "approved": false,
    "phrase": null,
    "manifest": []
  }
}
```

Use stable IDs. Hooks or cold opens before S001 are separate timeline items such as H001. `stage` reflects the current workflow stage; it does not authorize the next action. The sample voice ID is deliberately non-operational; production must store the exact user-confirmed provider ID.

## Shot statuses and versions

Allowed statuses are:

- `planned`: arranged but not in production.
- `in_progress`: the exact authorized version is being built.
- `waiting_for_approval`: an actual versioned preview has been shown.
- `changes_requested`: the user asked to change the current or formerly approved shot.
- `approved`: the user explicitly approved the recorded version.

Normal production follows:

`planned -> in_progress -> waiting_for_approval -> approved`

Feedback follows:

`waiting_for_approval -> changes_requested -> in_progress -> waiting_for_approval`

An approved shot may be reopened:

`approved -> changes_requested -> in_progress -> waiting_for_approval -> approved`

When reopening, retain old artifacts as recoverable versions but clear the current final-assembly eligibility until a new version is approved. Final assembly always uses each shot's latest `approvedVersion`; older versions never enter it automatically.

## Gate checks

Before any workflow-managed write or state change, prepare the exact candidate state from the user's explicit instruction and run the gate against that candidate before persisting it:

`node scripts/check-project-gates.mjs <candidate-project-state.json> --action <action> [--shots S001,S002]`

Normal actions require a structured candidate-state record whose action and ordered scope exactly match the invocation:

```json
{
  "actionAuthorization": {
    "approved": true,
    "action": "approve-shot",
    "shotIds": ["S001"]
  }
}
```

The authorization is evidence of a user instruction for that exact mutation, not a value the agent may create from general conversation. A reply such as “可以”, “继续”, feedback, discussion, or approval of a different artifact cannot substitute for it. Project-wide actions use `shotIds: []`; shot-scoped actions require a non-empty unique ordered list, the same `--shots` list, and existing matching shots. Do not persist a candidate that exits nonzero. Exit `0` allows only that action and exact scope; it cannot be reused for another action or scope.

The complete allowlist and machine preconditions are:

| Action | Required scope and preconditions |
| --- | --- |
| `record-intake` | Project-wide `[]`; voice, character IP, CTA/account, and required-image decisions are explicitly confirmed. |
| `synthesize-and-align` | Project-wide `[]`; all four intake decisions are confirmed. The single authorization covers the continuous narration-plus-alignment operation and no unrelated write. |
| `generate-initial-arrangement` | Project-wide `[]`; intake is confirmed and actual alignment is verified. |
| `approve-initial-arrangement` | Project-wide `[]`; intake/alignment is valid and the arrangement was displayed. |
| `update-internal-arrangement` | Exact affected shot IDs; the displayed initial arrangement is approved and `internalArrangementRevision` has `approved: true`, a non-empty `revisionId`, and the same ordered IDs. |
| `apply-timeline-revision` | Exact affected shot IDs; the displayed initial arrangement is approved and `timelineRevision` has `approved: true`, a non-empty `revisionId`, and the same ordered IDs. |
| `build-shot` | Exact non-empty shot IDs in `planned`, `in_progress`, or `changes_requested`; intake/alignment and initial-arrangement approval are current, no post-jump choice is pending, and the scope is the earliest unfinished shot unless an exact approved administrator directive applies. |
| `record-post-jump-choice` | Project-wide `[]`; a choice is pending and the recorded value is exactly `earliest-unfinished` or `continue-from-current`. |
| `request-shot-changes` | Exact non-empty shot IDs; each named shot currently is `waiting_for_approval` or `approved`. It records exact-scope review feedback and may reopen explicitly named approved shots. |
| `downgrade-approved` | Exact non-empty approved-shot IDs; explicitly reopens only those approved versions as `changes_requested`. It is the narrow alias when the mutation is specifically an approved-shot downgrade. |
| `approve-shot` | Exactly one shot ID; that shot has a non-empty current version in a reviewable status and a current preview-manifest entry matching that version and status. Multi-shot approval must use `approve-preview-batch`. |
| `assemble-preview` | Exact ordered IDs of every current preview-manifest entry; the manifest is current and every entry matches an existing shot's current version and status. |
| `approve-preview-batch` | Exact non-empty unique ordered preview-manifest IDs plus the matching approved batch `adminDirective`; empty, duplicate, stale, unknown, or reordered scope is blocked. |
| `select-music` | Exact ordered IDs of every timeline shot; all are approved, have equal non-empty current/approved versions, and the selected track is explicitly approved. |
| `render-final` | Exact ordered IDs of `finalAssembly.manifest`; all final-shot, music, exact-phrase, version, and manifest conditions pass. |

Every listed action has its own validation branch. Any other action returns `ACTION_UNSUPPORTED`; there is no permissive fallback. `build-shot` rechecks the five intake/alignment confirmations and requires `initialArrangement.displayed` and `initialArrangement.approved` before chronological or administrator scope is evaluated.

## Administrator directives

The user may override chronological production for an exact jump or batch. Record the directive only after an explicit command:

```json
{
  "approved": true,
  "action": "build-shot",
  "shotIds": ["S006", "S007", "S008"],
  "purpose": "连续制作指定范围供批量检查"
}
```

The action and unique ordered `shotIds` must exactly match the gate invocation. Do not add neighboring shots, repeat an ID, infer a larger range, or reuse the directive after its scope is complete. A directive authorizes production only; it does not approve outputs, music, final rendering, publication, or uploads.

After any jump, the validator returns `context.postJumpChoiceRequired: true`. Set `postJumpChoiceRequired: true` and leave `postJumpChoice` null until the user chooses one of these exact values:

- `earliest-unfinished`: return to the earliest timeline item that is not `approved`;
- `continue-from-current`: continue from the current location.

Do not choose on the user's behalf. While the flag is true, every later `build-shot` request is blocked with `POST_JUMP_CHOICE_REQUIRED`, even if a value was written prematurely. After the user chooses, record one allowed value, clear the flag, and consume the one-use directive in that exact authorized state update; invalid values remain blocked with `POST_JUMP_CHOICE_INVALID`. Only then may the next `build-shot` gate run.

## Temporary connected previews

A temporary preview may include only current versions in `waiting_for_approval`, `changes_requested`, or `approved`. Before assembly, set `previewManifestCurrent: true` and create `previewManifest` with every shot's ID, exact version, current status, and display order; show those labels in the conversation. Do not burn status labels into the video.

Every manifest entry must reference an existing `shots[]` item, its `version` must equal that shot's non-empty `currentVersion`, and its `status` must equal the current project-state status. Any shot edit, version increment, status transition, replacement preview, or arrangement change that affects the preview sets `previewManifestCurrent: false` until a new manifest is shown.

Run `assemble-preview`. The preview is read-only with respect to shot approval. It does not approve a version, authorize later shots, select music, or authorize final assembly.

## Batch approval of displayed versions

Batch approval applies only to the most recently and unambiguously displayed manifest. The user must clearly approve those specific displayed versions. Record an exact directive:

```json
{
  "approved": true,
  "action": "approve-preview-batch",
  "shotIds": ["S006", "S007", "S008"],
  "purpose": "用户确认当前连接预览中的三个版本"
}
```

Run `approve-preview-batch` with a non-empty unique `--shots` argument containing the same IDs in manifest display order. Empty CLI scope, duplicate IDs, empty project shots, unknown IDs, stale versions/statuses, or an invalidated manifest block approval. On success, update only matching `waiting_for_approval` or `changes_requested` entries to `approved` and set their `approvedVersion` to the displayed version. Existing approved entries remain approved. If multiple previews could be meant, ask which one; do not guess.

Batch approval does not authorize continued production, music selection, final rendering, publication, or uploads.

## Final gate

Music selection may start only after every shot is `approved`. Final rendering requires all of these at the same time:

1. every timeline item is `approved`, both `currentVersion` and `approvedVersion` are non-empty, and those versions are equal;
2. the selected music is approved;
3. `finalAssembly.approved` is true and `finalAssembly.phrase` is exactly `确认合成`;
4. `finalAssembly.manifest` lists every shot ID, unique `order`, and matching `approvedVersion` in timeline order.

The phrases “确认”, “可以”, “继续”, and “开始” do not qualify. Neither temporary-preview approval nor any administrator directive qualifies. When `render-final` is blocked, report the violations and stop before creating a final video.
