import type {
  CoachAction,
  CoachInterviewState,
  CoachMatchAdvice,
  CoachResponse,
  CollectedAnswer,
  ContextualQuestion,
  EvidenceAudit,
} from "@/ai/CoachSchemas";
import {
  requestCoachTurn,
  type CoachAgentRuntimeContext,
} from "@/ai/coachAgentClient";
import { PostMatchAnalysisView } from "@/ai/post-match/PostMatchAnalysisView";
import { usePostMatchReports } from "@/ai/post-match/usePostMatchReports";
import {
  detectTeamPatterns,
  type TeamPattern,
} from "@/ai/patternDetection";
import type {
  MemoryCandidate,
  SavedPostMatchReport,
} from "@/ai/post-match/schemas";
import { catalog, type Exercise, type Player } from "@/data";
import { buildSessionPlanFromDiagnosis } from "@/sessions/diagnosisSession";
import { exportCoachDiagnosisHtml } from "@/export/premiumExports";
import {
  ConfidenceMeter,
  EvidenceChip,
  FitChip,
  ModeBadge,
  PitchViz,
} from "@/ui/tacticalPrimitives";
import {
  getExerciseById,
  useAppStore,
} from "@/state/useAppStore";
import {
  summarizeVideoEvidence,
  videoEvidenceToTagsText,
} from "@/video/videoEvidence";
import {
  saveCoachFeedback,
  type CoachFeedbackRating,
} from "@/ai/coachFeedback";
import { useEffect, useMemo, useState } from "react";

type AgentStatus = {
  ok: boolean;
  openRouterConfigured: boolean;
  openRouterModel: string;
  geminiConfigured: boolean;
  runtime: string;
};

type LastRunState =
  | { state: "idle" }
  | { state: "running"; at: string }
  | { state: "success"; at: string; model?: string }
  | { state: "error"; at: string; message: string };

type CockpitContext = {
  availablePlayers: number;
  unavailablePlayers: number;
  teamModel: string;
  shapes: number;
  transitions: number;
  activeShape: string;
  currentExercise: string;
  sessionBlocks: number;
  videoTags: number;
  videoTracks: number;
  manualObservations: number;
  recentReports: SavedPostMatchReport[];
  acceptedMemory: Array<{
    reportId: string;
    opponent: string;
    candidate: MemoryCandidate;
  }>;
  teamPatterns: TeamPattern[];
};

type CoachEvidenceCitation = CoachMatchAdvice["evidenceCitations"][number];

type EvidenceBucket = "current" | "memory" | "context";

type EvidenceViewModel = {
  citation: CoachEvidenceCitation;
  bucket: EvidenceBucket;
  sourceLabel: string;
  modeLabel: string;
  date?: string;
  opponent?: string;
  score?: string;
  relevance: number;
};

