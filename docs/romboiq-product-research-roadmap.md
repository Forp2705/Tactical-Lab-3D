# RomboIQ Product Research Roadmap

Date: 2026-06-04
Status: Research roadmap only. No code changes implemented in this pass.

## 1. Executive verdict

RomboIQ is no longer a random stack of tactical features. It now has a credible product spine:

- `Sala` as command center in [HomeView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/home/HomeView.tsx)
- `Diagnostico` in [AiView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/AiView.tsx)
- `Sesion` in [SessionsView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/sessions/SessionsView.tsx)
- `Post-partido` in [PostMatchAnalysisView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/post-match/PostMatchAnalysisView.tsx)
- `Equipo / evolucion` in [TeamView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/team/TeamView.tsx) and [TeamTimeline.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/home/TeamTimeline.tsx)

That is real progress.

But RomboIQ is still not a truly strong product yet. It is a strong direction plus a partially converged execution.

The main product problem is no longer "too few features". It is:

- not enough trust in the AI core
- not enough reduction of complexity in secondary surfaces
- not enough productization of the best workflows
- not enough continuity between tactical decision, field work, and retrospective learning

Brutal truth:

- the product is closer to a smart football workbench than to the best product in its category
- the path forward is convergence and hardening, not expansion

## 2. Product strength score from 1 to 10

Current product strength score: **6/10**

Why not lower:

- the weekly loop is now visible
- there is genuine product thinking in the current navigation and home layer
- the AI Coach already has more structure than a generic assistant
- the product already covers diagnosis, training, review, and evolution in one system

Why not higher:

- AI trust is still materially incomplete
- several important surfaces still feel like advanced internal tools
- architectural weight is high in the exact areas that still need refinement
- the best value moments are present, but not yet bulletproof

## 3. Current strongest value

RomboIQ's strongest value today is not the 3D viewer, not the tactical board, and not the number of modules.

Its strongest value is this:

**a coach can keep one weekly tactical thread alive from problem observation to training response to post-match review instead of losing it across notes, messaging, diagrams, and memory.**

That value is visible in:

- the next-action framing in [HomeView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/home/HomeView.tsx)
- the structured Coach output and diagnosis-to-session CTA in [AiView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/AiView.tsx)
- the explicit session origin card in [SessionsView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/sessions/SessionsView.tsx)
- the post-match reopen-in-diagnosis / evolution handoff in [PostMatchAnalysisView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/post-match/PostMatchAnalysisView.tsx)
- the recurring pattern layer in [TeamTimeline.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/home/TeamTimeline.tsx)

This is the wedge to protect.

## 4. Biggest product weaknesses

### Must-fix weaknesses

1. **AI trust is still not product-grade.**
   Evidence exists in the repo that the pipeline still tolerates outputs with evidence but no attached citations:
   [CoachPipeline.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/CoachPipeline.ts), [coach-observability.jsonl](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/generated/coach-observability.jsonl), [coachTurnFlow.test.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/tests/coachTurnFlow.test.ts).

2. **The product is still denser than it needs to be.**
   The main loop is clearer, but the product still exposes too much advanced capability too close to the core path, especially in [TeamView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/team/TeamView.tsx), [VideoView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/video/VideoView.tsx), and the detail-heavy sections of [PostMatchAnalysisView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/post-match/PostMatchAnalysisView.tsx).

3. **The best insight surfaces still do not feel inevitable.**
   The product has strong mechanics, but the coach still needs more help understanding what the product has learned, what changed, and what deserves attention next week.

4. **The library and recommendation layer are still underused as a product asset.**
   [LibraryView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/library/LibraryView.tsx) is curated and useful, but it still behaves more like a searchable catalog than an intelligent assistant to the loop.

5. **Some key UI surfaces still read like a developer prototype with good taste.**
   This is especially true in copy quality, density, mixed language, and inline-style-driven hierarchy in [HomeView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/home/HomeView.tsx), [SessionsView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/sessions/SessionsView.tsx), [AppShell.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ui/AppShell.tsx), and [App.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/app/App.tsx).

## 5. Core loop analysis

## Observe

### What works today

- The Home view and video evidence summary now give the coach a place to start.
- `Video` is no longer presented as the main product, which is good.
- `Home` surfaces evidence count and recent reports.

### What feels weak

