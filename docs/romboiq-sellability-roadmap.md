# RomboIQ Sellability Roadmap

Date: 2026-06-04
Status: Planning document only. No code changes implemented in this pass.

## 1. Executive verdict

RomboIQ is not directly sellable yet.

It is now good enough to run guided pilots because the weekly tactical loop is visible in the product:

- `Sala` / command center in `src/home/HomeView.tsx`
- `Diagnostico` in `src/ai/AiView.tsx`
- `Sesion` in `src/sessions/SessionsView.tsx`
- `Post-partido` in `src/ai/post-match/PostMatchAnalysisView.tsx`
- `Equipo / evolucion` in `src/team/TeamView.tsx` and `src/home/TeamTimeline.tsx`

The product is still not safe to sell directly to cold buyers because the trust contract is incomplete:

- the Coach can still produce flows with `citationCount: 0` and `missingCitationRisk: true` in the current AI pipeline and observability artifacts (`src/ai/CoachPipeline.ts`, `src/ai/generated/coach-observability.jsonl`)
- the first-run path is better, but still not fully self-guided
- the product package, pricing, proposal, landing page, screenshots, and buyer-facing proof are not finished
- the product is local-first and honest for one coach or a small staff, but not yet packaged that way in sales language

Brutal truth:

- RomboIQ can be sold now only as a guided pilot or service-assisted software package.
- RomboIQ should not yet be sold as broad self-serve SaaS.

## 2. Direct sellability score from 1 to 10

Current direct sellability score: **4/10**

Interpretation:

- `7/10` means a stranger can see a demo, pay, onboard, and get value with limited founder intervention.
- RomboIQ is below that threshold because the product works, but buyer anxiety is still too high.

## 3. Definition of "directly sellable" for RomboIQ

For RomboIQ, "directly sellable" does **not** mean enterprise-ready, multiuser, or fully automated.

It means all of the following are true:

1. A coach or small staff can understand the promise in under 60 seconds.
2. A live demo converts into a paid offer without custom promises.
3. A new customer can start from a seeded demo, create their own team context, run the core loop, and export one useful artifact without founder handholding.
4. The Coach never presents weak evidence as a hard diagnosis.
5. The product has a clear package, price, support boundary, and onboarding method.
6. The app is stable enough that the founder is not afraid to put prospects through it.

Directly sellable for RomboIQ therefore means:

- **guided SaaS or service-assisted software for one coach or a very small staff**
- not open self-serve SaaS
- not club platform
- not full football intelligence suite

## 4. Best ICP

Best first ICP:

- Head coach or assistant coach of **one competitive amateur, semipro, or academy age-group team**
- Typical age band: U15 to U23, reserve, or adult amateur/semipro
- Staff size: 1 to 3 people
- Current workflow: WhatsApp + notes + TacticalPad/whiteboard + scattered reports
- Pain: tactical problems get discussed, but not converted into a repeatable weekly loop
- Buying behavior: fast enough to buy from trust and relevance, not from procurement

Why this is the best ICP:

- the pain is real and weekly
- the buyer can evaluate value directly
- the product matches a single-team operating model
- the buying cycle is shorter than a club-wide sale
- the current local-first architecture is acceptable for this profile

Avoid for now:

- top professional clubs with analyst departments
- multi-team academies that expect role-based collaboration
- clubs that require central admin, cloud reporting, and multiuser controls
- pure grassroots volunteer schools with low weekly discipline and very low willingness to pay
- analysts whose main job is scalable video ops, because RomboIQ is not a video automation product

## 5. Recommended first offer

Recommended first offer: **6-week guided paid pilot**

Offer name suggestion:

- `RomboIQ Pilot Sprint`

What the offer includes:

- one team configured
- one weekly workflow template
- seeded demo and setup assistance
- founder-led onboarding
- tactical diagnosis workflow
- diagnosis to session workflow
- post-match review workflow
- one branded export/report template
- weekly check-in and feedback loop
- support via WhatsApp or email with clear response window

What the offer is **not**:

- self-serve SaaS
- club-wide rollout
- automated video analysis
- multiuser analysis platform
- guaranteed performance improvement

Why this is the right first offer:

- it converts product immaturity into a packaged service advantage
- it lets the founder control onboarding quality
- it creates proof, testimonials, and objections quickly
- it avoids lying about maturity

