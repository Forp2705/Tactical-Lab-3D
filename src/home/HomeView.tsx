import { usePostMatchReports } from "@/ai/post-match/usePostMatchReports";
import type { SavedPostMatchReport } from "@/ai/post-match/schemas";
import {
  buildWeeklyDecisionSummary,
  detectTeamPatterns,
  type TeamPattern,
} from "@/ai/patternDetection";
import { catalog } from "@/data";
import { buildOpponentGamePlan, hasOpponentScoutData } from "@/scout/opponentScout";
import {
  exportEvolutionHtml,
  exportMatchPlanHtml,
  exportTrainingWeekHtml,
} from "@/export/premiumExports";
import {
  QuickSketchLauncher,
  buildContextualSketchDraft,
  buildQuickSketchTitle,
} from "@/sketch";
import { LoopProgress, PatternCard, PitchViz } from "@/ui/tacticalPrimitives";
import { WeeklyDecisionCard, buildWeeklyDecisionCardModel } from "@/ui/WeeklyDecisionCard";
import { PROBLEM_TEMPLATES } from "@/sessions/problemTemplates";
import {
  isTeamIdentityBootstrapped,
  isTeamIdentityConfigured,
} from "@/data/teamIdentitySetup";
import { resolveExerciseSelection } from "@/app/viewerSelection";
import { useAppStore } from "@/state/useAppStore";
import { summarizeVideoEvidence } from "@/video/videoEvidence";
import { memo, useMemo, useState } from "react";
import { FirstRunChooser } from "./FirstRunChooser";
import { HomeMasthead, hasRivalGuard } from "./HomeMasthead";
import { HomeMetrics } from "./HomeMetrics";
import { HomeProblemPaper } from "./HomeProblemPaper";
import { type HomeSessionBlockRow, HomeSessionPaper } from "./HomeSessionPaper";
import { HomeTacticalBoardPanel } from "./HomeTacticalBoardPanel";
import { derivePatternPitchOverlays } from "./patternPitchOverlays";
import { RealCoachOnboarding } from "./RealCoachOnboarding";
import { TeamTimeline } from "./TeamTimeline";