- Evidence collection is still split between manual video tags, tracks, notes, and reports.
- The app still lacks a truly simple "capture observation now" flow for coaches who do not want to enter the `Video` surface.

### What is confusing

- `VideoView.tsx` contains both manual tagging/tracking and advanced pattern scan ideas, which makes the surface feel broader than the current product needs.

### What is missing

- a lightweight observation inbox
- faster note-to-evidence capture from Home or Post-match
- clearer evidence quality levels

### What should be polished

- add a simpler evidence entry path outside Video
- show evidence quality, not just evidence quantity

### What should be added only if necessary

- lightweight manual evidence bundles such as "three observations from the match"

## Diagnose

### What works today

- The Coach has structure.
- It can ask follow-up questions.
- It differentiates `question`, `hypothesis`, and `diagnosis`.
- It already exposes confidence and known/unknown blocks.

### What feels weak

- The trust ceiling is still too low because citation attachment is inconsistent.
- Tactical specificity is good in shape, but not always strong enough in grounded conviction.

### What is confusing

- The Coach cockpit still exposes a lot at once: status, context, reports, memory, patterns, interview state, and result.

### What is missing

- stronger hard rules for when the AI must stay hypothetical
- clearer progression from vague issue to grounded tactical decision
- a visible tactical problem backlog

### What should be polished

- result prioritization
- evidence clarity
- stronger language distinction between advice and certainty

### What should be added only if necessary

- a "reopen diagnosis" history, not a broader new AI feature set

## Train

### What works today

- Diagnosis to session handoff is real.
- Session origin is now visible.
- The planner already supports microcycle awareness.

### What feels weak

- The session still feels closer to a planner than to a tactical response system.
- The link between diagnosis, objective, exercise choice, and success criteria needs to be more explicit.

### What is confusing

- The drag-and-drop planner still exposes catalog mechanics more than tactical intent.

### What is missing

- stronger "why this block exists" framing
- simple training objective tracking
- clearer test criteria from Wednesday to Saturday

### What should be polished

- visible tactical objective per block
- consistent diagnosis metadata in the session

### What should be added only if necessary

- a lightweight objective tracker, not a giant planning module

## Review

### What works today

- Post-match can generate, save, PDF-export, and feed memory.
- The app correctly keeps staff control over memory writes.

### What feels weak

- The default path is still more complex than many coaches need.
- The surface is capable, but the simple review experience still needs compression.

### What is confusing

- The distinction between simple and advanced input is useful, but the overall screen is still long and cognitively heavy.

### What is missing

- clearer review summary templates
- better "what changed from the previous diagnosis/session?" reflection

### What should be polished

- the first 5 minutes of post-match use
- clearer "next week implications"

### What should be added only if necessary

- planned-session vs match-outcome comparison

## Evolve

### What works today

- `TeamTimeline` now treats evolution as a product surface, not just a data dump.
- Pattern detection already extracts repeated problems, improvements, regressions, not-trained issues, and model contradictions in [patternDetection.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/patternDetection.ts).

### What feels weak

- Pattern confidence is still heuristic and can feel thin.
- Evolution is visible, but not yet indispensable.

### What is confusing

- The product still does not make it fully obvious how evolution decisions change the next week's work.

### What is missing

- tactical problem backlog
- stronger recurring pattern detector presentation
- visible "trained / unresolved / regressing" cycle

### What should be polished

- next-week decision framing from pattern history
- stronger relationship between session objectives and later review

### What should be added only if necessary

- pattern-to-plan comparison, if kept simple

## 6. AI Coach quality analysis

## What is already strong

- The Coach is not a blank chatbot.
- The output schema is disciplined in [CoachSchemas.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/CoachSchemas.ts).
- It already contains:
  - tactical reading
  - problem breakdown
  - probable cause
  - main adjustment
  - alternative adjustments
  - on-field instructions
  - field tests
  - risks
  - success signals
  - reflection/confidence
  - citations
  - model contrast
  - player fit warnings

That is materially better than generic AI usage.

## What is still weak

1. **Citation discipline is still not strong enough.**
   The product knows this. The guard and pipeline already acknowledge the problem in [coachOutputGuard.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/coachOutputGuard.ts) and [CoachPipeline.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/CoachPipeline.ts). But the existence of the warning is not the same as solving the issue.

2. **Confidence calibration is still more cosmetic than contractual.**
   It is visible in the UI, but not yet strict enough in the generation logic.

