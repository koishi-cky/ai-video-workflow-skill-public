# Preview, render, and delivery QA

Passing a command is not visual delivery. Use actual probing, snapshots/contact sheets, and playback evidence appropriate to the artifact.

## Before any state-changing production action

- The user's authorization names or unambiguously covers the exact action and shot scope.
- `project-state.json` is current and the applicable `check-project-gates.mjs` action returns `ok: true`.
- The initial arrangement has been displayed and approved before shot production.
- The intended shot version, arrangement revision, timeline revision, and required assets are identified.
- A real product, result, dataset, account, or screen is not simulated as verified real media.

## Shot and preview checks

- Narration cue and visible action begin together; the visual does not arrive after the phrase ends.
- When a character IP is used, A-roll identity matches the user-provided references; its signature/hash are unique, and adjacent A-roll composition changes at least three required dimensions.
- B-roll has a unique template, semantic metaphor, non-repeated adjacent skeleton, and concise keyword text.
- No old/new UI state overlap, cursor ghost, duplicate card, accidental hold, narration paragraph used as decoration, or static filler.
- First and last frames support the recorded handoff; captions remain in the safe area.
- Interface demonstrations show the whole shell, context, active workspace, interaction, and finite state feedback.
- The preview file is probed and visually inspected before it is presented.

For every temporary connected preview, show a current manifest in the conversation containing each shot ID, exact version, current status, and display order. Allowed statuses are `waiting_for_approval`, `changes_requested`, and `approved`. Confirm each ID exists, every manifest version equals the shot's `currentVersion`, every status matches project state, and `previewManifestCurrent` is true. Do not burn the labels into the media. Verify that the assembled file uses exactly those versions in that order. Preview assembly changes no status and is not final-render approval.

## Four required validators

Run the project gate appropriate to the requested action plus all three arrangement checks. Before final rendering, the commands are:

```powershell
node scripts/check-project-gates.mjs candidate-project-state.json --action render-final --shots H001,S001
node scripts/check-visual-diversity.mjs visual-arrangement.json
node scripts/check-timeline.mjs visual-arrangement.json
node scripts/check-shot-balance.mjs visual-arrangement.json
```

Every JSON report must contain `ok: true`, and every process must exit `0`. Any missing report, unreadable input, exit `2`, exit `1`, or violation blocks the affected action. Do not hand-wave a failure because a preview looks acceptable.

## Final-render gate

Before creating a final render, verify from current state:

1. every hook, body shot, and ending shot is `approved`;
2. every shot has non-empty equal `currentVersion` and `approvedVersion`, and `finalAssembly.manifest` references that version exactly once in timeline order;
3. music is selected and approved after all shots reached approval;
4. the user said exactly `确认合成` for final assembly;
5. all four validators pass on the current files.

Approval of an arrangement, individual shot, connected preview, batch, administrator jump, or the words “确认”, “可以”, “继续”, and “开始” cannot replace the exact final phrase. If any condition is absent, report the missing condition and stop before final rendering or delivery.

## Final media verification

Probe the actual output and report:

- absolute file path and size;
- duration;
- width and height;
- frame rate;
- video codec and pixel format;
- audio codec, sample rate, and channel count;
- caption presence and verified timing source;
- continuous narration and approved music across the intended range;
- absence of black frames, unexpected freezes, audio gaps, duplicate seam holds, and unapproved versions;
- all four validator results and any exact recorded authorization.

Inspect a contact sheet plus critical first/last frames and transition seams. Play the actual final file. A successful render command, reachable preview port, or generated filename alone is not delivery proof. Final delivery does not authorize publication, account actions, or external uploads.
