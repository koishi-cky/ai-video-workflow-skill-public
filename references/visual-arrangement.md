# Visual arrangement, diversity, and timeline continuity

The arrangement has two synchronized representations: a readable initial approval view and the internal `visual-arrangement.json`. The internal JSON remains the current source of truth throughout production.

## Initial readable view

Segment by complete meaning, not mechanically by punctuation or pauses. Initial timestamps come directly from verified phrase alignment. Display these columns for the first approval:

| 镜头 | 时间 | 配音文案 | 画面类型 | 画面设计 | 动态变化 | 画面衔接 |
|---|---|---|---|---|---|---|

Every row must state what the audience should understand, the concrete visible subject, how it changes, the final visible result, and how it hands off to neighboring shots. Do not fabricate products, data, results, cases, or unavailable external images.

## Shared shot fields

Every timeline item requires:

- `id`, `order`, `startMs`, and `endMs`;
- exact `narration` for the interval and one `takeaway`;
- `visualClass`: `a-roll`, `b-roll`, or `mixed`;
- precise `subtype` and `semanticStructure`;
- composition/focal hierarchy, ordered `motionPhases`, and `handoff.in`/`handoff.out`;
- current status/version linkage in `project-state.json`.

`mixed` means A-roll and B-roll both materially explain the line. Captions, decorative lines, a tiny avatar, a badge, or a transition-only character do not make a shot mixed. Every mixed shot runs both complete A-roll and B-roll subcontracts, including required fields, uniqueness checks, adjacency checks, keyword/text checks, and interface checks when applicable.

## A-roll fields

Every A-roll design records these six composition dimensions:

- `viewpoint`;
- `framing`;
- `position`;
- `action`;
- `gaze`;
- `environment`.

It also records a non-empty canonical `aRollSignature` derived from the chosen composition and a non-empty `artifactHash` for the produced image. All six dimensions are required. Populate the actual hash before running visual-diversity validation or moving the version into `waiting_for_approval`; never invent a planned hash.

No `aRollSignature` or A-roll image may repeat anywhere in the video. Adjacent A-rolls must differ in at least three of the six dimensions. When using a personal character, identity follows the user-provided references described in [character-style.md](character-style.md); uniqueness changes staging, never the established IP.

## B-roll fields

Every B-roll-bearing shot records all of these non-empty fields:

- globally unique `templateId`;
- `layoutArchetype` and `motionFamily`;
- concrete `visualMetaphor`;
- two to six phrases in `keywordSet`;
- `textMode` and `onScreenText`;
- `transitionAnchor`;
- `sourceContentPurpose` only when necessary source content is being demonstrated;
- `interfaceStructure` for interface demonstrations.

Adjacent B-rolls may not reuse both `layoutArchetype` and `motionFamily`. Brand color, typography, and a transition anchor may recur, but element relationships, primary action, and phase order must be redesigned for the shot's meaning.

Ordinary B-roll uses `textMode: "keywords"`. Each Chinese keyword phrase is normally no more than eight Han characters. Store the exact interval text in that shot's non-empty `narration`; narration-copy detection compares `onScreenText` with this shot-level value, never a top-level full-script field. Do not copy the shot narration exactly or dominantly into `onScreenText`. `textMode: "source-content"` is allowed only for `subtype: "interface-demo"` with a non-empty `sourceContentPurpose`, when the document, prompt, code, or error text is itself the truthful operation object.

Interface demonstrations declare:

```json
{
  "interfaceStructure": {
    "windowShell": true,
    "contextRegion": true,
    "activeWorkspace": true,
    "interaction": true,
    "stateFeedback": true
  }
}
```

Follow [interface-demo.md](interface-demo.md) for per-shot structure and truthful-media rules.

## JSON contract

A valid initial arrangement follows this shape:

```json
{
  "project": {
    "title": "AI Agent 入门",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "durationMs": 8200
  },
  "narration": "智能体先理解目标，再执行并验证结果。",
  "timelineMode": "initial",
  "shots": [
    {
      "id": "S001",
      "order": 1,
      "startMs": 0,
      "endMs": 4100,
      "narration": "智能体先理解目标，",
      "takeaway": "先建立清晰目标。",
      "visualClass": "a-roll",
      "subtype": "character",
      "semanticStructure": "cause",
      "composition": "角色位于左侧，右侧目标卡为焦点",
      "motionPhases": ["角色抬手指向目标卡", "目标卡完成高亮"],
      "handoff": {"in": "金色线条入场", "out": "目标卡向右展开"},
      "viewpoint": "protagonist",
      "framing": "medium",
      "position": "left",
      "action": "points-to-goal",
      "gaze": "goal-card",
      "environment": "warm-cream-workspace",
      "aRollSignature": "protagonist-medium-left-points-goal-card-workspace",
      "artifactHash": "sha256:0c91d4860dc12e5dfc9c5cdd54d23e080c91d4860dc12e5dfc9c5cdd54d23e08"
    },
    {
      "id": "S002",
      "order": 2,
      "startMs": 4100,
      "endMs": 8200,
      "narration": "再执行并验证结果。",
      "takeaway": "执行和验证形成闭环。",
      "visualClass": "b-roll",
      "subtype": "infographic",
      "semanticStructure": "sequence",
      "composition": "执行节点流向验证回路",
      "motionPhases": ["执行节点点亮", "验证回路闭合", "结果标记出现"],
      "handoff": {"in": "承接目标卡右移", "out": "结果标记缩为转场点"},
      "templateId": "execution-verification-loop-s002",
      "layoutArchetype": "asymmetric-loop",
      "motionFamily": "path-trace-and-lock",
      "visualMetaphor": "闭环检验轨道",
      "keywordSet": ["执行任务", "验证结果"],
      "textMode": "keywords",
      "onScreenText": "执行任务 · 验证结果",
      "transitionAnchor": "gold-result-dot"
    }
  ],
  "authorizations": [],
  "gapAuthorizations": []
}
```

Initial arrangements use `timelineMode: "initial"` and no `timelineRevision` object. The sample hash shows the required stored form; use the actual file's hash in production.

## Timeline revisions and gaps

Initial timestamps are acoustic facts from `audio/vo-align.txt`; do not estimate or rewrite them. Any later duration or timestamp change is a proposal until approved. Before applying it, show:

- old and new times;
- exact delta;
- downstream shots affected;
- whether each downstream duration remains unchanged;
- total-duration change;
- narration, caption, transition, status, and material effects.

After approval, set `timelineMode: "update"` and attach `timelineRevision` containing `approved: true` plus `previousSnapshot.shots`. Ripple downstream absolute positions by the accumulated duration delta while preserving unaffected downstream durations. A directly affected unbuilt shot remains or returns to `planned`; a built or approved shot whose content or motion rhythm changes returns to `changes_requested`. Position-only downstream changes may retain approval after transition/sync recheck.

Timeline coverage starts at 0 and ends at `project.durationMs`. Items may not overlap. At 30 fps, a seam may differ by at most `Math.ceil(1000 / 30)` milliseconds for rounding. A longer gap needs an exact approved entry naming `beforeShotId`, `afterShotId`, `durationMs`, and a non-empty purpose. Never preserve an old timestamp with silent space, a static card, repeated animation, or black frames.

## Internal-display boundary

The initial arrangement must be shown and approved. After that, keep the internal arrangement current but do not automatically regenerate a complete table, create a new Markdown/JSON/table copy, normalize the user's formatting, or display every shot again. Fully display or export it only when the user explicitly requests the current arrangement.

When the user directly edits the current arrangement file, supplies a replacement revision, or changes a named shot in the conversation, accept that exact change into the internal source of truth and update only its affected scope. Do not use formatting consistency as permission to rewrite unrelated user content. Timing changes still require the ripple-impact disclosure and approval described above before production artifacts or shot states are mutated.

Recommendations may identify a problem and propose changes at any time, but must state the reason, affected shots, and timeline/status/material/transition effects. Do not mutate the arrangement until that exact proposal is approved.

## Required validators

Before implementing affected shots, run timeline and shot-balance checks plus plan-field review. Once every A-roll-bearing item in the checked file has its actual artifact hash, run visual diversity; run it again after each relevant artifact/version update. Before final delivery, run all three commands:

```powershell
node scripts/check-visual-diversity.mjs visual-arrangement.json
node scripts/check-timeline.mjs visual-arrangement.json
node scripts/check-shot-balance.mjs visual-arrangement.json
```

Each must return `ok: true`. Exit `2` blocks the action. The shot-balance validator requires unique non-empty shot IDs, unique finite `order` values, and finite `startMs`, then sorts by `order` and `startMs` before finding runs. It blocks three or more consecutive pure A-roll or pure B-roll items unless an exact sorted shot-ID run has an approved authorization and reason. Before requesting that exception, explain the affected IDs, editorial benefit, cost of breaking the run, and at least one alternative.