export function HomeView() {
  const workspaceMode = useAppStore((state) => state.workspaceMode);
  const teamIdentity = useAppStore((state) => state.teamIdentity);
  const activeTeamId = useAppStore((state) => state.team.id);
  const teamPlayers = useAppStore((state) => state.team.players);
  const gameModel = useAppStore((state) => state.gameModel);
  const opponentScout = useAppStore((state) => state.opponentScout);
  const session = useAppStore((state) => state.session);
  const microcycle = useAppStore((state) => state.microcycle);
  const aiPrompt = useAppStore((state) => state.aiPrompt);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const tags = useAppStore((state) => state.tags);
  const tracks = useAppStore((state) => state.tracks);
  const allManualObservations = useAppStore((state) => state.manualObservations);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const lineupLabShapeCount = useAppStore((state) => state.lineupLab.shapes.length);
  const lineupLabTransitionCount = useAppStore(
    (state) => state.lineupLab.savedTransitions.length,
  );
  const { reports, reportsError } = usePostMatchReports();
  const { exercise: selectedExercise, missing: selectedExerciseMissing } =
    resolveExerciseSelection(selectedExerciseId, [
      ...catalog,
      ...exerciseVariants,
    ]);
  const [quickObservation, setQuickObservation] = useState("");
  const availablePlayers = useMemo(
    () =>
      teamPlayers.filter((player) => player.status === "available").length,
    [teamPlayers],
  );
  const evidence = useMemo(
    () => summarizeVideoEvidence(tags, tracks),
    [tags, tracks],
  );
  const manualObservations = useMemo(
    () =>
      allManualObservations.filter(
        (observation) => observation.teamId === activeTeamId,
      ),
    [activeTeamId, allManualObservations],
  );
  const patterns = useMemo(
    () =>
      detectTeamPatterns(reports, {
        limit: 3,
        gameModel,
        sessionObjectives: session.computed?.primaryObjectives ?? [],
      }),
    [gameModel, reports, session.computed?.primaryObjectives],
  );
  const weeklyDecision = useMemo(
    () => buildWeeklyDecisionSummary(patterns),
    [patterns],
  );
  const primaryPattern = patterns[0];
  const isVirginWorkspace =
    workspaceMode === "real" &&
    teamPlayers.length === 0 &&
    session.blocks.length === 0 &&
    reports.length === 0;
  const patternOverlays = useMemo(
    () => derivePatternPitchOverlays(primaryPattern),
    [primaryPattern],
  );
  const opponentPlan = useMemo(
    () => buildOpponentGamePlan(opponentScout, gameModel),
    [gameModel, opponentScout],
  );
  const activeDay = currentMicrocycleDay(microcycle.days);
  const activeDayConfig = Object.entries(microcycle.days).find(
    ([day]) => day === activeDay.label,
  )?.[1];
  const loadPercentValue = loadPercent(activeDayConfig?.targetLoad ?? "med");
  const peakDay = useMemo(
    () =>
      Object.entries(microcycle.days).find(
        ([, config]) => config.targetLoad === "high",
      )?.[0],
    [microcycle.days],
  );
  const loadPeakLabel = peakDay ? `PICO ${peakDay}` : "SIN PICO PLANIFICADO";
  const rivalChipLabel = hasRivalGuard(opponentScout)
    ? `VS ${opponentScout.rival.toUpperCase()}`
    : undefined;
  const baseFormationChip = teamIdentity.baseFormation.trim() || undefined;
  const latestManualObservation = manualObservations[0]?.text;
  const sessionBlockRows: HomeSessionBlockRow[] = useMemo(
    () =>
      session.blocks.map((block) => {
        const { exercise, missing } = resolveExerciseSelection(
          block.exerciseId,
          [...catalog, ...exerciseVariants],
        );
        return {
          id: block.id,
          title: missing ? "" : exercise.title,
          missing,
          durationMin: block.durationMin,
        };
      }),
    [exerciseVariants, session.blocks],
  );

  const recentReports = useMemo(
    () =>
      [...reports]
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .slice(0, 3),
    [reports],
  );
  const latestReport = recentReports[0];
  const nextAction = buildNextAction({
    aiPrompt,
    evidenceTotal: evidence.total,
    latestReport,
    manualObservationCount: manualObservations.length,
    recommendedWeeklyFocus: weeklyDecision.recommendedFocus?.title,
    sessionBlocks: session.blocks.length,
  });
  const activeDiagnosis =
    weeklyDecisionThread?.problem || aiPrompt.trim() || primaryPattern?.statement || "";
  const weeklyDecisionCard = useMemo(
    () => buildWeeklyDecisionCardModel({ thread: weeklyDecisionThread }),
    [weeklyDecisionThread],
  );

  function openDiagnostico() {
    useAppStore.getState().setAiMode("coach");
    useAppStore.getState().setView("ai");
  }

  function openSession() {
    if (!useAppStore.getState().createSessionFromWeeklyThread()) {
      useAppStore.getState().setView("sessions");
    }
  }

  return (
    <div className="view-enter grid home-command-view" style={{ gap: 16 }}>
      <FirstRunChooser isVirgin={isVirginWorkspace} />

      <HomeMasthead
        opponentScout={opponentScout}
        diaFoco={activeDay.label}
        objective={activeDayConfig?.objective ?? ""}
        onOpenScout={() => useAppStore.getState().setView("team")}
      />

      <div className="home-main-grid">
        <div className="home-papers-col">
          <HomeProblemPaper
            activeDiagnosis={activeDiagnosis}
            objective={weeklyDecisionThread?.sessionIntent?.objective}
            annotation={latestManualObservation}
            diaFoco={activeDay.label}
            rivalChipLabel={rivalChipLabel}
            baseFormation={baseFormationChip}
            onOpenDiagnostico={openDiagnostico}
          />
          <HomeSessionPaper
            sessionName={session.name}
            blocks={sessionBlockRows}
            totalDuration={session.computed?.totalDuration ?? 0}
            onOpen={openSession}
          />
        </div>
        <HomeTacticalBoardPanel />
      </div>

      <section className="home-next-step">
        <span className="panel-eyebrow">SIGUIENTE PASO</span>
        <h3>{nextAction.title}</h3>
        <button
          type="button"
          className="home-cta-gold home-next-step-cta"
          onClick={nextAction.onClick}
        >
          {nextAction.cta}
        </button>
      </section>

      <HomeMetrics
        loadPercentValue={loadPercentValue}
        loadPeakLabel={loadPeakLabel}
        availablePlayers={availablePlayers}
        totalPlayers={teamPlayers.length}
        reportsCount={reports.length}
        onOpenEvolucion={() => useAppStore.getState().setView("team")}
        onOpenPostPartido={() => {
          useAppStore.getState().setAiMode("postMatch");
          useAppStore.getState().setView("ai");
        }}
      />

      <div className="home-lower-zone">
        {workspaceMode === "real" && !isTeamIdentityBootstrapped(teamIdentity) ? (
          <section className="home-onboarding-strip">
            <RealCoachOnboarding identity={teamIdentity} />
          </section>
        ) : null}
        <section className="home-mode-strip">
          <WorkspaceModeCard workspaceMode={workspaceMode} />
          {workspaceMode === "real" && !isTeamIdentityConfigured(teamIdentity) ? (
            <TeamSetupPrompt identity={teamIdentity} />
          ) : null}
        </section>

        <WeeklyDecisionCard
          model={weeklyDecisionCard}
          title="Lectura coach de la semana"
          detailsLabel="La evidencia completa y la trazabilidad quedan como detalle secundario."
        />

        <QuickStartPanel
          sessionHasBlocks={session.blocks.length > 0}
          weeklyDecisionThread={weeklyDecisionThread}
          activeDayLabel={activeDay.label}
        />

        <QuickObservationPanel
          draft={quickObservation}
          observations={manualObservations}
          weeklyDecisionThread={weeklyDecisionThread}
          setDraft={setQuickObservation}
        />
      </div>

      <details className="home-deep-dive">
        <summary>Ver detalle operativo</summary>
        <div className="home-deep-dive-body">
      <div className="home-deep-dive-intro">
        <div className="command-loop-row">
          <LoopProgress active={loopStage(session.blocks.length, reports.length, patterns.length)} />
        </div>
        <div className="command-hero-pitch">
          <PitchViz
            title="Cancha de estado"
            subtitle={
              patternOverlays.confirmed
                ? "patron activo"
                : primaryPattern
                  ? "sin ubicacion espacial confirmada"
                  : "sin evidencia espacial"
            }
            compact
            state={patternOverlays.confirmed ? "analysis" : "empty"}
            emptyMessage={
              primaryPattern
                ? "Patron sin ubicacion espacial confirmada"
                : "Sin patron confirmado"
            }
            overlays={patternOverlays.overlays}
          />
          <div className="command-pitch-summary">
            <div>
              <span>Lectura</span>
              <b>
                {primaryPattern
                  ? shorten(primaryPattern.statement, 76)
                  : "Todavia no hay un patron validado para ubicar en cancha."}
              </b>
            </div>
            <div>
              <span>Evidencia</span>
              <b>
                {recentReports.length} reportes / {evidence.total} video /{" "}
                {manualObservations.length} manuales
              </b>
            </div>
            <div>
              <span>Siguiente paso</span>
              <b>{nextAction.shortLabel}</b>
            </div>
          </div>
        </div>
      </div>
      <CommandSummaryPanel
        activeDay={activeDay.label}
        availablePlayers={availablePlayers}
        totalPlayers={teamPlayers.length}
        sessionBlocks={session.blocks.length}
        sessionMinutes={session.computed?.totalDuration ?? 0}
        evidenceTotal={evidence.total}
        manualObservationCount={manualObservations.length}
        reportsCount={reports.length}
        primaryPattern={primaryPattern}
      />
      <section className="home-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Modelo de juego</span>
              <h3>Vara tactica activa</h3>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => useAppStore.getState().setView("team")}
            >
              Editar
            </button>
          </div>
          <p style={{ color: "var(--muted)", lineHeight: 1.45, marginTop: 0 }}>
            Modelo activo configurado.
          </p>
          <div className="list">
            {gameModel.nonNegotiables.slice(0, 3).map((item) => (
              <div className="list-row" key={item}>
                <div className="lr-icon">ID</div>
                <div>
                  <b>No negociable</b>
                  <small>{item}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">Proximo rival</span>
              <h3>{opponentScout.rival}</h3>
            </div>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() => useAppStore.getState().setView("team")}
            >
              Scout
            </button>
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                exportMatchPlanHtml({
                  scout: opponentScout,
                  plan: opponentPlan,
                  gameModel,
                })
              }
            >
              Exportar
            </button>
          </div>
          {hasOpponentScoutData(opponentScout) ? (
            <div className="list">
              {opponentPlan.weeklyTrainingFocus.slice(0, 3).map((item) => (
                <div className="list-row" key={item}>
                  <div className="lr-icon">WK</div>
                  <div>
                    <b>Foco semanal</b>
                    <small>{item}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
              Carga presion, salida y vulnerabilidades del rival para convertirlo
              en plan de partido.
            </p>
          )}
        </div>
      </section>

      <section className="stat-row">
        <Stat eyebrow="Plantel" big={`${availablePlayers}/${teamPlayers.length}`} sub="jugadores disponibles" />
        <Stat eyebrow="Sesion" big={session.blocks.length} sub={`${session.computed?.totalDuration ?? 0} min planificados`} />
        <Stat eyebrow="Evidencia video" big={evidence.total} sub={`${evidence.assistedTracks} asistidos / ${evidence.confirmedTracks} validados`} accent />
        <Stat eyebrow="Shapes" big={lineupLabShapeCount} sub={`${lineupLabTransitionCount} transiciones guardadas`} />
      </section>

      <section className="home-grid">
        <div className="grid" style={{ gap: 16 }}>
          <MicrocycleCard />
          <SessionCard />
          <TeamTimeline reports={reports} />
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <ReportsCard reports={reports} error={reportsError} />
          <PatternCommandCard patterns={patterns} />
          <div className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Exportables premium</span>
                <h3>Salidas para staff</h3>
              </div>
            </div>
            <div className="toolbar compact">
              <button
                type="button"
                className="secondary"
                onClick={() => exportTrainingWeekHtml(session)}
              >
                Semana
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => exportEvolutionHtml(reports)}
              >
                Evolucion
              </button>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <div>
                <span className="eyebrow">Biblioteca</span>
                <h3>Ejercicio actual</h3>
              </div>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => useAppStore.getState().setView("library")}
              >
                Abrir
              </button>
            </div>
            <div className="list">
              <div className="list-row">
                <div className="lr-icon">3D</div>
                {selectedExerciseMissing ? (
                  <>
                    <div>
                      <b style={{ color: "var(--warn)" }}>
                        Ejercicio retirado del catalogo
                      </b>
                      <small>Abri Biblioteca para elegir uno vigente.</small>
                    </div>
                    <span className="tag-pill" style={{ color: "var(--warn)" }}>
                      !
                    </span>
                  </>
                ) : (
                  <>
                    <div>
                      <b>{selectedExercise.title}</b>
                      <small>
                        {selectedExercise.phase} / {selectedExercise.principle}
                      </small>
                    </div>
                    <span className="tag-pill">
                      {selectedExercise.players.min}-{selectedExercise.players.max}
                    </span>
                  </>
                )}
              </div>
              <div className="list-row">
                <div className="lr-icon">CAT</div>
                <div>
                  <b>{catalog.length} ejercicios base</b>
                  <small>Catalogo disponible para visor y sesiones.</small>
                </div>
                <span className="tag-pill">curado</span>
              </div>
            </div>
          </div>
        </div>
      </section>
        </div>
      </details>
    </div>
  );
}

type NextAction = {
  title: string;
  body: string;
  shortLabel: string;
  cta: string;
  onClick: () => void;
};

const QuickStartPanel = memo(function QuickStartPanel({
  sessionHasBlocks,
  weeklyDecisionThread,
  activeDayLabel,
}: {
  sessionHasBlocks: boolean;
  weeklyDecisionThread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"];
  activeDayLabel: string;
}) {
  function start(templateId: string) {
    if (
      sessionHasBlocks &&
      !window.confirm(
        "Ya tenes una sesion armada. Quick Start la va a reemplazar por una nueva. Continuar?",
      )
    ) {
      return;
    }
    useAppStore.getState().startFromProblemTemplate(templateId);
  }

  return (
    <section className="home-action-block quick-start-block">
      <div className="section-title home-action-head">
        <div>
          <span className="panel-eyebrow">Quick Start</span>
          <h3>Que te esta costando esta semana?</h3>
        </div>
        <QuickSketchLauncher
          buttonClassName="secondary sm"
          buttonLabel="Boceto rapido"
          buttonTitle="Abrir un boceto rapido desde Sala"
          panelTitle="Boceto rapido para esta semana"
          buildDraft={() =>
            buildContextualSketchDraft({
              title: buildQuickSketchTitle([
                "Boceto",
                weeklyDecisionThread?.problem,
                activeDayLabel,
              ]),
              tacticalFocus:
                weeklyDecisionThread?.sessionIntent?.objective ??
                weeklyDecisionThread?.problem,
              sourceLabel: "Sala semanal",
            })
          }
        />
      </div>
      <p className="muted-panel">
        Elegi un problema y RomboIQ arma una sesion entrenable al instante, con
        ejercicios reales del catalogo. Sin configurar plantel ni esperar al
        coach.
      </p>
      <div className="home-action-strip quick-start-strip">
        {PROBLEM_TEMPLATES.map((template) => (
          <button
            type="button"
            className="home-action quick-start-chip"
            key={template.id}
            onClick={() => start(template.id)}
            title={template.objective}
          >
            <div className="lr-icon">QS</div>
            <div>
              <b>{template.chipLabel}</b>
              <small>{template.description}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
});

const QuickObservationPanel = memo(function QuickObservationPanel({
  draft,
  observations,
  weeklyDecisionThread,
  setDraft,
}: {
  draft: string;
  observations: ReturnType<typeof useAppStore.getState>["manualObservations"];
  weeklyDecisionThread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"];
  setDraft: (value: string) => void;
}) {
  const trimmedDraft = draft.trim();

  function storeObservation(source: "home" | "postMatch") {
    if (!trimmedDraft) return null;
    return useAppStore.getState().addManualObservation({
      text: trimmedDraft,
      source,
    });
  }

  function openCoachFromObservation() {
    const nextId = storeObservation("home");
    if (!nextId) return;
    useAppStore.getState().activateWeeklyThreadFromObservation(nextId);
    useAppStore.getState().setAiPrompt(trimmedDraft);
    useAppStore.getState().setAiMode("coach");
    useAppStore.getState().setView("ai");
    setDraft("");
  }

  function sendObservationToPostMatch() {
    const nextId = storeObservation("home");
    if (!nextId) return;
    useAppStore.getState().activateWeeklyThreadFromObservation(nextId);
    useAppStore.getState().queuePostMatchManualObservations([nextId]);
    useAppStore.getState().setAiMode("postMatch");
    useAppStore.getState().setView("ai");
    setDraft("");
  }

  return (
    <section className="quick-observation-card card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Observacion manual</span>
          <h3>Captura del staff</h3>
        </div>
        <span className="ai-context-chip">{observations.length} guardadas</span>
      </div>
      <p className="muted-panel">
        Guarda una lectura corta. Cuenta como evidencia actual, con menor peso
        que video o post-partido estructurado.
      </p>
      <textarea
        className="quick-observation-input"
        placeholder='Ej: "El 5 queda tapado en salida" o "Perdemos y saltan descoordinados".'
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="toolbar compact">
        <button
          type="button"
          className="secondary"
          disabled={!trimmedDraft}
          onClick={() => {
            if (!storeObservation("home")) return;
            setDraft("");
          }}
        >
          Guardar observacion
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!trimmedDraft}
          onClick={openCoachFromObservation}
        >
          Diagnosticar desde esta observacion
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={!trimmedDraft}
          onClick={sendObservationToPostMatch}
        >
          Mandar a post-partido
        </button>
      </div>
      {observations.length ? (
        <div className="quick-observation-list">
          {observations.slice(0, 4).map((observation) => (
            <article className="quick-observation-item" key={observation.id}>
              <div>
                <b>{observation.text}</b>
                <small>
                  Manual {observation.source === "postMatch" ? "post-partido" : "staff"} -{" "}
                  {formatObservationDate(observation.createdAt)}
                </small>
              </div>
              <div className="toolbar compact">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    useAppStore.getState().activateWeeklyThreadFromObservation(
                      observation.id,
                    );
                    useAppStore.getState().setAiPrompt(observation.text);
                    useAppStore.getState().setAiMode("coach");
                    useAppStore.getState().setView("ai");
                  }}
                >
                  Diagnosticar
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    useAppStore.getState().activateWeeklyThreadFromObservation(
                      observation.id,
                    );
                    useAppStore.getState().queuePostMatchManualObservations([
                      observation.id,
                    ]);
                    useAppStore.getState().setAiMode("postMatch");
                    useAppStore.getState().setView("ai");
                  }}
                >
                  Post-partido
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    useAppStore.getState().removeManualObservation(observation.id)
                  }
                >
                  Quitar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-panel">
          Sin observaciones manuales todavia. Usa esta captura cuando no haga
          falta entrar a Video.
        </p>
      )}
    </section>
  );
});

const WorkspaceModeCard = memo(function WorkspaceModeCard({
  workspaceMode,
}: {
  workspaceMode: "demo" | "real";
}) {
  return (
    <article className="command-summary-card">
      <span className="eyebrow">Contexto activo</span>
      <h3>{workspaceMode === "demo" ? "Modo demo" : "Equipo real"}</h3>
      <p>
        {workspaceMode === "demo"
          ? "Usas la semana piloto con identidad y relato preconfigurados."
          : "El equipo real arranca limpio. El Coach no debe asumir identidad si no la defines."}
      </p>
      <div className="home-action-strip">
        <button
          type="button"
          className="home-action"
          onClick={() => useAppStore.getState().loadDemoWorkspace()}
        >
          <div className="lr-icon">DM</div>
          <div>
            <b>Cargar demo</b>
            <small>Usar caso piloto</small>
          </div>
        </button>
        <button
          type="button"
          className="home-action"
          onClick={() => useAppStore.getState().loadRealWorkspace()}
        >
          <div className="lr-icon">RT</div>
          <div>
            <b>Equipo real</b>
            <small>Trabajar sin narrativa sembrada</small>
          </div>
        </button>
      </div>
    </article>
  );
});

const TeamSetupPrompt = memo(function TeamSetupPrompt({
  identity,
}: {
  identity: ReturnType<typeof useAppStore.getState>["teamIdentity"];
}) {
  return (
    <article className="command-summary-card primary">
      <span className="eyebrow">Setup minimo</span>
      <h3>Define la identidad antes de pedir lecturas de modelo</h3>
      <p>
        Si no completas estos campos, el Coach debe trabajar como hipotesis y
        pedir contexto en vez de inventar como juega el equipo.
      </p>
      <div className="home-team-setup-grid">
        <label>
          <span>Equipo</span>
          <input
            value={identity.teamName}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({ teamName: event.target.value })
            }
            placeholder="Nombre del equipo"
          />
        </label>
        <label>
          <span>Formacion base</span>
          <input
            value={identity.baseFormation}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({ baseFormation: event.target.value })
            }
            placeholder="4-3-3 / 4-4-2 / 3-4-2-1"
          />
        </label>
        <label>
          <span>Altura defensiva</span>
          <select
            value={identity.preferredDefensiveHeight}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({
                preferredDefensiveHeight: event.target.value as
                  | ""
                  | "low"
                  | "mid"
                  | "high",
              })
            }
          >
            <option value="">Seleccionar</option>
            <option value="low">Baja</option>
            <option value="mid">Media</option>
            <option value="high">Alta</option>
          </select>
        </label>
        <label>
          <span>Dias de entrenamiento</span>
          <input
            type="number"
            min={0}
            max={7}
            value={identity.trainingDays || ""}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({
                trainingDays: Number(event.target.value || 0),
              })
            }
            placeholder="0-7"
          />
        </label>
        <label>
          <span>Presion</span>
          <input
            value={identity.pressingPreference}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({
                pressingPreference: event.target.value,
              })
            }
            placeholder="Como y cuando quiere presionar"
          />
        </label>
        <label>
          <span>Salida</span>
          <input
            value={identity.buildUpPreference}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({
                buildUpPreference: event.target.value,
              })
            }
            placeholder="Como quiere iniciar la construccion"
          />
        </label>
        <label>
          <span>Nivel del plantel</span>
          <input
            value={identity.squadLevel}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({ squadLevel: event.target.value })
            }
            placeholder="amateur / semiprofesional / juvenil"
          />
        </label>
        <label className="team-setup-notes">
          <span>Notas</span>
          <textarea
            value={identity.notes}
            onChange={(event) =>
              useAppStore.getState().updateTeamIdentity({ notes: event.target.value })
            }
            placeholder="Rasgos clave que el staff si quiere declarar"
          />
        </label>
      </div>
    </article>
  );
});