## 6. Pricing recommendation

Pricing principle as of **June 4, 2026**:

- for Argentina, quote in ARS only as a billing reference and anchor commercial logic in USD-equivalent because local prices move too fast
- do not underprice founder time
- do not price as if this were a mature team-wide platform

### First sellable pricing

#### Argentina amateur / semipro

- Guided pilot: **USD 250 to 450 equivalent** total for 6 weeks
- Ongoing after pilot: **USD 40 to 80 equivalent per month**
- Optional setup fee if custom loading is needed: **USD 50 to 120 equivalent**

#### LATAM

- Guided pilot: **USD 350 to 700** total for 6 weeks
- Ongoing after pilot: **USD 60 to 120 per month**
- Optional setup fee: **USD 100 to 200**

#### International USD market

- Guided pilot: **USD 600 to 1,200** total for 6 weeks
- Ongoing after pilot: **USD 99 to 199 per month**
- Optional setup fee: **USD 150 to 350**

### Packaging recommendation

Do not launch three plans now.

Launch only:

1. `Pilot Sprint`
2. `Coach Continuity` monthly continuation after pilot

Add team or academy packaging later only after 3 to 5 successful pilots.

### Market reference points

Public pricing reference points used to avoid fantasy pricing:

- TacticalPad public pricing is around **US$63/year** for a full subscription: [TacticalPad pricing](https://www.tacticalpad.com/black/?lang=en-us)
- Coachbetter public pricing ranges from **US$6.99/mo** to **US$159.99/year** depending on tier: [Coachbetter pricing](https://www.coachbetter.com/solutions/for-coaches)
- Hudl Club Soccer public pricing starts around **US$400 to US$1,600 per team per year**: [Hudl Club Soccer pricing](https://www.hudl.com/pricing/club/soccer)

Implication:

- RomboIQ cannot credibly price like Hudl today.
- RomboIQ should price above a simple tactics whiteboard only when the workflow and support are packaged as the value.

## 7. Biggest sale blockers

| Blocker | Why it blocks sale | Commercial impact | Technical effort | Urgency | Risk |
|---|---|---:|---:|---:|---:|
| AI trust and source attachment | A buyer will not trust a tactical diagnosis if evidence exists but citations are missing | Very high | Medium | Immediate | Very high |
| No self-guided onboarding | A new coach still needs explanation to understand the product path | Very high | Medium | Immediate | High |
| Weak sales package | No proposal, one-pager, FAQ, demo script, or clear offer | Very high | Low | Immediate | High |
| First-run confidence gap | Demo seed exists, but buyer setup still feels fragile | High | Medium | Immediate | High |
| Export/report depth | One branded artifact exists, but buyer-facing proof is still thin | High | Medium | High | Medium |
| Product positioning still too broad | The product can look like "many advanced modules" instead of one weekly OS | High | Low | Immediate | High |
| Local-first packaging ambiguity | Buyers may fear losing data or being unable to share work | High | Medium | High | Medium |
| Polish and copy rough edges | Small language/UI issues lower trust fast | Medium | Low | High | Medium |
| Bundle/performance debt | Large chunks and dense surfaces can hurt first impression | Medium | Medium | Medium | Medium |
| Advanced surfaces still visible | They distract from the sellable core | Medium | Low | High | Low |

Priority order for conversion:

1. AI trust
2. onboarding and first-run confidence
3. packaging and proposal
4. export/report proof
5. polish and surface simplification

## 8. AI trust hardening plan

Current repo evidence:

- `src/ai/CoachPipeline.ts` already computes `missingCitationRisk`
- `src/ai/coachOutputGuard.ts` already validates citation references against known evidence IDs
- `src/ai/AiView.tsx` already exposes confidence and known/unknown structure
- `tests/coachTurnFlow.test.ts` already enforces question/hypothesis/diagnosis separation
- `src/ai/generated/coach-observability.jsonl` still shows diagnosis/hypothesis events with `citationCount: 0`

### Must-have AI trust rules before direct sale

1. If `evidenceStrength !== "none"` and `citationCount === 0`, the response must **not** be presented as a final diagnosis.
2. A diagnosis with sufficient evidence must include at least one valid citation, ideally two.
3. If evidence is partial, output mode should default to `hypothesis` unless the missing evidence is non-critical.
4. Confidence must be capped by evidence class.
5. The UI must clearly separate:
   - what I know
   - what I infer
   - what I still need
6. The agent must ask follow-up questions before giving a definitive diagnosis when critical evidence targets are missing.
7. The agent must refuse definitive language when source attachment fails.

### Concrete implementation checklist

Files most likely involved:

- `src/ai/CoachPipeline.ts`
- `src/ai/CoachAgent.ts`
- `src/ai/CoachSchemas.ts`
- `src/ai/coachOutputGuard.ts`
- `src/ai/AiView.tsx`
- `tests/coachTurnFlow.test.ts`
- `tests/coachOutputGuard.test.ts`
- `tests/coachEvalScoring.test.ts`
- `tests/coachObservability.test.ts`

Checklist:

- Add hard downgrade logic from `diagnosis` to `hypothesis` when `missingCitationRisk === true`.
- Add minimum citation count rule for `diagnosis`.
- Cap confidence by evidence strength and citation quality.
- Add safe-language templates for weak evidence.
- Force explicit "what I know / what I do not know" blocks in all diagnosis outputs.
- Add UI warning if the response is evidence-light, even when structurally valid.
- Log and review every response with missing citations during pilot.

### Suggested evidence-confidence policy

| Evidence state | Allowed mode | Confidence ceiling | Required UI label |
|---|---|---:|---|
| none | question or hypothesis | 0.45 | "Necesito mas contexto" |
| partial | hypothesis | 0.55 | "Hipotesis de trabajo" |
| sufficient + 1 citation | diagnosis | 0.70 | "Diagnostico con evidencia limitada" |
| sufficient + 2+ valid citations | diagnosis | 0.85 | "Diagnostico sustentado" |

### Non-negotiable commercial rule

RomboIQ should never claim:

- "the AI knows"
- "the AI found the truth"

RomboIQ can claim:

- "the coach receives a structured tactical diagnosis grounded in the evidence loaded into the system"

## 9. Model QA plan

The current repo already contains the base of a regression harness:

- `tests/coachTurnFlow.test.ts`
- `tests/coachOutputGuard.test.ts`
- `tests/coachEvalScoring.test.ts`
- `tests/coachPipeline.test.ts`
- `tests/coachObservability.test.ts`
- `src/ai/eval/coachEvalCases.ts`
- `src/ai/eval/runCoachContinuousEval.ts`

### What must be tested before commercial sale

1. Evidence attachment
2. Weak-evidence handling
3. Hallucination resistance
4. Tactical consistency
5. Diagnosis vs hypothesis separation
6. Session-generation consistency from diagnosis
7. Post-match to next-week continuity

### Regression suite design

Minimum suite:

- 10 no-evidence cases
- 10 partial-evidence cases
- 10 sufficient-evidence cases
- 10 adversarial or misleading cases
- 10 domain cases across build-up, pressing, transition, block, attack, set pieces, duels, and system changes

### Acceptance criteria for AI output quality

Before direct sale, all of the following should be true:

1. `0` diagnosis outputs with `missingCitationRisk: true`
2. `>= 95%` of sufficient-evidence diagnosis cases include at least one valid citation
3. `>= 90%` of weak-evidence cases stay in question/hypothesis mode
4. `0` fabricated citations in the regression suite
5. `>= 85%` tactical evaluator acceptance for relevance and internal consistency on curated benchmark cases
6. `0` severe contradictions between diagnosis and explicit loaded evidence in benchmark cases

### Practical QA workflow

1. Freeze a benchmark set in `src/ai/eval/coachEvalCases.ts`
2. Add expected citation behavior to each case
3. Run continuous eval on every meaningful Coach change
4. Store before/after scores and a short failure diff
5. Review failures manually before shipping changes to pilots

## 10. Product workflow hardening plan

The sellable product is not "all modules".

It is five bulletproof workflows.

### Workflow 1: diagnose a tactical problem

Current likely weakness:

- trust depends too much on UI framing because citation attachment is still inconsistent

Required improvement:

- harden evidence rules and make the diagnosis outcome predictable

Acceptance criteria:

- coach can load a problem, answer follow-up questions, and receive either a grounded diagnosis or a clearly labeled hypothesis

### Workflow 2: turn diagnosis into a session

Current likely weakness:

- the handoff exists in `src/ai/AiView.tsx` and `src/sessions/diagnosisSession.ts`, but needs more proof that it survives real first-run use cleanly

Required improvement:

- always show the tactical problem, weekly goal, and source diagnosis in `src/sessions/SessionsView.tsx`

Acceptance criteria:

- every session created from diagnosis visibly states the problem it addresses and the intended field test

### Workflow 3: review a match

Current likely weakness:

- `src/ai/post-match/PostMatchAnalysisView.tsx` is powerful but still dense for first-time users

Required improvement:

- split simple path vs advanced path and make the simple path the default

Acceptance criteria:

- a coach can create a useful post-match report with only the minimum required inputs and one optional notes field

### Workflow 4: track evolution

Current likely weakness:

- evolution exists, but a buyer still needs a stronger "why come back next week?" reason

Required improvement:

- show recurring issues, improvements, regressions, and the recommended next tactical focus in `src/home/TeamTimeline.tsx` and `src/team/TeamView.tsx`

Acceptance criteria:

- after two or more reports, the product surfaces at least one usable trend and one weekly decision prompt

### Workflow 5: export/share a report

Current likely weakness:

- `src/export/premiumExports.ts` now has one better artifact, but the product still needs a repeatable coach-facing and staff-facing output

Required improvement:

- choose one primary artifact and make it obviously shareable

Acceptance criteria:

- after a diagnosis or post-match review, a coach can export a branded report they would actually send to staff or present internally

### Workflow 6: present to players/staff

Current likely weakness:

- player/staff presentation mode is present in the viewer flow but not packaged as a clear sales outcome

Required improvement:

- define one "player briefing" or "staff review" mode as a simple presentation workflow

Acceptance criteria:

- demo can show how one weekly insight becomes a session and then a clear visual communication artifact

## 11. Onboarding/demo readiness plan

Current base:

- seeded state in `src/demo/pilotState.ts`
- seeded reports in `src/demo/pilotReports.ts`
- Home as command center in `src/home/HomeView.tsx`

Minimum onboarding needed before direct sale:

1. first-run demo team loads automatically
2. user sees one highlighted weekly problem
3. one sample diagnosis is available
4. one sample session is available
5. one sample post-match report is available
6. evolution shows at least one recurring pattern
7. there is a visible `Reset demo` action
8. there is a visible `Create my team` flow

Minimum new-user setup flow:

1. choose team name
2. choose age group or competitive level
3. choose default playing model or basic tactical identity
4. import or create a squad
5. answer three setup questions about current problems

Minimum required inputs for value:

- team name
- base squad or at least positional structure
- one tactical problem
- one post-match note or one tagged evidence source

## 12. UX/UI polish checklist

Priority polish areas already visible in the repo:

- `src/ui/AppShell.tsx`
- `src/home/HomeView.tsx`
- `src/ai/AiView.tsx`
- `src/ai/post-match/PostMatchAnalysisView.tsx`
- `src/team/TeamView.tsx`
- `src/video/VideoView.tsx`
- `src/export/premiumExports.ts`
- `src/app/theme.css`
- `src/app/tactical-ui.css`

Checklist:

- remove remaining copy inconsistency and mojibake
- make Spanish fully consistent on all buyer-facing surfaces
- reduce density in post-match default path
- keep advanced tools behind `Avanzado`
- make empty states specific and useful
- keep Home visually dominant as the operating center
- make session origin and tactical problem obvious
- make evolution feel like a retention feature, not a side panel
- make export/report typography and layout feel premium enough to share
- verify laptop and tablet layouts; do not optimize for mobile first

## 13. Technical readiness checklist

Smallest technical base required to sell safely:

### Must-have

- one stable deployment target
- server-side API key handling for AI endpoints
- clear agent status handling via `api/agent-status.ts`
- local persistence that survives normal usage
- export/import or backup path for local-first trust
- stable build, type-check, and tests
- logging of AI failures and response quality
- error states with user-language messaging

### Should-have

- pilot analytics or event logging
- structured support diagnostics
- simple version/update notes
- feedback capture form or email path

### Later

- multiuser backend
- role permissions
- central cloud storage
- enterprise observability stack

Technical truth:

- the lack of a full backend does **not** block the first sellable version if RomboIQ is sold honestly as a local-first tactical operating system for one coach or a tiny staff
- what does block sale is weak backup/import/export confidence and weak error handling

## 14. Sales strategy

First sales motion:

- founder-led outreach
- founder-led demo
- guided paid pilot
- explicit success criteria
- explicit continuation path

Do not try to sell with a pricing page alone.

### First realistic motion

1. outreach to warm football network and referrals
2. discovery call
3. live demo using seeded weekly story
4. paid pilot proposal within 24 hours
5. onboarding kickoff if accepted

### What should be sold in the first call

- faster weekly tactical decision-making
- diagnosis to session continuity
- post-match to evolution continuity
- one report the staff can actually use

### What should not be promised

- automatic video intelligence
- objective tactical truth
- club-wide deployment
- staff collaboration platform
- scouting database replacement

### Objections to expect

| Objection | Real issue behind it | How to handle |
|---|---|---|
| "Why not just use ChatGPT?" | Buyer doubts product-specific value | Show grounded workflow, evidence, session handoff, and evolution memory |
| "We already use TacticalPad" | Buyer sees only diagramming value | Show that RomboIQ is not just drawing, it is weekly decision continuity |
| "How reliable is the AI?" | Trust and risk | Show confidence, citations, hypothesis mode, and what the product refuses to assert |
| "Can my whole club use it?" | Buyer is expanding scope too early | Say no for now; sell single-team pilot first |
| "Is my data safe if this is local?" | Persistence anxiety | Show backup/export/import and explain local-first honestly |
| "We do this in WhatsApp and notes" | Inertia, not lack of need | Show saved time and continuity across the week |

## 15. Discovery questions

Discovery should qualify pain, maturity, and budget, not just interest.

Use these questions:

1. How do you currently move from match observations to the next training session?
2. Who actually decides the weekly tactical focus?
3. Where do those decisions live today: notes, WhatsApp, TacticalPad, video, spreadsheets?
4. What gets lost between match review and training design?
5. How often do the same tactical problems repeat because the loop is not closed?
6. Do you work alone or with one to three staff members?
7. Are you looking for club-wide software, or for something that helps one team operate better each week?
8. Would a better diagnosis-to-session flow save you time every week?
9. What report or artifact do you wish you could produce faster today?
10. If this worked, what would be different by the third week?

Disqualifiers:

- needs multiuser role permissions now
- expects automatic video analysis now
- wants procurement-heavy club rollout now
- has no weekly tactical workflow at all

## 16. Demo script outline

Recommended demo narrative: **one tactical problem through one week**

1. Start in `Sala` in `src/home/HomeView.tsx`
2. Show the current weekly tactical problem
3. Open `Diagnostico` in `src/ai/AiView.tsx`
4. Show how the Coach asks for what is missing before jumping to certainty
5. Show the grounded diagnosis structure:
   - main diagnosis
   - confidence
   - evidence
   - known vs unknown
   - recommended action
6. Create a session from the diagnosis
7. Open `Sesion` and show that the session is tied to the tactical problem
8. Open `Post-partido` and show how the match review feeds back into the next week
9. Open `Equipo / evolucion` and show a recurring pattern or improvement
10. Export one report
11. End with the commercial promise:
   - one weekly tactical operating system
   - one team
   - one loop

Time target:

- 12 to 18 minutes

Demo rule:

- never lead with advanced modules
- never open by saying "let me show you all the features"

## 17. Proposal/package outline

Every proposal should include:

1. buyer context and team profile
2. current workflow pain
3. pilot scope
4. what is included
5. what is excluded
6. expected weekly cadence
7. success criteria
8. support boundaries
9. pricing and billing
10. continuation path after pilot

Suggested pilot success criteria:

- coach uses the product weekly for 4 to 6 weeks
- at least 3 diagnosis-to-session loops completed
- at least 2 post-match reviews completed
- at least 1 report shared internally
- buyer confirms that the tool saves time or improves decision clarity

## 18. Marketing direction

First acquisition channels, in order:

1. warm football network and referrals
2. direct founder outreach to coaches and assistants
3. LinkedIn founder content
4. WhatsApp intros through trusted contacts
5. focused landing page with demo CTA
6. SEO as a support channel, not the first growth engine

Do not start with paid ads.

Do not start with broad Instagram growth as the main engine.

Reason:

- this product still needs trust-heavy selling
- high-context products close faster through network and founder credibility

## 19. Landing page outline

### Headline

`El sistema operativo tactico semanal para entrenadores y staffs chicos`

### Subheadline

`Observa, diagnostica, planifica la sesion, revisa el partido y sigue la evolucion del equipo en un solo flujo de trabajo.`

### Hero CTA

- `Pedir demo`
- `Ver caso semanal`

### Sections

1. The problem
   - "Hoy el problema no es ver futbol. Es cerrar el loop semanal."
2. The loop
   - observe -> diagnose -> train -> review -> evolve
3. Product proof
   - screenshots from `Sala`, `Diagnostico`, `Sesion`, `Post-partido`, `Evolucion`
4. Why it is different
   - not whiteboard only
   - not generic ChatGPT
   - not club ERP
5. Example artifact
   - diagnosis export or post-match export
6. Who it is for
   - one coach or a very small staff
7. Pilot offer
   - guided 6-week pilot
8. FAQ
9. Final CTA

### Claims to avoid on the landing page

- "AI that analyzes your matches automatically"
- "objective tactical intelligence"
- "works for every club"
- "replace your analyst"

## 20. LinkedIn/content plan

Best content angle:

- weekly tactical operating system, not flashy AI

Content should show:

- real tactical reasoning
- weekly workflow continuity
- decision clarity
- one useful export/report

### First 10 content ideas

1. Why most coaches lose the week between match review and training
2. The difference between a tactical note and a tactical operating system
3. One weekly case: from problem to session in 10 minutes
4. What RomboIQ refuses to diagnose without enough evidence
5. Why generic AI is not enough for weekly football work
6. The hidden cost of running the week through WhatsApp and notes
7. How to turn repeated match problems into training themes
8. What a good post-match review should feed into next week
9. One export that a staff would actually share
10. Why small staffs need better workflow, not more features

### Short case-study format

1. Context
2. Weekly problem
3. What evidence was loaded
4. Diagnosis
5. Session decision
6. Match review
7. What changed the next week

## 21. Features to hide/postpone

These should not be part of the first sellable promise:

- automatic video analysis
- multiuser collaboration
- full club intelligence platform
- advanced scenario simulator
- full opponent scout as a headline feature
- full game model editor as a headline feature
- anything that turns the sale into "buy a platform"

Keep in product, but hide or de-emphasize:

- `Scenario Simulator`
- deep `Opponent Scout`
- full `Game Model Builder`
- `Video Pattern Scan`
- advanced team tools that distract from the weekly loop

## 22. 14-day sellability sprint

| Day | Objective | Tasks | Files/areas likely involved | Validation criteria | Expected output |
|---|---|---|---|---|---|
| 1 | Lock sellable scope | Freeze first sellable promise, ICP, offer, and demo path | `docs/`, `src/ui/AppShell.tsx`, `src/home/HomeView.tsx` | Scope document approved | One narrow commercial scope |
| 2 | AI trust rules | Define downgrade and citation rules | `src/ai/CoachPipeline.ts`, `src/ai/coachOutputGuard.ts`, `src/ai/CoachSchemas.ts` | Written rule set reviewed | Clear AI trust spec |
| 3 | AI regression design | Expand eval cases for citation behavior and weak evidence | `src/ai/eval/coachEvalCases.ts`, `tests/coachTurnFlow.test.ts` | Cases cover no/partial/sufficient evidence | QA matrix ready |
| 4 | Onboarding map | Define first-run demo, reset, create-my-team path | `src/demo/`, `src/home/`, `src/state/useAppStore.ts` | Flow documented end to end | Onboarding spec |
| 5 | Sellable workflow review | Walk diagnose -> session -> post-match -> evolution as one script | `src/ai/AiView.tsx`, `src/sessions/SessionsView.tsx`, `src/ai/post-match/PostMatchAnalysisView.tsx`, `src/team/TeamView.tsx` | One clean script exists | Demo path locked |
| 6 | Export proof selection | Choose the single artifact that will carry sales proof | `src/export/premiumExports.ts` | One artifact chosen and judged strong enough | Export target frozen |
| 7 | UX friction audit | List every confusing empty state and advanced distraction in the core path | `src/home/`, `src/ai/`, `src/sessions/`, `src/team/` | Friction list prioritized | Fix order defined |
| 8 | Sales asset drafting | Write one-pager, proposal template, FAQ | `docs/` | Draft assets complete | Commercial pack v1 |
| 9 | Landing page message | Freeze headline, subheadline, CTA, proof sections | `docs/` and future landing page area | Message is consistent with product reality | Messaging pack v1 |
| 10 | Discovery script | Prepare discovery questions and objection handling | `docs/` | Script reviewed against ICP | Sales call script |
| 11 | Demo proof collection | Decide the exact screenshots and report outputs needed | `src/home/`, `src/ai/`, `src/sessions/`, `src/ai/post-match/`, `src/team/` | Screenshot shot list complete | Demo asset checklist |
| 12 | Pricing and packaging | Finalize pilot price ranges and continuation offer | `docs/` | Pricing aligns with market reality and founder capacity | Pricing sheet |
| 13 | Commercial readiness gate | Score product against acceptance criteria | `docs/`, tests, AI eval outputs | Honest pass/fail decision | Go/no-go report |
| 14 | Prospect-ready package | Assemble roadmap, demo script, proposal, FAQ, asset list | `docs/` | Founder can book outreach with one package | Sellability pack v1 |

## 23. 30-day commercial readiness plan

### Days 1-7

- harden AI trust rules
- define QA benchmarks
- finalize pilot package
- lock the demo narrative

### Days 8-14

- implement highest-impact trust and onboarding fixes
- reduce advanced-surface noise
- strengthen one export/report artifact

### Days 15-21

- collect screenshots, case story, and demo assets
- prepare landing page copy and one-page PDF
- prepare pilot proposal and FAQ

### Days 22-30

- run first 5 to 10 discovery conversations
- run 3 to 5 live demos
- close 1 to 3 paid pilots
- capture objections and usage friction
- decide whether the product has crossed from pilot-only to directly sellable

## 24. Sales/demo assets needed

Must exist before active selling:

1. demo script
2. one-page PDF
3. pilot proposal template
4. scope and success criteria document
5. FAQ
6. screenshot pack
7. one branded diagnosis or post-match report
8. one weekly case story
9. objection handling sheet
10. follow-up email template

Nice to have:

- short 60 to 90 second product clip
- founder LinkedIn carousel
- mini landing page with demo CTA

## 25. Acceptance criteria

### Product criteria

- the five core workflows can be demoed without confusion
- the product clearly feels like one weekly system, not many unrelated modules

### AI trust criteria

- no direct-sale demo shows diagnosis with missing citation risk
- weak evidence never looks definitive

### Model QA criteria

- regression suite covers all evidence states
- benchmark pass thresholds are met

### Demo criteria

- one 12 to 18 minute script reliably tells the story
- one weekly case shows the full loop

### Technical criteria

- deploy is stable
- type-check/build/tests are green
- backup/export/import path is clear enough for local-first trust

### Sales criteria

- one ICP is targeted
- one offer is packaged
- one proposal template exists
- one objection handling sheet exists

### Marketing criteria

- landing page messaging is frozen
- screenshot pack exists
- first 10 content angles are ready

### Support criteria

- support boundary is explicit
- pilot communication rhythm is defined

Commercial gate to say "RomboIQ is directly sellable":

1. the founder can run 5 cold demos without changing the core promise each time
2. the product can onboard a new coach without custom rescue steps
3. the Coach trust problem is under control
4. the buyer-facing assets look finished enough to support payment

## 26. Final recommendation: sell now, guided pilot only, or wait

Recommendation today: **guided pilot only**

Do not wait passively.

Do not launch broad self-serve sales.

The practical path is:

1. package the current product into a 6-week guided pilot
2. harden AI trust and onboarding aggressively
3. create the minimum sales and marketing assets
4. close 1 to 3 paying pilots
5. use those pilots to decide whether RomboIQ is ready to become directly sellable

If the AI trust checklist and onboarding/demo checklist are completed, RomboIQ can plausibly move from `4/10` to `7/10` sellability within one focused commercial hardening cycle.