3. **The Coach is useful, but not yet reliably "major product advantage" useful.**
   It can structure thought well, but it still needs harder grounding to feel safer than a skilled coach using a notebook and ChatGPT carefully.

4. **Actionability is present but still uneven.**
   The diagnosis-to-session handoff is strong. The ability to turn vague input into a sharp tactical intervention still needs better evidence gating and sharper summarization.

## Exactly what must improve

### Must-have

- no diagnosis mode with evidence present and zero valid citations
- hard downgrade from diagnosis to hypothesis when citation attachment fails
- confidence ceiling tied to evidence quality
- stricter output phrasing when case evidence is absent
- benchmark cases for vague, partial, contradictory, and misleading inputs

### Should-have

- clearer tactical specificity in the final result summary
- better session-generation rationale from diagnosis
- stronger contrast between "training intervention" and "tactical interpretation"

### Later

- personalized team identity conditioning based on repeated accepted memory

## 7. UX/UI polish analysis

## UX verdict

The UX is much better than before, but still not simple enough.

The product now tells a story. It still does not always minimize the work required to follow that story.

### What works

- the loop is now legible in navigation
- Home is a real operating surface
- advanced tools are no longer in the primary path
- AI unavailable state is more productized

### What is still weak

- some surfaces still try to do too much
- labels are improved but not fully clean
- empty states are better, but still not consistently instructive
- advanced tools are hidden better, but the system still feels broad

### UX improvements recommended

#### Must-have

- simplify "observe" entry from Home
- make tactical problem backlog explicit
- make session objective and review criteria more visible
- compress post-match simple path further
- clarify "what should I do next?" after every major action

#### Should-have

- add a weekly summary card on Home: current problem, current session goal, latest review result, current evolution signal
- make the `Briefing` flow feel more deliberate, not just a secondary screen

#### Later

- guided "staff review" mode if it can stay lightweight

## UI verdict

The product has a stronger football-specific tone than a generic SaaS dashboard. It still has several signs of prototype-era inconsistency:

- mixed visual density
- lingering copy/encoding roughness
- heavy use of inline styles in key screens
- two global style systems still imported in [App.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/app/App.tsx)

### What still feels like a dev prototype

- mixed language/meta copy in [AppShell.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ui/AppShell.tsx)
- visible mojibake remnants in touched screens
- print-style behavior still present in some paths
- dense secondary surfaces with weak visual decomposition

### What must be polished

- visual hierarchy in Home and Session
- typography consistency
- spacing discipline
- button hierarchy
- report/export layout quality
- secondary panel simplification

## 8. Feature audit

### A) Core and should be improved now

- `Sala` / Home command center
- AI Coach diagnosis
- diagnosis to session handoff
- post-match review
- evolution / pattern timeline
- export/reporting for the core loop
- seeded demo and onboarding

### B) Useful but should stay secondary

- 3D viewer
- library browsing
- player briefing view
- lineup publication into coach context

### C) Confusing or too advanced

- scenario simulator
- full game model builder inside weekly core path
- advanced video pattern scan
- deep opponent scouting for the current product phase

### D) Should be hidden for now

- any feature that implies automated video intelligence beyond the current manual-plus-assisted reality
- advanced "analysis lab" behaviors that compete with the main loop

### E) Should be removed or merged

- duplicated or ambiguous "print" behaviors where a stronger branded export already exists
- theme/system complexity that is not visibly productized
- secondary meta copy that does not help a coach act

### F) Missing and worth adding

1. **Tactical problem backlog**
2. **Training objective tracker**
3. **Planned session vs post-match outcome comparison**
4. **Better onboarding/reset flow**
5. **Exercise recommendation engine linked to diagnosis**
6. **Staff review mode or coaching review summary**

### G) Missing but not worth adding yet

- automatic video analysis
- multiuser collaboration
- academy-wide admin system
- broader scouting intelligence platform
- mobile-first workflow

## 9. Missing high-value features

Only high-value features that reinforce the loop belong here.

### 1. Tactical problem backlog

Problem solved:

- coaches repeatedly revisit issues without a clear operating list

Why it belongs:

- it makes `evolve` operational instead of descriptive

Loop connection:

- observe -> diagnose -> train -> review -> backlog update -> next week

MVP:

- list of recurring/open/solved problems tied to reports and sessions

Build now or later:

- **Now**

### 2. Training objective tracker