const CommandSummaryPanel = memo(function CommandSummaryPanel({
  activeDay,
  availablePlayers,
  totalPlayers,
  sessionBlocks,
  sessionMinutes,
  evidenceTotal,
  manualObservationCount,
  reportsCount,
  primaryPattern,
}: {
  activeDay: string;
  availablePlayers: number;
  totalPlayers: number;
  sessionBlocks: number;
  sessionMinutes: number;
  evidenceTotal: number;
  manualObservationCount: number;
  reportsCount: number;
  primaryPattern?: TeamPattern;
}) {
  return (
    <section className="command-summary-grid">
      <article className="command-summary-card primary">
        <span className="eyebrow">Ahora / {activeDay}</span>
        <h3>{primaryPattern ? "Resolver patron activo" : "Construir evidencia"}</h3>
        <p>
          {primaryPattern
            ? shorten(primaryPattern.statement, 112)
            : "La sala todavia no tiene un patron validado. El proximo paso es cargar un post-match o consultar al Coach con una observacion concreta."}
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            useAppStore.getState().setAiMode("coach");
            useAppStore.getState().setView("ai");
          }}
        >
          Diagnosticar
        </button>
      </article>

      <article className="command-summary-card">
        <span className="eyebrow">Entrenamiento</span>
        <h3>{sessionBlocks ? `${sessionBlocks} bloques listos` : "Sin sesion armada"}</h3>
        <p>{sessionBlocks ? `${sessionMinutes} minutos planificados.` : "Converti el diagnostico en una sesion antes de sumar detalle."}</p>
      </article>

      <article className="command-summary-card">
        <span className="eyebrow">Evidencia</span>
        <h3>{evidenceTotal + reportsCount + manualObservationCount}</h3>
        <p>
          {reportsCount} reportes, {evidenceTotal} marcas de video y{" "}
          {manualObservationCount} observaciones manuales.
        </p>
      </article>

      <article className="command-summary-card">
        <span className="eyebrow">Plantel</span>
        <h3>{availablePlayers}/{totalPlayers}</h3>
        <p>Jugadores disponibles para sostener el plan de partido.</p>
      </article>
    </section>
  );
});