export function AiView() {
  const prompt = useAppStore((state) => state.aiPrompt);
  const coachShapeContext = useAppStore((state) => state.coachShapeContext);
  const teamPlayers = useAppStore((state) => state.team.players);
  const teamModel = useAppStore((state) => state.team.model);
  const lineupLabShapes = useAppStore((state) => state.lineupLab.shapes);
  const lineupLabTransitions = useAppStore(
    (state) => state.lineupLab.savedTransitions,
  );
  const tagsCount = useAppStore((state) => state.tags.length);
  const tracksCount = useAppStore((state) => state.tracks.length);
  const sessionBlockCount = useAppStore((state) => state.session.blocks.length);
  const manualObservations = useAppStore((state) => state.manualObservations);
  const weeklyDecisionThread = useAppStore((state) => state.weeklyDecisionThread);
  const selectedExerciseId = useAppStore((state) => state.selectedExerciseId);
  const mode = useAppStore((state) => state.aiMode);
  const setMode = useAppStore((state) => state.setAiMode);
  const coachInterview = useAppStore((state) => state.coachInterview);
  const recordCoachAnswer = useAppStore((state) => state.recordCoachAnswer);
  const applyCoachTurnResult = useAppStore(
    (state) => state.applyCoachTurnResult,
  );
  const skipCoachInterview = useAppStore((state) => state.skipCoachInterview);
  const [advice, setAdvice] = useState<CoachMatchAdvice | null>(null);
  const [responseMode, setResponseMode] =
    useState<CoachResponse["mode"] | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentStatusError, setAgentStatusError] = useState<string | null>(null);
  const { reports, reportsError } = usePostMatchReports();
  const [lastRun, setLastRun] = useState<LastRunState>({ state: "idle" });

  const input = prompt.trim();
  const selectedExercise = getExerciseById(selectedExerciseId);
  const recentReports = useMemo(
    () =>
      [...reports].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 3),
    [reports],
  );
  const acceptedMemory = useMemo(
    () =>
      reports
        .flatMap((savedReport) =>
          savedReport.report.memoryCandidates
            .filter(
              (candidate) =>
                candidate.selectedByStaff ||
                savedReport.staffReview.acceptedMemoryCandidateIds.includes(
                  candidate.id,
                ),
            )
            .map((candidate) => ({
              reportId: savedReport.id,
              opponent: savedReport.report.matchContext.opponent,
              candidate,
            })),
        )
        .slice(0, 5),
    [reports],
  );
  const teamPatterns = useMemo(
    () => detectTeamPatterns(reports, { limit: 4 }),
    [reports],
  );
  const availablePlayers = useMemo(
    () =>
      teamPlayers.filter((player) => player.status === "available").length,
    [teamPlayers],
  );
  const unavailablePlayers = teamPlayers.length - availablePlayers;
  const cockpitContext = useMemo(
    () => ({
      availablePlayers,
      unavailablePlayers,
      teamModel: teamModel || "Modelo de equipo no definido",
      shapes: lineupLabShapes.length,
      transitions: lineupLabTransitions.length,
      activeShape:
        coachShapeContext?.selectedShapeName ??
        lineupLabShapes[0]?.name ??
        "Sin shape activo",
      currentExercise: selectedExercise?.title ?? "Sin ejercicio",
      sessionBlocks: sessionBlockCount,
      videoTags: tagsCount,
      videoTracks: tracksCount,
      manualObservations: manualObservations.length,
      recentReports,
      acceptedMemory,
      teamPatterns,
    }),
    [
      acceptedMemory,
      availablePlayers,
      coachShapeContext,
      lineupLabShapes,
      lineupLabTransitions.length,
      recentReports,
      selectedExercise?.title,
      sessionBlockCount,
      manualObservations.length,
      tagsCount,
      teamModel,
      teamPatterns,
      tracksCount,
      unavailablePlayers,
    ],
  );

  useEffect(() => {
    void refreshAgentStatus();
  }, []);

  async function refreshAgentStatus() {
    const statusResult = await Promise.allSettled([requestAgentStatus()]);

    if (statusResult[0].status === "fulfilled") {
      setAgentStatus(statusResult[0].value);
      setAgentStatusError(null);
    } else {
      setAgentStatus(null);
      setAgentStatusError("No se pudo leer el estado del agente.");
    }
  }

  async function runCoachAgent(options?: {
    collectedEvidence?: CollectedAnswer[];
    skipInterview?: boolean;
  }) {
    if (!input || loading) return;
    const runtimeState = useAppStore.getState();
    const coachContext = buildCoachRuntimeContext(
      runtimeState.team,
      runtimeState.coachShapeContext,
      runtimeState.gameModel,
      runtimeState.opponentScout,
    );
    const runtimeInterview = useAppStore.getState().coachInterview;
    const collectedEvidence =
      options?.collectedEvidence ?? runtimeInterview.collectedEvidence;
    const interviewState = buildCoachInterviewState(runtimeInterview);
    const startedAt = new Date().toISOString();

    setLoading(true);
    setError(null);
    setLastRun({ state: "running", at: startedAt });

    try {
      const response = await requestCoachTurn(input, coachContext, {
        collectedEvidence,
        interviewState,
        skipInterview: options?.skipInterview,
      });
      applyCoachTurnResult(response);
      setResponseMode(response.mode);
      setAdvice(response.mode === "question" ? null : response.advice);
      if (response.mode === "question") {
        setDraftAnswers({});
      }
      setLastRun({
        state: "success",
        at: new Date().toISOString(),
        model: agentStatus?.openRouterModel,
      });
      void refreshAgentStatus();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo consultar el agente tactico.";
      setAdvice(null);
      setError(message);
      setLastRun({
        state: "error",
        at: new Date().toISOString(),
        message,
      });
    } finally {
      setLoading(false);
    }
  }

  function submitInterviewAnswers() {
    const answers = coachInterview.questions.flatMap((question) => {
      const answer = draftAnswers[question.id]?.trim();
      if (!answer) return [];

      return [
        buildCollectedAnswer(question, answer),
      ];
    });

    if (!answers.length) {
      setError("Responde al menos una pregunta o salta a hipotesis.");
      return;
    }

    for (const answer of answers) {
      recordCoachAnswer(answer);
    }

    const replacedQuestionIds = new Set(answers.map((answer) => answer.questionId));
    const nextCollectedEvidence = [
      ...coachInterview.collectedEvidence.filter(
        (answer) => !replacedQuestionIds.has(answer.questionId),
      ),
      ...answers,
    ];

    void runCoachAgent({ collectedEvidence: nextCollectedEvidence });
  }

  function skipInterviewAndRunHypothesis() {
    skipCoachInterview();
    void runCoachAgent({ skipInterview: true });
  }

  if (mode === "postMatch") {
    return (
      <>
        <AiModeTabs mode={mode} setMode={setMode} />
        <PostMatchAnalysisView />
      </>
    );
  }

  return (
    <>
      <AiModeTabs mode={mode} setMode={setMode} />
      <section className="ai-cockpit">
        <header className="ai-cockpit-hero team-card">
          <div>
            <span className="panel-eyebrow">Coach / informe semanal</span>
            <h3>Diagnostico tactico con contexto real del equipo</h3>
            <p>
              Formula el problema, revisa que evidencia sostiene la lectura y
              baja una decision concreta a la semana.
            </p>
          </div>
          <div className="ai-hero-metrics" aria-label="Resumen del agente">
            <MetricPill
              label="Plantel"
              value={`${cockpitContext.availablePlayers}/${teamPlayers.length}`}
            />
            <MetricPill label="Shapes" value={cockpitContext.shapes} />
            <MetricPill
              label="Evid actual"
              value={
                cockpitContext.videoTags +
                cockpitContext.videoTracks +
                cockpitContext.manualObservations
              }
            />
            <MetricPill
              label="Manual"
              value={cockpitContext.manualObservations}
            />
            <MetricPill
              label="Memoria"
              value={cockpitContext.acceptedMemory.length}
            />
          </div>
        </header>

        <div className="ai-cockpit-grid">
          <aside className="ai-context-rail">
            <AgentStatusPanel
              status={agentStatus}
              statusError={agentStatusError}
              lastRun={lastRun}
              loading={loading}
              onRefresh={() => void refreshAgentStatus()}
            />
            <ActiveContextPanel context={cockpitContext} />
            <RecentReportsPanel
              reports={cockpitContext.recentReports}
              error={reportsError}
            />
            <MemoryPanel acceptedMemory={cockpitContext.acceptedMemory} />
            <PatternsPanel patterns={cockpitContext.teamPatterns} />
          </aside>

          <main className="ai-workbench">
            <section className="ai-command-card team-card">
              <div className="section-title">
                <div>
                  <span className="panel-eyebrow">Consulta tactica</span>
                  <h3>Problema a resolver</h3>
                </div>
                <span className="ai-context-chip">
                  {cockpitContext.activeShape}
                </span>
              </div>
              <textarea
                placeholder="Describi el problema tactico, el contexto del partido, el sistema propio, el rival o el comportamiento que queres analizar."
                value={prompt}
                onChange={(event) =>
                  useAppStore.getState().setAiPrompt(event.target.value)
                }
              />
              <div className="ai-command-footer">
                <button
                  type="button"
                  className="btn primary"
                  disabled={!input || loading || agentStatus?.openRouterConfigured === false}
                  onClick={() => void runCoachAgent()}
                >
                  {loading
                    ? "Analizando..."
                    : agentStatus?.openRouterConfigured === false
                      ? "IA no disponible en este entorno"
                      : "Consultar Coach"}
                </button>
                <span>
                  Usa plantel, shapes publicados, reportes, memoria y evidencia
                  disponible para sostener la lectura.
                </span>
              </div>
              {agentStatus?.openRouterConfigured === false ? (
                <div className="tester-edge-state">
                  <b>Diagnostico en vivo no disponible</b>
                  <small>
                    La IA de Coach no esta configurada en este entorno. El
                    resto del flujo sigue disponible para demo, revision y
                    preparacion semanal.
                  </small>
                </div>
              ) : null}
              {error ? (
                <div className="ai-card ai-error-card" role="alert">
                  <b>Error del agente</b>
                  <p>{error}</p>
                </div>
              ) : null}
              {loading ? <CoachThinkingPanel /> : null}
            </section>

            {coachInterview.active && coachInterview.questions.length ? (
              <InterviewPanel
                questions={coachInterview.questions}
                audit={coachInterview.audit}
                drafts={draftAnswers}
                loading={loading}
                onDraftChange={(questionId, value) =>
                  setDraftAnswers((current) => ({
                    ...current,
                    [questionId]: value,
                  }))
                }
                onSubmit={submitInterviewAnswers}
                onSkip={skipInterviewAndRunHypothesis}
              />
            ) : null}

            {advice ? (
              <AdviceResult
                advice={advice}
                prompt={input}
                responseMode={responseMode}
              />
            ) : !coachInterview.active || !coachInterview.questions.length ? (
              <EmptyState
                context={cockpitContext}
                weeklyDecisionThread={weeklyDecisionThread}
              />
            ) : null}
          </main>
        </div>
      </section>
    </>
  );
}

function buildCoachInterviewState(
  interview: ReturnType<typeof useAppStore.getState>["coachInterview"],
): CoachInterviewState | null {
  if (!interview.intent || !interview.audit) return null;

  return {
    intent: interview.intent,
    temptingClaims: interview.temptingClaims,
    audit: interview.audit,
  };
}

function buildCollectedAnswer(
  question: ContextualQuestion,
  rawAnswer: string,
): CollectedAnswer {
  return {
    questionId: question.id,
    evidenceTarget: question.evidenceTarget,
    category: question.category,
    answerKind: question.options?.includes(rawAnswer)
      ? "singleChoice"
      : question.answerKind,
    rawAnswer,
  };
}

function evidenceStrengthLabel(
  strength: CoachInterviewState["audit"]["evidenceStrength"],
) {
  const labels: Record<CoachInterviewState["audit"]["evidenceStrength"], string> = {
    none: "Muy baja",
    weak: "Baja",
    partial: "Media",
    sufficient: "Suficiente",
  };
  return labels[strength];
}

function impactLabel(value: ContextualQuestion["expectedImpactOnDiagnosis"]) {
  const labels: Record<ContextualQuestion["expectedImpactOnDiagnosis"], string> = {
    high: "impacto alto",
    medium: "impacto medio",
    low: "impacto bajo",
  };
  return labels[value];
}