Problem solved:

- sessions exist, but the product does not yet make weekly training intent explicit enough

Why it belongs:

- it strengthens the bridge between diagnosis and field work

MVP:

- per-session objective, test signal, and review status

Build now or later:

- **Now**

### 3. Planned session vs post-match outcome comparison

Problem solved:

- the product does not yet fully show whether the week's training response changed the next match

Why it belongs:

- this is the strongest proof of the loop's value

MVP:

- after report generation, show: trained focus, match evidence, unchanged/improved/regressed

Build now or later:

- **Soon, but after trust hardening**

### 4. Exercise recommendation engine

Problem solved:

- the library is rich, but still too manual in the context of diagnosis

Why it belongs:

- it turns the catalog into tactical leverage

MVP:

- recommend 3 to 5 exercises based on diagnosis domain, principle, player count, and load

Build now or later:

- **Now, but keep it simple**

### 5. Better onboarding

Problem solved:

- pilot readiness is not the same as self-explanatory product behavior

Why it belongs:

- it improves product strength directly, not just acquisition

MVP:

- first-run sample week, reset demo, create-my-team path, guided initial setup

Build now or later:

- **Now**

### 6. Player briefing mode refinement

Problem solved:

- coach-to-player communication is still underexploited

Why it belongs:

- it converts analysis into communication

MVP:

- one simplified weekly briefing generated from the session or diagnosis

Build now or later:

- **Soon**

### 7. Staff review mode

Problem solved:

- post-match and diagnosis outputs are still dense for staff discussion

Why it belongs:

- it strengthens internal alignment for small staffs

MVP:

- a compact review mode with top 3 issues, top 3 actions, and evidence

Build now or later:

- **Later than backlog/objective tracking**

## 10. Features to hide/remove/postpone

### Hide or de-emphasize

- scenario simulator
- advanced opponent scout
- full game model builder from core path
- video pattern scan as a primary concept
- highly technical team analysis tabs

### Merge or narrow

- export/print behaviors
- secondary metadata surfaces that repeat the same operational information

### Postpone

- automatic video intelligence
- collaborative multiuser workflows
- broad scouting intelligence
- club-wide admin layers
- anything requiring backend/platform scope expansion

## 11. Competitive/product benchmark

This benchmark is about product shape, not sales.

### TacticalPad-style products

Observed product shape:

- strongest at fast drill drawing, session planning, lineups, 2D/3D animation, and export
- weak at weekly tactical memory and diagnosis continuity

Reference:

- [TacticalPad official site](https://www.tacticalpad.com/)

What RomboIQ already does better:

- weekly tactical loop continuity
- structured diagnosis
- evolution/memory layer

What RomboIQ still does worse:

- simplicity
- instant board creation speed
- polished communication/export utility

### Hudl / analysis stack products

Observed product shape:

- strongest at capture, synced video, analysis workflow, player development evidence, and data-rich review

Reference:

- [Hudl soccer product](https://www.hudl.com/sports/soccer)

What RomboIQ already does better:

- one-team tactical reasoning loop for a small staff
- diagnosis-to-session continuity

What RomboIQ still does worse:

- evidence scale
- video workflow maturity
- data/report depth
- trust in grounded analysis

### Coach planning apps such as Coachbetter

Observed product shape:

- strong on training planning, exercise libraries, matchday management, player development, and broader club workflows

Reference:

- [Coachbetter official site](https://www.coachbetter.com/)

What RomboIQ already does better:

- tactical operating logic
- deeper tactical diagnosis concept
- tighter loop between problem and intervention

What RomboIQ still does worse:

- onboarding breadth
- system completeness around coaching operations
- daily ease of use in simpler workflows

### Coach board tools such as Once Sport Coach Board

Observed product shape:

- strong on ease, offline use, animations, presentation, and export

Reference:

- [Once Sport Coach Board](https://once.sport/coach-board/)

What RomboIQ already does better:

- integrated tactical operating model

What RomboIQ still does worse:

- simplicity and fast communication workflow

### Generic AI / ChatGPT workflows

Observed product shape:

- strong at flexibility and conversational exploration
- weak at productized football workflow, evidence discipline, session handoff, and team memory structure

Reference:

- [OpenAI Help: Projects in ChatGPT](https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt)

What RomboIQ already does better:

- domain structure
- controlled output shape
- loop integration

What RomboIQ still risks:

- if grounding is weak, it loses the main reason not to just use generic AI carefully

## 12. Technical/product architecture risks

### Biggest maintainability risks

Large files in the exact parts that need ongoing product refinement:

- [AiView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/AiView.tsx): 2060 lines
- [CoachAgent.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/CoachAgent.ts): 1737 lines
- [LineupLab3D.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/team/LineupLab3D.tsx): 1827 lines
- [PostMatchAnalysisView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/ai/post-match/PostMatchAnalysisView.tsx): 1351 lines
- [useAppStore.ts](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/state/useAppStore.ts): 1188 lines
- [VideoView.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/video/VideoView.tsx): 1247 lines

Risk:

- product changes in these areas will get slower and riskier

### State management complexity

- Zustand is still a good fit for the product phase
- the problem is not the choice of Zustand
- the problem is too much behavior and product state concentrated in one store

### AI pipeline reliability

- the boundaries are conceptually correct
- the reliability issue is in grounded output discipline, not in the general architecture

### Test coverage

Strength:

- the AI and product logic already have more tests than most products at this stage

Weakness:

- the tests still need stronger business-grade acceptance around usefulness, citations, and regression scoring

### Export/report architecture

- HTML-based document export is practical for now
- the main risk is inconsistency and fragmented output quality

### Data persistence

- local-first via Dexie is acceptable for the current product phase
- the missing piece is stronger user confidence around backup, import, and continuity

### Demo/onboarding state

- demo seed exists
- onboarding is still not isolated enough as a product system

## 13. Performance risks

Current dist evidence:

- `pdf-vendor` bundle around `1416 KB`
- `three-vendor` bundle around `1395 KB`
- route chunks for `AiView`, `SessionsView`, `TeamView`, `VideoView`, and `HomeView` are moderate, but the heavy vendor chunks dominate

### Main performance risks

1. **Large vendor chunks**
   - Three.js and PDF stacks are heavy

2. **Very large screens**
   - AI, Post-match, Team, Video, and Home are all dense enough to risk unnecessary re-renders and slower iteration

3. **Perceived speed**
   - the product already lazy-loads major surfaces in [App.tsx](/C:/Users/Facundo/Documents/football-tactics-pro/tactical-lab-3d/src/app/App.tsx), which is good
   - perceived speed now depends more on surface density and user feedback than raw route loading

4. **Viewer-related complexity**
   - the 3D viewer is a differentiator, but also a permanent weight risk

### Practical optimizations recommended

#### Must-have

- keep heavy advanced screens lazy-loaded
- reduce unnecessary rendering work in AI/Post-match/Team surfaces
- avoid loading advanced viewer-dependent assets in non-viewer workflows

#### Should-have

- isolate export code paths further
- keep pattern detection and report summarization cheap in Home-level views

#### Later

- deeper bundle splitting only if actual interaction pain remains visible

## 14. Recommended product direction

## What RomboIQ should become in the next 30 days

**A disciplined weekly tactical operating system for one coach or a very small staff.**

That means:

- stronger AI trust
- better observation capture
- clearer tactical problem continuity
- stronger session intent
- sharper evolution surface

## What it should become in the next 90 days

**The best small-staff product for turning football problems into repeatable weekly work.**

That means:

- tactical backlog
- objective tracking
- diagnosis-to-library intelligence
- review-to-evolution clarity
- stronger communication outputs for players/staff

## What it should not become

- a full club ERP
- a general coaching content platform
- a broad scouting platform
- an automatic video analysis promise machine
- a feature race against Hudl or Coachbetter across their entire surface area

## Strongest possible wedge

**Turn one tactical problem into one coherent week of coaching work, then learn from what happened.**

That wedge is sharper than "AI for coaches" and sharper than "football planning app".

## Wow moment to amplify

The real wow moment is not the 3D scene.

It is:

1. a coach states a real football problem
2. the system asks for what matters
3. the diagnosis comes back grounded and specific
4. the coach creates a training response
5. the next report shows whether the issue repeated, improved, or changed

That full chain is the real product magic.

## Main risk if feature expansion continues

The main risk is that RomboIQ becomes a product that is impressive to build and tiring to use.

That would kill the wedge.

## 15. 7-day product improvement plan

### Goal

Tighten the product around the weekly loop and remove obvious trust and complexity drag.

### Product improvements

- define and design the tactical problem backlog
- define observation capture outside the Video surface
- tighten session objective visibility

### AI improvements

- lock evidence/citation behavior rules
- expand regression cases for weak evidence and vague input

### UX/UI improvements

- simplify "observe" and post-match default paths
- clean copy and hierarchy in Home, Session, and App shell

### Technical improvements

- identify safe extraction boundaries in AI/Post-match/Session screens

### Features to add if justified

- tactical problem backlog spec
- objective tracker spec

### Features to avoid

- any new advanced scouting or simulator capability

### Validation criteria

- team can describe the loop without mentioning secondary modules
- all proposed additions reinforce the weekly loop directly

## 16. 14-day product improvement plan

### Goal

Make the strongest workflows feel more complete and less fragile.

### Product improvements

- formalize backlog -> diagnosis -> session -> review -> evolution continuity
- define planned-session vs outcome comparison

### AI improvements

- benchmark usefulness, not just schema correctness
- add anti-generic-answer regression cases

### UX/UI improvements

- improve tactical library relevance framing
- sharpen evolution as a retention surface
- clean player briefing value path

### Technical improvements

- split high-risk sections from monolithic screens
- reduce state coupling where product iteration is blocked

### Features to add if justified

- exercise recommendation MVP
- session objective tracker MVP

### Features to avoid

- anything that adds a new top-level product category

### Validation criteria

- each core workflow has a clear beginning, middle, and completion state

## 17. 30-day product roadmap

### Goal

Move from "promising pilot" to "sharp product for one weekly job".

### Product improvements

- implement tactical problem backlog
- implement simple objective tracker
- strengthen session/report continuity
- strengthen evolution summaries

### AI improvements

- enforce citation-based diagnosis gating
- add stronger usefulness benchmark suite
- reduce generic outputs

### UX/UI improvements

- unify visual hierarchy and copy
- simplify dense secondary screens
- improve report/export polish

### Technical improvements

- extract smaller modules from AI/Post-match/Team/Video surfaces
- reduce unnecessary render work
- keep lazy-loaded boundaries intact

### Features to add if justified

- diagnosis-linked exercise recommendations
- review-to-evolution comparison summary

### Features to avoid

- automatic video analysis
- deeper simulator investment
- broader scouting surface area

### Validation criteria

- a coach can complete the loop and understand what changed without explanation

## 18. 90-day product vision

RomboIQ should feel like:

- the best weekly tactical operating system for one team
- a product that helps coaches think better and remember better
- a product that turns tactical discussion into tactical operations

By 90 days, the product should have:

- trusted AI diagnosis behavior
- tactical backlog and trend continuity
- stronger field-work tracking
- better session recommendations
- cleaner staff/player communication outputs
- less architectural risk in core surfaces

It should still not have:

- multiuser collaboration
- automated video analysis as the main promise
- broad club operations

## 19. Acceptance criteria

RomboIQ is no longer just a promising pilot. It is a strong product when all of the following are true.

### Product criteria

- the loop works as one system, not five modules
- the tactical backlog exists and is useful
- the product shows what changed week to week

### AI criteria

- weak evidence never looks definitive
- citations are attached reliably to diagnosis outputs
- vague input still produces useful clarification or controlled hypotheses

### UX criteria

- a coach always knows the next action
- advanced tools no longer distract from the weekly job
- the simplest useful path is the default path

### UI criteria

- no prototype-level copy or visual roughness on core surfaces
- reports and review outputs look premium enough to trust internally

### Performance criteria

- heavy surfaces feel responsive enough on a normal laptop
- route loading is not a visible frustration
- viewer and non-viewer workflows do not step on each other

### Technical criteria

- core product changes are safe to ship without editing 1500-line files blindly
- regression coverage protects AI trust and loop continuity

### User value criteria

- a coach would miss the product after three real weeks of use because it holds tactical continuity better than their old workflow

## 20. Final recommendation

RomboIQ should not chase breadth now.

It should become narrower, sharper, and more internally coherent.

The next product phase should focus on:

1. AI trust hardening
2. tactical problem continuity
3. training objective clarity
4. evolution usefulness
5. simpler observation and review capture
6. UI/UX polish on the core path
7. architectural safety in the exact screens that still need product work

If that happens, RomboIQ stops being "an ambitious pilot with many good ideas" and starts becoming "the best small-staff weekly tactical product in its niche."
