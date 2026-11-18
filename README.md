# AI Video Workflow Skill

A Codex skill for producing horizontal AI explainer videos with explicit user approvals, reusable project-state checks, and shot-level previews.

## Included

- `SKILL.md` — workflow entry point and approval gates
- `references/` — production, approval, arrangement, character, and QA rules
- `scripts/` — project, timeline, visual-diversity, and shot-balance validators
- `tests/` — generic automated tests and fixtures
- `assets/mac-interface-template/` — an original interface-animation example

## Personal character assets

No personal character images are included. If you choose to use a character IP, provide your own character, scene, and style references in your project. You can also choose to make a video without a personal character.

## Key approval rules

- Each completed shot gets a versioned preview and waits for the user's approval before the next shot, unless the user explicitly authorizes a batch.
- A final video can be rendered only after every shot and the music are approved and the user says `确认合成`.
- Three or more consecutive pure A-roll or pure B-roll shots require an explanation and explicit user authorization.
- A-roll compositions and B-roll templates must not be reused within the same video.

## Installation

Clone this repository into your Codex skills directory:

```powershell
git clone https://github.com/koishi-cky/ai-video-workflow-skill-public.git "$env:USERPROFILE\.codex\skills\ai-video-workflow"
```

Then invoke `$ai-video-workflow` in Codex and provide the theme and script. The skill will collect voice, character, account/CTA, and required-image decisions before production.

## Validation

```powershell
node --test tests/*.test.cjs
```

See `THIRD_PARTY_NOTICES.md` for dependency and license notes.
