---
name: ai-video-workflow
description: Use when a user provides a theme, complete script, narration, or shot brief and wants a horizontal AI explainer video, visual arrangement, A-roll/B-roll production, motion design, captions, music, previews, revisions, or a final render.
metadata:
  short-description: Approval-gated script-to-video workflow with unique shot design
---

# AI Video Workflow

Turn an approved script into a 16:9 video while keeping every write, state transition, shot build, preview assembly, and render inside the user's exact authorization scope. Defaults are 1920x1080, 30 fps, horizontal.

## New-project intake

Confirm these once, in order, before production:

1. Theme and complete script.
2. Voice name and exact voice ID. Never invent an ID.
3. Whether to use an existing character IP.
4. Account avatar, follow button, CTA, and ending-guidance choices, including an explicit decision that none are needed.
5. Required-image list, including an explicit decision that no image is mandatory.

Record confirmations in `project-state.json`. When the user selects a character IP, ask them to provide their own character, scene, and style references or configure project-relative paths. Never assume personal assets are bundled with this Skill. If no IP is selected, design scenes and A-roll without a personal character. After intake, create continuous narration and phrase alignment as one uninterrupted authorized operation.

Read [workflow.md](references/workflow.md) for the exact sequence and [approval-state.md](references/approval-state.md) for state schema, shot statuses, administrator directives, preview manifests, and approval semantics.

## Hard gates

- Before every file write, state transition, timeline change, shot build, preview assembly, approval mutation, music selection, or render, verify that the user's authorization covers that exact action and unique ordered shot scope. Run `node scripts/check-project-gates.mjs <candidate-project-state.json> --action <action> [--shots S001,S002]` for every allowlisted mutation. Exit `2` blocks the action; an unknown action or an ordinary reply without matching structured authorization is never permission.
- Generate the initial arrangement only after voice/ID, IP, account/CTA, required-image decisions, and actual audio alignment are confirmed. Display it once and wait for approval.
- Produce timeline items by `order` then `startMs`, beginning with the earliest hook or shot. An approved administrator directive may jump or batch only its exact ordered shot IDs. After a jump, ask whether to return to the earliest unfinished item or continue from the current position.
- Give every completed shot an actual versioned preview and wait for the user's approval before proceeding, unless the user explicitly authorizes a batch. Temporary connected previews change no shot state by themselves.
- Do not reuse an A-roll image/signature or a B-roll `templateId`; extract concise keywords instead of copying narration into ordinary B-roll text; never fill shortened timing with a blank hold.
- Avoid three or more consecutive pure A-roll or pure B-roll shots. If the story requires such a run, explain the affected shots, the editorial reason, and alternatives, then wait for explicit authorization.
- Begin music selection only when every shot is `approved`. Offer multiple suitable, playable choices with source and usage conditions; wait for selection and approval.
- Final rendering requires every shot `approved`, music approved, and the exact phrase `确认合成`. “确认”, “可以”, “继续”, preview approval, administrator jumps, and batch-production approval are not final-render authorization.
- Publication, account actions, and external uploads always require separate authorization.

## Route only what is needed

- End-to-end order and production handoffs: [workflow.md](references/workflow.md).
- State, versions, directives, previews, batch approval, and final gates: [approval-state.md](references/approval-state.md).
- Arrangement schema, uniqueness fields, timeline revisions, and validator commands: [visual-arrangement.md](references/visual-arrangement.md).
- A-roll identity and composition: [character-style.md](references/character-style.md).
- Truthful original software demonstrations: [interface-demo.md](references/interface-demo.md).
- Production contracts: [internal-production-contracts.md](references/internal-production-contracts.md).
- Preview, render, and delivery verification: [qa.md](references/qa.md).

Use HyperFrames for authored motion/video and its routed sub-skills. Use media-use for voice, alignment, captions, music, and other media operations. Keep each shot independently renderable so approved versions and revisions remain local.