function buildCoachRuntimeContext(
  team: ReturnType<typeof useAppStore.getState>["team"],
  coachShapeContext: ReturnType<
    typeof useAppStore.getState
  >["coachShapeContext"],
  gameModel: ReturnType<typeof useAppStore.getState>["gameModel"],
  opponentScout: ReturnType<typeof useAppStore.getState>["opponentScout"],
): CoachAgentRuntimeContext {
  const runtimeState = useAppStore.getState();
  const lineupLab = runtimeState.lineupLab;
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const { tags, tracks, manualObservations } = runtimeState;
  const videoEvidenceSummary = summarizeVideoEvidence(tags, tracks);
  const videoEvidenceText = videoEvidenceToTagsText(tags, tracks).trim();
  const toPlayer = (player: Player) => ({
    name: player.name,
    num: player.num,
    positions: player.positions,
    status: player.status,
    profile: player.profile,
    attributes: {
        speed: player.attributes.speed,
        stamina: player.attributes.stamina,
        pass: player.attributes.pass,
        control: player.attributes.control,
        press: player.attributes.press,
        tactical: player.attributes.tactical,
        duel: player.attributes.duel,
      },
  });

  return {
    shapeContext: coachShapeContext,
    teamModel: team.model,
    gameModel,
    opponentScout,
    videoEvidence: videoEvidenceText
      ? {
          ...videoEvidenceSummary,
          text: videoEvidenceText,
        }
      : undefined,
    manualObservations,
    savedLineups: team.lineups.map((lineup) => ({
      id: lineup.id,
      name: lineup.name,
      formation: lineup.formation,
      players: lineup.ownPositions.map((position) => ({
        playerId: position.playerId,
        playerName: playerById.get(position.playerId)?.name,
        role: position.role,
        x: position.pos.x,
        y: position.pos.y,
      })),
    })),
    lineupLabShapes: lineupLab.shapes.map((shape) => ({
      id: shape.id,
      name: shape.name,
      phase: shape.phase,
      notes: shape.notes,
      players: Object.entries(shape.positions).flatMap(([playerId, pos]) => {
        const player = playerById.get(playerId);
        if (!player) return [];
        return [
          {
            playerId,
            playerName: player.name,
            num: player.num,
            positions: [...player.positions],
            x: pos.x,
            y: pos.y,
          },
        ];
      }),
    })),
    lineupLabTransitions: lineupLab.savedTransitions.map((transition) => ({
      id: transition.id,
      name: transition.name,
      fromShapeId: transition.fromShapeId,
      fromShapeName: transition.fromShapeName,
      toShapeId: transition.toShapeId,
      toShapeName: transition.toShapeName,
      notes: transition.notes,
    })),
    availableSquad: team.players
      .filter((player) => player.status === "available")
      .map(toPlayer),
    unavailableSquad: team.players
      .filter((player) => player.status !== "available")
      .map(toPlayer),
  };
}

function AiModeTabs({
  mode,
  setMode,
}: {
  mode: "coach" | "postMatch";
  setMode: (mode: "coach" | "postMatch") => void;
}) {
  return (
    <div className="segmented ai-mode-tabs" style={{ marginBottom: 14 }}>
      <button
        type="button"
        className={mode === "coach" ? "active" : ""}
        onClick={() => setMode("coach")}
      >
        Consulta tactica
      </button>
      <button
        type="button"
        className={mode === "postMatch" ? "active" : ""}
        onClick={() => setMode("postMatch")}
      >
        Post partido
      </button>
    </div>
  );
}

function AgentStatusPanel({
  status,
  statusError,
  lastRun,
  loading,
  onRefresh,
}: {
  status: AgentStatus | null;
  statusError: string | null;
  lastRun: LastRunState;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="ai-rail-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Estado del agente</span>
          <h4>Motor IA</h4>
        </div>
        <button type="button" className="secondary" onClick={onRefresh}>
          Refrescar
        </button>
      </div>
      <div className="ai-status-grid">
        <StatusLine
          label="OpenRouter"
          value={
            status?.openRouterConfigured
              ? "Disponible"
              : "No configurado para este entorno"
          }
          tone={status?.openRouterConfigured ? "ok" : "warn"}
        />
        <StatusLine
          label="Modelo"
          value={status?.openRouterModel ?? "No detectado"}
        />
        <StatusLine label="Runtime" value={status?.runtime ?? "local"} />
        <StatusLine label="Fallback" value="Automatico server-side" />
        <StatusLine
          label="Ultima consulta"
          value={labelForLastRun(lastRun, loading)}
          tone={
            lastRun.state === "error"
              ? "warn"
              : lastRun.state === "success"
                ? "ok"
                : undefined
          }
        />
      </div>
      {statusError ? <p className="muted-panel">{statusError}</p> : null}
      {status && !status.openRouterConfigured ? (
        <div className="tester-edge-state">
          <b>Coach IA no disponible</b>
          <small>
            Configura la clave server-side antes de un piloto con diagnostico en
            vivo. Mientras tanto, usa Sala, Sesion, Post-partido y Evolucion
            para mostrar el flujo completo sin mensajes rotos.
          </small>
        </div>
      ) : null}
      {lastRun.state === "error" ? (
        <div className="tester-edge-state warn">
          <b>El proveedor no respondio bien</b>
          <small>{humanizeAgentError(lastRun.message)}</small>
        </div>
      ) : null}
    </section>
  );
}

function CoachThinkingPanel() {
  return (
    <div className="coach-thinking-panel" aria-live="polite">
      <span className="coach-thinking-dot" />
      <div>
        <b>El Coach esta trabajando</b>
        <small>
          Recolectando evidencia, contrastando modelo de juego y preparando
          alternativas con trade-off.
        </small>
      </div>
    </div>
  );
}

function ActiveContextPanel({ context }: { context: CockpitContext }) {
  return (
    <section className="ai-rail-card">
      <span className="panel-eyebrow">Contexto activo</span>
      <h4>Contexto cargado</h4>
      <div className="ai-context-list">
        <ContextRow label="Modelo" value={context.teamModel} />
        <ContextRow
          label="Plantel"
          value={`${context.availablePlayers} disponibles / ${context.unavailablePlayers} no disponibles`}
        />
        <ContextRow label="Shape activo" value={context.activeShape} />
        <ContextRow
          label="Shapes"
          value={`${context.shapes} shapes / ${context.transitions} transiciones`}
        />
        <ContextRow label="Ejercicio actual" value={context.currentExercise} />
        <ContextRow
          label="Sesion"
          value={`${context.sessionBlocks} bloques cargados`}
        />
        <ContextRow
          label="Video"
          value={`${context.videoTags} tags / ${context.videoTracks} tracks`}
        />
        <ContextRow
          label="Obs manuales"
          value={`${context.manualObservations} capturas del staff`}
        />
      </div>
    </section>
  );
}

