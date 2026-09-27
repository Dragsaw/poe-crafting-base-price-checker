---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: dirty working tree. Step 1 item 3 (version-control sanity check) requires a clean tree. Seven files carry uncommitted edits: `docs/epics.md`, `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`, and the UX `DESIGN.md`, `EXPERIENCE.md`, `mockups/key-expanded-states.html` and `mockups/key-hero-resting.html`. These edits are the UX rulings F5, F13 and F15 themselves (EXPERIENCE.md revision 11, DESIGN.md revision 9, retro action 7 set to done) and the deferred-work entry this run was asked to build. Retry condition: commit those edits on this branch, then invoke again with the same intent.