const Stat = memo(function Stat({
  eyebrow,
  big,
  sub,
  accent,
}: {
  eyebrow: string;
  big: string | number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="stat-tile">
      <span className="eyebrow">{eyebrow}</span>
      <b style={accent ? { color: "var(--accent)" } : undefined}>{big}</b>
      <small>{sub}</small>
    </div>
  );
});

const MicrocycleCard = memo(function MicrocycleCard() {
  const microcycle = useAppStore((state) => state.microcycle);
  const entries = Object.entries(microcycle.days);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Microciclo semanal</span>
          <h3>Distribucion de carga</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => useAppStore.getState().setView("sessions")}
        >
          Planificar
        </button>
      </div>
      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: 8,
          gridTemplateColumns: `repeat(${entries.length}, 1fr)`,
          height: 150,
        }}
      >
        {entries.map(([day, config]) => {
          const load = loadPercent(config.targetLoad);
          const active = day === currentMicrocycleDay(microcycle.days).label;
          return (
            <div
              key={day}
              style={{
                display: "grid",
                gap: 6,
                gridTemplateRows: "1fr auto",
                height: "100%",
              }}
            >
              <div style={{ alignItems: "end", display: "flex" }}>
                <div
                  title={`${config.objective} / ${load}%`}
                  style={{
                    background: active
                      ? "linear-gradient(180deg,var(--accent),color-mix(in oklch,var(--accent) 40%,transparent))"
                      : "color-mix(in oklch,var(--accent) 24%,transparent)",
                    border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                    borderRadius: "7px 7px 4px 4px",
                    height: `${load}%`,
                    minHeight: 8,
                    width: "100%",
                  }}
                />
              </div>
              <div className="mono" style={{ color: active ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 700, textAlign: "center" }}>
                {day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SessionCard = memo(function SessionCard() {
  const session = useAppStore((state) => state.session);
  const aiPrompt = useAppStore((state) => state.aiPrompt);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const blocks = session.blocks.slice(0, 4);
  const exercisePool = [...catalog, ...exerciseVariants];
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Sesion activa</span>
          <h3>{session.name}</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => useAppStore.getState().setView("sessions")}
        >
          Abrir
        </button>
      </div>
      <p className="session-source-note">
        {aiPrompt.trim()
          ? `Problema tactico que ataca: ${shorten(aiPrompt, 128)}`
          : "Todavia no hay un diagnostico activo enlazado a esta sesion."}
      </p>
      {blocks.length ? (
        <div className="list">
          {blocks.map((block, index) => {
            const { exercise, missing } = resolveExerciseSelection(
              block.exerciseId,
              exercisePool,
            );
            return (
              <div className="list-row" key={block.id}>
                <div className="lr-icon">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <b style={missing ? { color: "var(--warn)" } : undefined}>
                    {missing ? "Ejercicio retirado del catalogo" : exercise.title}
                  </b>
                  <small>
                    {missing
                      ? `${block.durationMin} min`
                      : `${block.durationMin} min / ${exercise.objective.primary}`}
                  </small>
                </div>
                <span className="chip">{block.durationMin}'</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Todavia no hay bloques. Agrega ejercicios desde Biblioteca o Visor.
        </p>
      )}
    </div>
  );
});

const ReportsCard = memo(function ReportsCard({
  reports,
  error,
}: {
  reports: SavedPostMatchReport[];
  error: string | null;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Post-partido</span>
          <h3>Ultimos reportes</h3>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            useAppStore.getState().setAiMode("postMatch");
            useAppStore.getState().setView("ai");
          }}
        >
          Abrir
        </button>
      </div>
      {error ? <p style={{ color: "var(--muted)" }}>{error}</p> : null}
      <p className="session-source-note">
        Cada revision alimenta el siguiente diagnostico y la historia tactica
        del equipo.
      </p>
      {reports.length ? (
        <div className="list">
          {reports.map((report) => (
            <button
              type="button"
              className="list-row"
              key={report.id}
              onClick={() => {
                useAppStore.getState().setAiMode("postMatch");
                useAppStore.getState().setView("ai");
              }}
            >
              <div className="lr-icon">{report.report.matchContext.result}</div>
              <div>
                <b>vs {report.report.matchContext.opponent}</b>
                <small>{report.report.matchContext.date ?? report.savedAt.slice(0, 10)}</small>
              </div>
              <span className="tag-pill">guardado</span>
            </button>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Sin reportes guardados todavia.
        </p>
      )}
    </div>
  );
});

const PatternCommandCard = memo(function PatternCommandCard({
  patterns,
}: { patterns: TeamPattern[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <span className="eyebrow">Evolucion</span>
          <h3>Problema recurrente</h3>
        </div>
        <span className="tag-pill">{patterns.length}</span>
      </div>
      {patterns.length ? (
        <div className="list">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              kind={pattern.kind}
              title={patternKindLabel(pattern.kind)}
              body={pattern.statement}
              meta={pattern.confidence}
            />
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>
          Sin historial suficiente para afirmar patron. Carga post-match simple
          para empezar a medir evolucion.
        </p>
      )}
    </div>
  );
});

function patternKindLabel(kind: TeamPattern["kind"]) {
  const labels: Record<TeamPattern["kind"], string> = {
    repeatedProblem: "Se repite",
    newProblem: "Nuevo",
    improvement: "Mejora",
    regression: "Retroceso",
    problemNotTrained: "No entrenado",
    gameModelContradiction: "Contra modelo",
  };
  return labels[kind];
}

function buildNextAction({
  aiPrompt,
  evidenceTotal,
  latestReport,
  manualObservationCount,
  recommendedWeeklyFocus,
  sessionBlocks,
}: {
  aiPrompt: string;
  evidenceTotal: number;
  latestReport?: SavedPostMatchReport;
  manualObservationCount: number;
  recommendedWeeklyFocus?: string;
  sessionBlocks: number;
}): NextAction {
  if (recommendedWeeklyFocus) {
    return {
      title: "Cerra el loop con una decision de evolucion",
      body:
        `${recommendedWeeklyFocus} Usa Equipo / evolucion para decidir que corregir esta semana y que sostener.`,
      shortLabel: "Revisar evolucion y bajar una decision semanal.",
      cta: "Ver evolucion",
      onClick: () => useAppStore.getState().setView("team"),
    };
  }

  if (!latestReport) {
    return {
      title: "Empeza por un post-partido corto",
      body:
        "Carga rival, resultado y tres notas. Ese reporte va a ordenar el siguiente diagnostico y evitar que el coach invente contexto.",
      shortLabel: "Cargar post-partido para abrir la semana con evidencia.",
      cta: "Cargar post-partido",
      onClick: () => {
        useAppStore.getState().setAiMode("postMatch");
        useAppStore.getState().setView("ai");
      },
    };
  }

  if (!aiPrompt.trim() && manualObservationCount > 0) {
    return {
      title: "Convierte una observacion del staff en decision",
      body:
        "Ya hay observaciones manuales guardadas. Llevalas al Coach para separar hipotesis, evidencia actual y siguiente accion.",
      shortLabel: "Pasar de observacion manual a diagnostico.",
      cta: "Abrir diagnostico",
      onClick: () => {
        useAppStore.getState().setAiMode("coach");
        useAppStore.getState().setView("ai");
      },
    };
  }

  if (!aiPrompt.trim()) {
    return {
      title: "Formula el problema tactico de la semana",
      body:
        "Ya hay evidencia reciente. Ahora converti esa evidencia en una pregunta tactica concreta para el coach.",
      shortLabel: "Pasar de la evidencia al diagnostico.",
      cta: "Abrir diagnostico",
      onClick: () => {
        useAppStore.getState().setAiMode("coach");
        useAppStore.getState().setView("ai");
      },
    };
  }

  if (!sessionBlocks) {
    return {
      title: "Baja el diagnostico a cancha",
      body:
        "El problema ya esta formulado. Converti el ajuste principal en una sesion con bloques, carga y objetivos claros.",
      shortLabel: "Convertir el diagnostico en sesion.",
      cta: "Armar sesion",
      onClick: () => useAppStore.getState().setView("sessions"),
    };
  }

  if (!evidenceTotal) {
    return {
      title: "Completa la semana con evidencia observable",
      body:
        "La sesion ya existe. Marca video o eventos del partido para poder revisar si el ajuste realmente aparecio.",
      shortLabel: "Cargar evidencia de video para la revision.",
      cta: "Ir a video",
      onClick: () => useAppStore.getState().setView("video"),
    };
  }

  return {
    title: "La semana ya tiene direccion clara",
    body:
      "Diagnostico, sesion y evidencia ya estan conectados. Lo que sigue es revisar el partido y consolidar lo que cambia en el equipo.",
    shortLabel: "Revisar partido y consolidar aprendizaje.",
    cta: "Revisar partido",
    onClick: () => {
      useAppStore.getState().setAiMode("postMatch");
      useAppStore.getState().setView("ai");
    },
  };
}

function loopStage(
  sessionBlocks: number,
  reports: number,
  patterns: number,
): "observar" | "diagnosticar" | "entrenar" | "revisar" | "evolucionar" {
  if (patterns > 0) return "evolucionar";
  if (reports > 0) return "revisar";
  if (sessionBlocks > 0) return "entrenar";
  return "diagnosticar";
}

function currentMicrocycleDay(days: Record<string, { targetLoad: string; objective: string }>) {
  const preferred = Object.keys(days).find((day) => day === "MD-3");
  return { label: preferred ?? Object.keys(days)[0] ?? "MD-3" };
}

function loadPercent(load: string) {
  if (load === "high") return 92;
  if (load === "med") return 64;
  return 32;
}

function shorten(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function formatObservationDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