function RecentReportsPanel({
  reports,
  error,
}: {
  reports: SavedPostMatchReport[];
  error: string | null;
}) {
  return (
    <section className="ai-rail-card">
      <span className="panel-eyebrow">Reportes</span>
      <h4>Ultimos reportes</h4>
      {error ? <p className="muted-panel">{error}</p> : null}
      {reports.length ? (
        <div className="ai-mini-list">
          {reports.map((report) => (
            <div className="ai-mini-item" key={report.id}>
              <b>{report.report.matchContext.opponent}</b>
              <small>
                {report.report.matchContext.result} -{" "}
                {report.report.matchContext.date ?? report.savedAt.slice(0, 10)}
              </small>
              <p>{report.report.executiveSummary}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-panel">
          Sin reportes guardados. El agente igual puede responder, pero con
          menos memoria real del equipo.
        </p>
      )}
    </section>
  );
}

function MemoryPanel({
  acceptedMemory,
}: {
  acceptedMemory: CockpitContext["acceptedMemory"];
}) {
  return (
    <section className="ai-rail-card">
      <span className="panel-eyebrow">Memoria validada</span>
      <h4>Memoria aceptada</h4>
      {acceptedMemory.length ? (
        <div className="ai-mini-list">
          {acceptedMemory.map(({ reportId, opponent, candidate }) => (
            <div className="ai-mini-item" key={`${reportId}-${candidate.id}`}>
              <b>{memoryCategoryLabel(candidate.category)}</b>
              <small>vs {opponent}</small>
              <p>{candidate.statement}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-panel">
          Todavia no hay aprendizajes aceptados. Se crean desde post-partido y
          solo pasan a memoria si el staff los aprueba.
        </p>
      )}
    </section>
  );
}

function PatternsPanel({ patterns }: { patterns: TeamPattern[] }) {
  return (
    <section className="ai-rail-card">
      <span className="panel-eyebrow">Patrones</span>
      <h4>Patrones detectados</h4>
      {patterns.length ? (
        <div className="ai-mini-list">
          {patterns.map((pattern) => (
            <PatternCard pattern={pattern} key={pattern.id} />
          ))}
        </div>
      ) : (
        <p className="muted-panel">
          Sin patrones detectados todavia. Se activan cuando haya reportes
          post-partido comparables.
        </p>
      )}
    </section>
  );
}

function InterviewPanel({
  questions,
  audit,
  drafts,
  loading,
  onDraftChange,
  onSubmit,
  onSkip,
}: {
  questions: ContextualQuestion[];
  audit: EvidenceAudit | null;
  drafts: Record<string, string>;
  loading: boolean;
  onDraftChange: (questionId: string, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const answered = questions.filter((question) => drafts[question.id]?.trim()).length;
  const criticalTotal = Math.max(
    questions.length,
    (audit?.missing.length ?? 0) + (audit?.covered.length ?? 0),
    1,
  );
  const evidenceValue =
    audit?.evidenceStrength === "sufficient"
      ? 0.85
      : audit?.evidenceStrength === "partial"
        ? 0.58
        : audit?.evidenceStrength === "weak"
          ? 0.35
          : 0.18;

  return (
    <section className="coach-report interview-panel">
      <header className="coach-report-head compact">
        <div>
          <div className="football-report-kicker">
            <ModeBadge mode="question" />
            <span className="panel-eyebrow">Modo entrevista tactica</span>
          </div>
          <h3>Falta evidencia antes de diagnosticar</h3>
          <p>
            Respondé lo que puedas. Si preferís avanzar igual, el agente va a
            devolver una hipotesis con confianza limitada.
          </p>
        </div>
        <ConfidenceMeter
          value={evidenceValue}
          label="Evidencia"
          reason={`${answered}/${criticalTotal} datos criticos respondidos. Estado: ${
            audit ? evidenceStrengthLabel(audit.evidenceStrength) : "Baja"
          }.`}
        />
      </header>

      {audit?.missing.length ? (
        <div className="interview-missing">
          <span>Lo que falta confirmar</span>
          <p>
            {audit.missing
              .slice(0, 3)
              .map((item) => item.reason)
              .join(" ")}
          </p>
        </div>
      ) : null}

      <div className="interview-question-list">
        {questions.map((question) => (
          <QuestionCard
            question={question}
            value={drafts[question.id] ?? ""}
            onChange={(value) => onDraftChange(question.id, value)}
            key={question.id}
          />
        ))}
      </div>

      <div className="ai-command-footer interview-actions">
        <button
          type="button"
          className="btn primary"
          disabled={loading}
          onClick={onSubmit}
        >
          {loading ? "Analizando..." : "Responder y continuar analisis"}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={loading}
          onClick={onSkip}
        >
          Saltar y recibir hipotesis
        </button>
      </div>
    </section>
  );
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: ContextualQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <article className="interview-question-card">
      <div className="interview-question-head">
        <span>{question.category}</span>
        <b>{impactLabel(question.expectedImpactOnDiagnosis)}</b>
        <EvidenceChip
          type="staff"
          label={value.trim() ? "respondida" : "pendiente"}
        />
      </div>
      <h4>{question.question}</h4>
      <p>{question.whyItMatters}</p>
      {question.options?.length ? (
        <div className="interview-options">
          {question.options.map((option) => (
            <button
              type="button"
              className={value === option ? "active" : "secondary"}
              onClick={() => onChange(option)}
              key={option}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        className="interview-answer"
        value={value}
        placeholder="Respuesta libre opcional..."
        onChange={(event) => onChange(event.target.value)}
      />
    </article>
  );
}

function AdviceResult({
  advice,
  prompt,
  responseMode,
}: {
  advice: CoachMatchAdvice;
  prompt: string;
  responseMode: CoachResponse["mode"] | null;
}) {
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const lineups = useAppStore((state) => state.team.lineups);
  const shapes = useAppStore((state) => state.lineupLab.shapes);
  const exerciseVariants = useAppStore((state) => state.exerciseVariants);
  const allExercises = useMemo(
    () => [...catalog, ...exerciseVariants],
    [exerciseVariants],
  );
  const actionGroups = useMemo(
    () => buildAdviceActionGroups(advice, allExercises),
    [advice, allExercises],
  );
  const diagnosisSessionPlan = useMemo(
    () => buildSessionPlanFromDiagnosis(advice, allExercises),
    [advice, allExercises],
  );
  const evidenceItems = useMemo(
    () => buildEvidenceViewModel(advice.evidenceCitations),
    [advice.evidenceCitations],
  );
  const currentEvidence = useMemo(
    () => evidenceItems.filter((item) => item.bucket === "current").length,
    [evidenceItems],
  );
  const modelWarningCount = useMemo(
    () =>
      advice.modelContrast.contradictions.length +
      advice.modelContrast.insufficientEvidence.length,
    [advice.modelContrast.contradictions.length, advice.modelContrast.insufficientEvidence.length],
  );
  const modeSupport = useMemo(
    () =>
      buildModeSupportState({
        advice,
        responseMode,
        currentEvidence,
        totalEvidence: evidenceItems.length,
      }),
    [advice, currentEvidence, evidenceItems.length, responseMode],
  );
  const pitchOverlays = useMemo(() => buildDiagnosisPitchOverlays(advice), [advice]);
  const directActions = useMemo(
    () =>
      advice.actions.filter((action) => {
        if (action.type === "createSessionFromDiagnosis") return true;
        if (action.type === "applyLineup") {
          return lineups.some((lineup) => lineup.id === action.lineupId);
        }
        if (action.type === "applyShape") {
          return shapes.some((shape) => shape.id === action.shapeId);
        }
        if (action.type === "createExerciseFromShape") {
          return shapes.some((shape) => shape.id === action.shapeId);
        }
        return false;
      }),
    [advice.actions, lineups, shapes],
  );
  const summaryModeLabel =
    responseMode === "diagnosis" && currentEvidence > 0
      ? "Diagnostico"
      : "Hipotesis";
  const supportSummary = currentEvidence
    ? `${currentEvidence} evidencia(s) actual(es) citada(s) y ${Math.max(0, evidenceItems.length - currentEvidence)} apoyo(s) extra.`
    : evidenceItems.length
      ? "No hay evidencia actual citada; la lectura se apoya en memoria, reportes previos o principios."
      : "No hay citas validas para sostener un diagnostico cerrado.";
  const nextStepSummary =
    currentEvidence > 0
      ? "Convierte esta lectura en sesion y revisala en el proximo partido."
      : "Carga mas observacion actual o valida esta hipotesis en post-partido antes de cerrarla.";

  function runAction(action: CoachAction, exercise?: Exercise) {
    const store = useAppStore.getState();
    if (action.type === "openExercise" && exercise) {
      store.selectExercise(exercise.id);
      store.setView("viewer");
      setActionStatus(`Ejercicio abierto: ${exercise.title}`);
      return;
    }
    if (action.type === "addToSession" && exercise) {
      store.addToSession(exercise.id);
      store.setView("sessions");
      setActionStatus(`Agregado a sesion: ${exercise.title}`);
      return;
    }
    if (action.type === "createExerciseVariant" && exercise) {
      const variantId = store.createExerciseVariantFrom(exercise.id, {
        title: action.title,
        authorNotes: action.rationale,
      });
      setActionStatus(
        variantId
          ? `Variante creada desde: ${exercise.title}`
          : "No se pudo crear la variante.",
      );
      return;
    }
    if (action.type === "applyLineup" && action.lineupId) {
      store.applyLineupToViewer(action.lineupId);
      setActionStatus("Lineup aplicado al visor.");
      return;
    }
    if (action.type === "applyShape" && action.shapeId) {
      store.requestApplyShape(action.shapeId);
      setActionStatus("Shape enviado al Lineup Lab 3D.");
      return;
    }
    if (action.type === "createExerciseFromShape" && action.shapeId) {
      const exerciseId = store.createExerciseFromShape(action.shapeId, {
        title: action.title,
        authorNotes: action.rationale,
      });
      setActionStatus(
        exerciseId
          ? "Ejercicio creado desde el shape y abierto en el visor."
          : "No se pudo crear el ejercicio desde ese shape.",
      );
      return;
    }
    if (action.type === "createSessionFromDiagnosis") {
      const response: CoachResponse = {
        mode: "diagnosis",
        advice,
        intent: {
          domains: [],
          specificity: "general",
          requestType: "actionPlan",
          impliedClaims: [],
        },
        evidenceAudit: {
          covered: [],
          missing: [],
          criticalMissingCount: 0,
          evidenceStrength: "partial",
        },
      };
      const created = store.createSessionFromCoachAdvice(response);
      setActionStatus(
        created
              ? "Sesion creada desde el diagnostico con bloques, carga y senales."
          : "No se pudo crear la sesion desde este diagnostico.",
      );
    }
  }

  return (
    <section className="coach-report football-report">
      <ShortCoachSummary
        modeLabel={summaryModeLabel}
        hypothesis={advice.tacticalReading}
        supportingEvidence={supportSummary}
        missingValidation={advice.reflection.missingInformation}
        primaryAction={advice.wednesdayTest}
        nextStep={nextStepSummary}
        confidence={advice.reflection.confidence}
      />

      <details className="football-report-details coach-analysis-details">
        <summary>Ver analisis completo</summary>

      <header className="football-report-hero">
        <div>
          <div className="football-report-kicker">
            <ModeBadge mode={responseMode} />
            <EvidenceChip
              type="observation"
              label={`${currentEvidence} evidencias actuales`}
            />
            <EvidenceChip
              type="shape"
              label={`${modelWarningCount} alertas modelo`}
            />
            {modeSupport.pill ? (
              <EvidenceChip type="inference" label={modeSupport.pill} />
            ) : null}
          </div>
          <h3>
            {summaryModeLabel === "Hipotesis"
              ? "Hipotesis operativa"
              : "Lectura del Coach"}
          </h3>
          <p>{advice.tacticalReading}</p>
          {modeSupport.note ? (
            <p className="mode-support-note">{modeSupport.note}</p>
          ) : null}
        </div>
        <ConfidenceMeter
          value={advice.reflection.confidence}
          reason={advice.reflection.missingInformation}
        />
      </header>

      <section className="coach-report-card decision-summary-card">
        <div className="section-title">
          <div>
            <span className="panel-eyebrow">Decision product</span>
            <h4>Lectura principal y siguiente accion</h4>
          </div>
          <ConfidenceBadge confidence={advice.reflection.confidence} compact />
        </div>
        <div className="problem-breakdown-grid">
          <div className="problem-breakdown-item">
            <span>Lectura principal</span>
            <b>{advice.probableCause}</b>
          </div>
          <div className="problem-breakdown-item">
            <span>Ajuste recomendado</span>
            <b>{advice.mainAdjustment}</b>
          </div>
          <div className="problem-breakdown-item">
            <span>Que sabe</span>
            <b>
              {currentEvidence
                ? `${currentEvidence} evidencia(s) del caso actual`
                : "Sin evidencia actual confirmada"}
            </b>
          </div>
          <div className="problem-breakdown-item">
            <span>Que falta validar</span>
            <b>{advice.reflection.missingInformation}</b>
          </div>
        </div>
      </section>

      <ProblemBreakdownPanel advice={advice} />

      <ModelContrastPanel advice={advice} />

      <KnowledgeGapPanel advice={advice} evidenceItems={evidenceItems} />

      <EvidencePanel evidenceItems={evidenceItems} />

      <AlternativeAdjustmentsPanel advice={advice} />

      <div className="football-report-grid">
        <PitchViz
          title="Zona tactica del diagnostico"
          subtitle="lectura aproximada"
          overlays={pitchOverlays}
        />
        <section className="coach-report-card">
          <span className="panel-eyebrow">Accion recomendada</span>
          <p>{advice.wednesdayTest}</p>
          <div className="toolbar compact" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                runAction({
                  type: "createSessionFromDiagnosis",
                  label: "Crear sesion desde diagnostico",
                })
              }
            >
              Convertir en sesion
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                useAppStore.getState().setAiMode("postMatch");
                useAppStore.getState().setView("ai");
              }}
            >
              Revisar en post-partido
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => exportCoachDiagnosisHtml(advice, { prompt })}
            >
              Exportar diagnostico
            </button>
          </div>
        </section>
      </div>

      <ReportList
        title="Instrucciones de campo"
        items={advice.onFieldInstructions}
      />

      <DiagnosisSessionPanel plan={diagnosisSessionPlan} />

      <ActionPanel
        actionGroups={actionGroups}
        directActions={directActions}
        actionStatus={actionStatus}
        runAction={runAction}
      />

      <div className="coach-report-grid">
        <ReportBlock title="Foco de partido" value={advice.saturdayFocus} />
      </div>

      <div className="coach-report-grid">
        <ReportList title="Riesgos del ajuste" items={advice.adjustmentRisks} />
        <ReportList title="Senales de validacion" items={advice.successSignals} />
      </div>

      {advice.playerFitWarnings.length ? (
        <section className="coach-report-card">
          <span className="panel-eyebrow">Fit del plantel</span>
          <div className="toolbar compact" style={{ flexWrap: "wrap", marginTop: 10 }}>
            {advice.playerFitWarnings.map((warning) => (
              <FitChip level="risk" key={warning}>
                {warning}
              </FitChip>
            ))}
          </div>
        </section>
      ) : null}

      <CoachFeedbackPanel
        advice={advice}
        prompt={prompt}
        responseMode={responseMode}
      />

      <section className="coach-report-card">
        <span className="panel-eyebrow">Reflexion</span>
        <dl className="ai-reflection">
          <div>
            <dt>Incertidumbre principal</dt>
            <dd>{advice.reflection.mainUncertainty}</dd>
          </div>
          <div>
            <dt>Informacion faltante</dt>
            <dd>{advice.reflection.missingInformation}</dd>
          </div>
          <div>
            <dt>Interpretacion alternativa</dt>
            <dd>{advice.reflection.alternativeInterpretation}</dd>
          </div>
        </dl>
      </section>
      </details>
    </section>
  );
}

function ShortCoachSummary({
  modeLabel,
  hypothesis,
  supportingEvidence,
  missingValidation,
  primaryAction,
  nextStep,
  confidence,
}: {
  modeLabel: string;
  hypothesis: string;
  supportingEvidence: string;
  missingValidation: string;
  primaryAction: string;
  nextStep: string;
  confidence: number;
}) {
  return (
    <section className="coach-report-card coach-short-summary">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Respuesta corta</span>
          <h3>{modeLabel}</h3>
        </div>
        <ConfidenceBadge confidence={confidence} compact />
      </div>
      <div className="short-summary-grid">
        <SummaryItem label={modeLabel} value={hypothesis} strong />
        <SummaryItem label="Que lo sostiene" value={supportingEvidence} />
        <SummaryItem label="Que falta validar" value={missingValidation} />
        <SummaryItem label="Accion primaria" value={primaryAction} />
        <SummaryItem label="Siguiente paso" value={nextStep} />
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <article className={`short-summary-item ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </article>
  );
}

function KnowledgeGapPanel({
  advice,
  evidenceItems,
}: {
  advice: CoachMatchAdvice;
  evidenceItems: EvidenceViewModel[];
}) {
  const currentEvidence = evidenceItems.filter((item) => item.bucket === "current");
  const previousMemory = evidenceItems.filter((item) => item.bucket === "memory");
  const contextSources = evidenceItems.filter((item) => item.bucket === "context");
  const confidencePercent = Math.round(advice.reflection.confidence * 100);
  const confidenceTone =
    confidencePercent >= 75 ? "ok" : confidencePercent >= 55 ? "medium" : "warn";
  const limitations = [
    advice.reflection.missingInformation,
    advice.reflection.mainUncertainty,
  ].filter((item) => item.trim().length > 0);

  if (!currentEvidence.length) {
    limitations.unshift(
      "No hay evidencia actual citada; la lectura depende mas de contexto, memoria o principios que de hechos marcados en esta consulta.",
    );
  }

  if (!evidenceItems.length) {
    limitations.unshift(
      "El agente no devolvio fuentes citadas para esta respuesta.",
    );
  }

  return (
    <section className="coach-report-card trust-panel">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Confianza operativa</span>
          <h4>Que sostiene la lectura y que falta validar</h4>
        </div>
        <ConfidenceBadge confidence={advice.reflection.confidence} compact />
      </div>
      <div className={`confidence-meter ${confidenceTone}`}>
        <span style={{ width: `${confidencePercent}%` }} />
      </div>
      <div className="trust-columns">
        <article className="trust-card positive">
          <span>Que sabe</span>
          <ul>
            <li>
              {currentEvidence.length} fuente(s) actuales del caso citadas.
            </li>
            <li>{previousMemory.length} antecedente(s) de memoria/reporte.</li>
            <li>{contextSources.length} principio(s) tacticos como contexto.</li>
          </ul>
        </article>
        <article className="trust-card warning">
          <span>Que no sabe</span>
          <ul>
            {limitations.map((limitation, index) => (
              <li key={`${index}-${limitation}`}>{limitation}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function buildDiagnosisPitchOverlays(advice: CoachMatchAdvice) {
  const text = normalizeText(
    [
      advice.tacticalReading,
      advice.probableCause,
      advice.mainAdjustment,
      advice.saturdayFocus,
    ].join(" "),
  );
  const overlays = [];

  if (text.includes("banda")) {
    overlays.push({
      type: "zone" as const,
      x: 58,
      y: text.includes("derecha") ? 42 : 7,
      w: 30,
      h: 15,
      tone: "warn" as const,
      label: "banda",
    });
  }
  if (text.includes("lineas") || text.includes("bloque")) {
    overlays.push({
      type: "zone" as const,
      x: 34,
      y: 22,
      w: 26,
      h: 20,
      tone: "danger" as const,
      label: "entre lineas",
    });
    overlays.push({
      type: "blockHeight" as const,
      x: text.includes("alto") ? 68 : 46,
      tone: text.includes("alto") ? ("warn" as const) : ("info" as const),
      label: "altura bloque",
    });
  }
  if (text.includes("9") || text.includes("delanter")) {
    overlays.push({
      type: "zone" as const,
      x: 72,
      y: 25,
      w: 15,
      h: 14,
      tone: "warn" as const,
      label: "9 aislado",
    });
  }
  if (text.includes("salida") || text.includes("pivote")) {
    overlays.push({
      type: "zone" as const,
      x: 15,
      y: 22,
      w: 25,
      h: 20,
      tone: "info" as const,
      label: "salida",
    });
  }
  if (!overlays.length) {
    overlays.push({
      type: "zone" as const,
      x: 38,
      y: 18,
      w: 24,
      h: 28,
      tone: "info" as const,
      label: "zona a validar",
    });
  }

  return overlays;
}

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceViewModel[] }) {
  const currentEvidence = evidenceItems.filter((item) => item.bucket === "current");
  const previousMemory = evidenceItems.filter((item) => item.bucket === "memory");
  const contextSources = evidenceItems.filter((item) => item.bucket === "context");
  const supportLabel = currentEvidence.length
    ? "Con evidencia del caso"
    : previousMemory.length
      ? "Sin evidencia actual: usa antecedentes"
      : contextSources.length
        ? "Solo contexto tactico"
        : "Sin citas";

  return (
    <section className="coach-report-card evidence-panel">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Evidencia y trazabilidad</span>
          <h4>Apoyado en</h4>
        </div>
        <span className="ai-context-chip">{supportLabel}</span>
      </div>
      <div className="evidence-summary-row" aria-label="Resumen de fuentes">
        <span>Actual: {currentEvidence.length}</span>
        <span>Memoria/reportes: {previousMemory.length}</span>
        <span>Knowledge: {contextSources.length}</span>
        <span>Total: {evidenceItems.length}</span>
      </div>
      <EvidenceBar
        current={currentEvidence.length}
        memory={previousMemory.length}
        context={contextSources.length}
      />
      {!currentEvidence.length && evidenceItems.length ? (
        <div className="ai-evidence-empty small">
          No hay citas de observaciones actuales. La respuesta debe leerse como
          hipotesis apoyada en memoria, reportes previos o conocimiento tactico.
        </div>
      ) : null}
      {evidenceItems.length ? (
        <div className="evidence-groups">
          <EvidenceGroup
            title="Evidencia actual del caso"
            description="Observaciones manuales o datos actuales citados por el Coach."
            items={currentEvidence}
          />
          <EvidenceGroup
            title="Memoria previa / reportes"
            description="Antecedentes utiles, pero no conclusiones automaticas."
            items={previousMemory}
          />
          <EvidenceGroup
            title="Contexto tactico"
            description="Principios de juego usados como marco de lectura."
            items={contextSources}
          />
        </div>
      ) : (
        <div className="ai-evidence-empty">
          No hay fuentes citadas en esta respuesta. Tomala como una lectura
          preliminar y cargale mas notas, tags o reportes para subir la
          confianza.
        </div>
      )}
    </section>
  );
}

function ConfidenceBadge({
  confidence,
  compact,
}: {
  confidence: number;
  compact?: boolean;
}) {
  const percent = Math.round(confidence * 100);
  const tone = percent >= 75 ? "ok" : percent >= 55 ? "medium" : "warn";

  if (compact) {
    return (
      <span className={`confidence-chip ${tone}`}>
        {percent}% confianza
      </span>
    );
  }

  return (
    <div className="confidence-badge">
      <span>Confianza</span>
      <b>{percent}%</b>
      <small>{confidenceLabel(tone)}</small>
    </div>
  );
}

function EvidenceBar({
  current,
  memory,
  context,
}: {
  current: number;
  memory: number;
  context: number;
}) {
  const total = Math.max(1, current + memory + context);
  return (
    <div
      className="confidence-meter"
      title="Distribucion de evidencia"
      style={{ display: "flex", marginBottom: 12 }}
    >
      <span
        style={{
          background: "var(--accent)",
          width: `${(current / total) * 100}%`,
        }}
      />
      <span
        style={{
          background: "var(--warn)",
          width: `${(memory / total) * 100}%`,
        }}
      />
      <span
        style={{
          background: "color-mix(in oklch,var(--text) 35%,transparent)",
          width: `${(context / total) * 100}%`,
        }}
      />
    </div>
  );
}

function PatternCard({ pattern }: { pattern: TeamPattern }) {
  return (
    <div className="ai-mini-item">
      <b>{patternKindLabel(pattern.kind)}</b>
      <small>
        {pattern.domain} - {pattern.confidence}
      </small>
      <p>{pattern.statement}</p>
      {pattern.evidence.length ? (
        <small>Apoyado en: {pattern.evidence.slice(0, 2).join(" / ")}</small>
      ) : null}
    </div>
  );
}

function confidenceLabel(tone: "ok" | "medium" | "warn") {
  if (tone === "ok") return "usable";
  if (tone === "medium") return "con cautela";
  return "limitada";
}

function buildModeSupportState({
  advice,
  responseMode,
  currentEvidence,
  totalEvidence,
}: {
  advice: CoachMatchAdvice;
  responseMode: CoachResponse["mode"] | null;
  currentEvidence: number;
  totalEvidence: number;
}) {
  const uncertainty = advice.reflection.mainUncertainty.toLowerCase();

  if (responseMode !== "hypothesis") {
    return { pill: null, note: null };
  }

  if (uncertainty.includes("derivando de fase")) {
    return {
      pill: "degradado por fase",
      note:
        "Se muestra como hipotesis porque la lectura puede estar yendose de fase respecto del problema pedido.",
    };
  }

  if (uncertainty.includes("sin evidencia actual") || uncertainty.includes("usar como hipotesis")) {
    return {
      pill: "sin evidencia actual",
      note:
        "Se muestra como hipotesis porque hoy se apoya mas en contexto, memoria o conocimiento que en evidencia actual del caso.",
    };
  }

  if (uncertainty.includes("memoria o principios tacticos")) {
    return {
      pill: "apoyo historico",
      note:
        "Se mantiene en hipotesis porque la salida descansa sobre todo en memoria o principios tacticos, no en evidencia actual del caso.",
    };
  }

  if (uncertainty.includes("no hay citas validas") || totalEvidence === 0) {
    return {
      pill: "sin citas validas",
      note:
        "Se muestra como hipotesis porque no hay citas validas suficientes para sostener un diagnostico cerrado.",
    };
  }

  if (currentEvidence === 0) {
    return {
      pill: "evidencia limitada",
      note:
        "Se mantiene en hipotesis porque la evidencia actual del caso todavia es limitada.",
    };
  }

  return {
    pill: "lectura provisional",
    note:
      "La salida queda en hipotesis hasta que la evidencia del caso permita sostener un diagnostico mas firme.",
  };
}

function EvidenceGroup({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: EvidenceViewModel[];
}) {
  return (
    <div className="evidence-group">
      <div className="evidence-group-head">
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        <div className="ai-evidence-list">
          {items.map((item) => (
            <EvidenceCard
              item={item}
              key={`${item.citation.sourceType}-${item.citation.sourceId}`}
            />
          ))}
        </div>
      ) : (
        <p className="ai-evidence-empty small">
          Sin fuentes en esta categoria.
        </p>
      )}
    </div>
  );
}

function EvidenceCard({ item }: { item: EvidenceViewModel }) {
  return (
    <article className={`ai-evidence-item ${item.bucket}`}>
      <div className="evidence-card-head">
        <span>{item.sourceLabel}</span>
        <b>{Math.round(item.relevance * 100)}%</b>
      </div>
      <strong>{item.citation.title}</strong>
      <div className="evidence-meta">
        <small>{item.modeLabel}</small>
        {item.date ? <small>{item.date}</small> : null}
        {item.opponent ? <small>vs {item.opponent}</small> : null}
        {item.score ? <small className="score-pill">{item.score}</small> : null}
      </div>
      <p>{item.citation.excerpt}</p>
      <div className="evidence-score" aria-label="Relevancia">
        <span style={{ width: `${Math.round(item.relevance * 100)}%` }} />
      </div>
    </article>
  );
}

function CoachFeedbackPanel({
  advice,
  prompt,
  responseMode,
}: {
  advice: CoachMatchAdvice;
  prompt: string;
  responseMode: CoachResponse["mode"] | null;
}) {
  const [savedRating, setSavedRating] = useState<CoachFeedbackRating | null>(null);
  const ratings: Array<{ rating: CoachFeedbackRating; label: string }> = [
    { rating: "useful", label: "Util" },
    { rating: "weak", label: "Flojo" },
    { rating: "invented", label: "Invento" },
    { rating: "missingEvidence", label: "Falta evidencia" },
    { rating: "goodExercise", label: "Buen ejercicio" },
  ];

  function submit(rating: CoachFeedbackRating) {
    const saved = saveCoachFeedback({
      rating,
      prompt,
      responseMode,
      evidenceStrength: undefined,
      confidence: advice.reflection.confidence,
      citationCount: advice.evidenceCitations.length,
    });
    if (saved) setSavedRating(rating);
  }

  return (
    <section className="coach-report-card coach-feedback-panel">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Feedback del staff</span>
          <h4>Calificar respuesta</h4>
        </div>
        {savedRating ? <span className="ai-context-chip">Guardado</span> : null}
      </div>
      <div className="toolbar compact">
        {ratings.map((item) => (
          <button
            type="button"
            className={savedRating === item.rating ? "primary" : "secondary"}
            key={item.rating}
            onClick={() => submit(item.rating)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ActionPanel({
  actionGroups,
  directActions,
  actionStatus,
  runAction,
}: {
  actionGroups: Array<{ exercise: Exercise; actions: CoachAction[] }>;
  directActions: CoachAction[];
  actionStatus: string | null;
  runAction: (action: CoachAction, exercise?: Exercise) => void;
}) {
  if (!actionGroups.length && !directActions.length) return null;

  return (
    <section className="coach-report-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Acciones</span>
          <h4>Botones ejecutables</h4>
        </div>
        <span className="ai-context-chip">
          {actionGroups.length + directActions.length} disponibles
        </span>
      </div>
      {actionStatus ? <p className="success-text">{actionStatus}</p> : null}
      {actionGroups.map(({ exercise, actions }) => (
        <div className="ai-action-group" key={exercise.id}>
          <div>
            <strong>{exercise.title}</strong>
            <small>
              {exercise.phase} - {exercise.principle}
            </small>
          </div>
          <div className="toolbar compact">
            {actions.map((action) => (
              <button
                type="button"
                className="secondary"
                key={`${exercise.id}-${action.type}`}
                onClick={() => runAction(action, exercise)}
              >
                {action.label ?? labelForAction(action.type)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="toolbar compact" style={{ marginTop: 10 }}>
        {directActions.map((action, index) => (
          <button
            type="button"
            className="secondary"
            key={`${action.type}-${action.lineupId ?? action.shapeId ?? index}`}
            disabled={
              action.type === "createSessionFromDiagnosis"
                ? false
                : action.type === "applyLineup"
                  ? !action.lineupId
                  : !action.shapeId
            }
            onClick={() => runAction(action)}
          >
            {action.label ?? labelForAction(action.type)}
          </button>
        ))}
      </div>
    </section>
  );
}

function buildAdviceActionGroups(
  advice: CoachMatchAdvice,
  exercises: Exercise[],
) {
  const linked = [
    ...advice.linkedExercises,
    ...advice.actions
      .map((action) => action.exerciseId)
      .filter((id): id is string => Boolean(id)),
  ];
  const uniqueExercises = [...new Set(linked)]
    .map((target) => resolveExerciseTarget(target, exercises))
    .filter((exercise): exercise is Exercise => Boolean(exercise));

  return uniqueExercises.map((exercise) => ({
    exercise,
    actions: [
      {
        type: "openExercise",
        label: "Abrir relacionado",
        exerciseId: exercise.id,
      },
      {
        type: "addToSession",
        label: "Agregar a sesion",
        exerciseId: exercise.id,
      },
      {
        type: "createExerciseVariant",
        label: "Crear en Mis ejercicios",
        exerciseId: exercise.id,
        title:
          advice.actions.find(
            (action) =>
              action.type === "createExerciseVariant" &&
              action.exerciseId === exercise.id,
          )?.title ?? `${exercise.title} - propuesta IA`,
        rationale: advice.mainAdjustment,
      },
    ] satisfies CoachAction[],
  }));
}

function resolveExerciseTarget(target: string, exercises: Exercise[]) {
  const normalizedTarget = normalizeText(target);
  return (
    exercises.find((exercise) => exercise.id === target) ??
    exercises.find(
      (exercise) => normalizeText(exercise.title) === normalizedTarget,
    ) ??
    exercises.find((exercise) =>
      normalizeText(exercise.title).includes(normalizedTarget),
    )
  );
}

async function requestAgentStatus(): Promise<AgentStatus> {
  const response = await fetch("/api/agent-status");
  const payload = (await response.json().catch(() => null)) as
    | AgentStatus
    | { error?: string }
    | null;

  if (!response.ok || !payload || "error" in payload) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "No se pudo leer el estado del agente.",
    );
  }

  const statusPayload = payload as AgentStatus;

  if (typeof statusPayload.ok !== "boolean") {
    throw new Error("El estado del agente llego con un formato invalido.");
  }

  return statusPayload;
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ai-metric-pill">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function StatusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className={`ai-status-line ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ai-context-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ReportBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <p>{value}</p>
    </section>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  const uniqueItems = uniqueDisplayItems(items);
  if (!uniqueItems.length) return null;

  return (
    <section className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <ul>
        {uniqueItems.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function uniqueDisplayItems(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = normalizeText(item);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function ProblemBreakdownPanel({ advice }: { advice: CoachMatchAdvice }) {
  const rows = [
    ["Zona", advice.problemBreakdown.zone],
    ["Momento", advice.problemBreakdown.moment],
    ["Gatillo", advice.problemBreakdown.trigger],
    ["Propio / rival", advice.problemBreakdown.ownVsRival],
  ];

  return (
    <section className="coach-report-card">
      <span className="panel-eyebrow">Desglose del problema</span>
      <div className="problem-breakdown-grid">
        {rows.map(([label, value]) => (
          <div className="problem-breakdown-item" key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlternativeAdjustmentsPanel({ advice }: { advice: CoachMatchAdvice }) {
  if (!advice.alternativeAdjustments.length) return null;

  return (
    <section className="coach-report-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Caminos alternativos</span>
          <h4>Opciones con costo</h4>
        </div>
        <span className="ai-context-chip">
          {advice.alternativeAdjustments.length} alternativas
        </span>
      </div>
      <div className="alternative-adjustment-grid">
        {advice.alternativeAdjustments.map((item, index) => (
          <article className="alternative-adjustment-card" key={item.adjustment}>
            <span className="mono">{String(index + 1).padStart(2, "0")}</span>
            <b>{item.adjustment}</b>
            <small>Usalo cuando: {item.whenToUse}</small>
            <p>Costo: {item.tradeoff}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ModelContrastPanel({ advice }: { advice: CoachMatchAdvice }) {
  const aligned = advice.modelContrast.aligned;
  const contradictions = advice.modelContrast.contradictions;
  const insufficient = advice.modelContrast.insufficientEvidence;

  if (!aligned.length && !contradictions.length && !insufficient.length) {
    return null;
  }

  return (
    <section className="coach-report-card">
      <span className="panel-eyebrow">Contraste vs modelo de juego</span>
      <div className="trust-columns">
        <article className="trust-card positive">
          <span>Confirma identidad</span>
          <ul>
            {(aligned.length ? aligned : ["Sin confirmaciones claras."]).map(
              (item) => (
                <li key={`aligned-${item}`}>{item}</li>
              ),
            )}
          </ul>
        </article>
        <article className="trust-card warning">
          <span>Desvios / evidencia faltante</span>
          <ul>
            {[...contradictions, ...insufficient].map((item) => (
              <li key={`model-gap-${item}`}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function DiagnosisSessionPanel({ plan }: { plan: ReturnType<typeof buildSessionPlanFromDiagnosis> }) {
  if (!plan.exerciseIds.length) return null;

  return (
    <section className="coach-report-card">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Diagnostico a sesion</span>
          <h4>Bloque entrenable sugerido</h4>
        </div>
        <span className="ai-context-chip">
          {plan.estimatedDuration}' / carga {plan.estimatedLoad}
        </span>
      </div>
      <p>{plan.tacticalObjective}</p>
      <div className="coach-report-grid">
        <ReportList title="Coaching points" items={plan.coachingPoints.slice(0, 4)} />
        <ReportList title="Senales sabado" items={plan.saturdaySignals.slice(0, 4)} />
      </div>
    </section>
  );
}

function EmptyState({
  context,
  weeklyDecisionThread,
}: {
  context: CockpitContext;
  weeklyDecisionThread: ReturnType<typeof useAppStore.getState>["weeklyDecisionThread"];
}) {
  return (
    <section className="coach-report empty-coach-state">
      <span className="panel-eyebrow">Sin consulta activa</span>
      <h3>El cockpit ya tiene contexto cargado</h3>
      <p>
        Cuando consultes, la respuesta va a mostrar lectura, evidencia usada,
        acciones posibles y nivel de confianza.
      </p>
      <div className="ai-empty-grid">
        <ContextRow label="Equipo" value={context.teamModel} />
        <ContextRow label="Shape" value={context.activeShape} />
        <ContextRow
          label="Reportes recientes"
          value={String(context.recentReports.length)}
        />
        <ContextRow
          label="Memoria validada"
          value={String(context.acceptedMemory.length)}
        />
      </div>
      {weeklyDecisionThread ? (
        <div className="ai-card" style={{ marginTop: 14 }}>
          <b>Hilo semanal activo</b>
          <p>{weeklyDecisionThread.problem}</p>
          <div className="ai-empty-grid">
            <ContextRow
              label="Modo"
              value={
                weeklyDecisionThread.mode === "diagnosis"
                  ? "Diagnostico"
                  : "Hipotesis"
              }
            />
            <ContextRow
              label="Evidencia actual"
              value={String(weeklyDecisionThread.evidenceIds.length)}
            />
            <ContextRow
              label="Revision"
              value={weeklyDecisionThread.nextReviewCriteria[0] ?? "A definir"}
            />
            <ContextRow label="Estado" value={weeklyDecisionThread.status} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function labelForAction(type: CoachAction["type"]) {
  const labels: Record<CoachAction["type"], string> = {
    openExercise: "Abrir relacionado",
    addToSession: "Agregar a sesion",
    createExerciseVariant: "Crear en Mis ejercicios",
    applyLineup: "Aplicar XI / lineup",
    applyShape: "Aplicar shape en Lab 3D",
    createExerciseFromShape: "Crear ejercicio desde shape",
    createSessionFromDiagnosis: "Crear sesion desde diagnostico",
  };
  return labels[type];
}

function labelForSourceType(
  sourceType: CoachMatchAdvice["evidenceCitations"][number]["sourceType"],
) {
  const labels: Record<
    CoachMatchAdvice["evidenceCitations"][number]["sourceType"],
    string
  > = {
    knowledge: "Principio",
    memory: "Memoria",
    observation: "Observacion",
    report: "Reporte",
    video: "Video",
  };
  return labels[sourceType];
}

function isManualObservationCitation(citation: CoachEvidenceCitation) {
  return (
    citation.sourceType === "observation" &&
    (citation.sourceId.startsWith("manual-observation") ||
      normalizeText(citation.title).includes("observacion manual") ||
      normalizeText(citation.excerpt).includes("observacion manual"))
  );
}

function buildEvidenceViewModel(
  citations: CoachEvidenceCitation[],
): EvidenceViewModel[] {
  return citations.map((citation) => {
    const meta = extractEvidenceMeta(
      `${citation.sourceId} ${citation.title} ${citation.excerpt}`,
    );
    return {
      citation,
      bucket: bucketForCitation(citation),
      sourceLabel: labelForSourceType(citation.sourceType),
      modeLabel: modeLabelForCitation(citation),
      date: meta.date,
      opponent: meta.opponent,
      score: meta.score,
      relevance: Math.max(0, Math.min(1, citation.relevance ?? 0.65)),
    };
  });
}

function bucketForCitation(citation: CoachEvidenceCitation): EvidenceBucket {
  if (citation.sourceType === "observation" || citation.sourceType === "video") {
    return "current";
  }
  if (citation.sourceType === "memory" || citation.sourceType === "report") {
    return "memory";
  }
  return "context";
}

function modeLabelForCitation(citation: CoachEvidenceCitation) {
  if (isManualObservationCitation(citation)) {
    return "Observacion manual del staff"
  }
  const labels: Record<CoachEvidenceCitation["sourceType"], string> = {
    observation: "Confirmado por evidencia actual",
    video: "Confirmado por video/timestamp",
    memory: "Usado como memoria previa",
    report: "Usado como reporte previo",
    knowledge: "Usado como contexto tactico",
  };
  return labels[citation.sourceType];
}

function extractEvidenceMeta(text: string) {
  const date = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const altDate = text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/)?.[0];
  const score = text.match(/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/)?.[0];
  const opponentMatch = text.match(
    /(?:vs|contra)\s+([^|()\-.,;]+(?:\s+[^|()\-.,;]+)?)/i,
  );
  const opponent = opponentMatch?.[1]?.trim();

  return {
    date: date ?? altDate,
    opponent,
    score: score?.replace(/\s/g, ""),
  };
}

function memoryCategoryLabel(category: MemoryCandidate["category"]) {
  const labels: Record<MemoryCandidate["category"], string> = {
    teamPattern: "Patron del equipo",
    playerPattern: "Patron de jugador",
    opponentPattern: "Patron rival",
    staffPrinciple: "Principio del staff",
    sideAsymmetry: "Asimetria por banda",
  };
  return labels[category];
}

function patternKindLabel(kind: TeamPattern["kind"]) {
  const labels: Record<TeamPattern["kind"], string> = {
    repeatedProblem: "Problema repetido",
    newProblem: "Problema nuevo",
    improvement: "Mejora posible",
    regression: "Retroceso posible",
    problemNotTrained: "Problema no entrenado",
    gameModelContradiction: "Contradice modelo",
  };
  return labels[kind];
}

function labelForLastRun(lastRun: LastRunState, loading: boolean) {
  if (loading || lastRun.state === "running") return "Analizando";
  if (lastRun.state === "success") return `OK ${formatClock(lastRun.at)}`;
  if (lastRun.state === "error") return `Error ${formatClock(lastRun.at)}`;
  return "Sin consultas";
}

function humanizeAgentError(message: string) {
  const normalized = normalizeText(message);
  if (normalized.includes("missing openrouter_api_key")) {
    return "Falta configurar la key server-side. La app puede abrir, pero el Coach no puede responder.";
  }
  if (
    normalized.includes("no devolvio choices") ||
    normalized.includes("rate limit") ||
    normalized.includes("sin credito") ||
    normalized.includes("model")
  ) {
    return "El modelo no devolvio una respuesta util. Reintenta o cambia a un modelo rapido y pago para testing.";
  }
  return message;
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
