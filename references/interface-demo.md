# Truthful original Mac-style interface demonstrations

Use this treatment when the viewer must understand software, Agent, prompt entry, upload, processing, testing, error repair, or result behavior and no approved real footage is available or suitable. In the arrangement, “real material” defaults to this original demonstrative interface, not a real-product screen recording.

## Complete per-shot structure

An interface shot is a complete original software surface, not a text card decorated with traffic lights. Declare every field as true in `interfaceStructure` only when it is visibly present:

- `windowShell`: stable rounded outer frame, title bar, and red/yellow/green controls.
- `contextRegion`: sidebar, navigation, recent tasks, or an equivalent credible context anchor.
- `activeWorkspace`: prompt, document, file, test, settings, result, or error area appropriate to this shot.
- `interaction`: visible cursor plus the correct press, drag, selection, or typing response.
- `stateFeedback`: a finite submitted, processing, result, plan, error, repaired, tested, or next-action state.

Do not copy real brand names, commercial-product chrome, user accounts, private content, or unverified outputs. Label the surface as an interface demonstration when viewers could mistake it for actual footage.

## Shot-specific uniqueness

Every interface shot receives a globally unique `templateId`. Design its workspace modules, element relationships, interaction path, state sequence, focal coordinates, result structure, and timing for that shot's task. Merely replacing words in a previous layout is reuse and is blocked.

Adjacent interface B-rolls may not reuse both `layoutArchetype` and `motionFamily`. Shared outer-shell visual language is allowed, but the interface's explanatory skeleton must change with the meaning.

The bundled `assets/mac-interface-template/index.html` is a method example and optional source scaffold. It is not a fixed layout, reusable shot, video asset, or default composition. Never insert it unchanged or keep its workspace merely because implementation would be faster.

## Camera and state sequence

1. Establish enough of the whole window to make the software context legible.
2. Keep the outer shell and title bar stable.
3. Move only the internal workspace toward the focal control, using one camera wrapper and a continuous zoom/pan; do not scale the traffic-light frame.
4. Show input in semantic phrase groups. Preserve the actual task and conditions without converting narration into a headline.
5. Move the cursor to the correct target and synchronize cursor arrival with target compression on click.
6. End the input state before the submitted state appears; avoid crossfaded duplicate text and caret ghosts.
7. Pull the workspace back to a readable neutral view.
8. Keep processing finite, normally under one second unless a visible thinking interval is semantically required.
9. Reveal a credible plan, result, log, repaired state, test, or next action in ordered phases.
10. Hold the final readable state for at least one second.

For upload behavior, use file selection, cursor-locked drag, drop confirmation, and finite progress. For error repair, preserve one error object across the handoff so cause, change, and verification remain connected.

## Text and design rules

- Use the current video's palette and typography; traffic-light colors remain native accents.
- Fill the frame and keep operational text readable at 1080p.
- Use clear zones, controlled depth, natural easing, and one focal action at a time.
- Avoid decorative grids, particles, generalized AI glow, irrelevant English, and constant camera drift.
- Ordinary interface labels use keyword mode. Full source content is allowed only when a prompt, document, code block, or error is the operation object; set `textMode: "source-content"` and state a truthful `sourceContentPurpose`.

Before rendering, use the `hyperframes` workflow and inspect the whole-window pose, focal pose, click or drop boundary, pull-back pose, processing boundary, final readable state, and transition seams with snapshots.
