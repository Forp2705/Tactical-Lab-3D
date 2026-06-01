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
import { listPostMatchReports } from "@/ai/post-match/postMatchClient";
import {
  detectTeamPatterns,
  type TeamPattern,
} from "@/ai/patternDetection";
import type {
  MemoryCandidate,
  SavedPostMatchReport,
} from "@/ai/post-match/schemas";
import type { Exercise, Player } from "@/data";
import {
  getAllExercises,
  getExerciseById,
  useAppStore,
} from "@/state/useAppStore";
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
  const team = useAppStore((state) => state.team);
  const lineupLab = useAppStore((state) => state.lineupLab);
  const tags = useAppStore((state) => state.tags);
  const tracks = useAppStore((state) => state.tracks);
  const session = useAppStore((state) => state.session);
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
  const [reports, setReports] = useState<SavedPostMatchReport[]>([]);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<LastRunState>({ state: "idle" });

  const input = prompt.trim();
  const selectedExercise = getExerciseById(selectedExerciseId);
  const cockpitContext = useMemo(
    () =>
      buildCockpitContext({
        team,
        lineupLab,
        coachShapeContext,
        reports,
        tagsCount: tags.length,
        tracksCount: tracks.length,
        sessionBlocks: session.blocks.length,
        selectedExerciseTitle: selectedExercise?.title ?? "Sin ejercicio",
      }),
    [
      coachShapeContext,
      lineupLab,
      reports,
      selectedExercise?.title,
      session.blocks.length,
      tags.length,
      team,
      tracks.length,
    ],
  );

  useEffect(() => {
    void refreshCockpitData();
  }, []);

  async function refreshCockpitData() {
    const [statusResult, reportsResult] = await Promise.allSettled([
      requestAgentStatus(),
      listPostMatchReports(),
    ]);

    if (statusResult.status === "fulfilled") {
      setAgentStatus(statusResult.value);
      setAgentStatusError(null);
    } else {
      setAgentStatus(null);
      setAgentStatusError("No se pudo leer el estado del agente.");
    }

    if (reportsResult.status === "fulfilled") {
      setReports(reportsResult.value);
      setReportsError(null);
    } else {
      setReportsError("No se pudo cargar historial/memoria.");
    }
  }

  async function runCoachAgent(options?: {
    collectedEvidence?: CollectedAnswer[];
    skipInterview?: boolean;
  }) {
    if (!input || loading) return;
    const coachContext = buildCoachRuntimeContext(team, coachShapeContext);
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
      void refreshCockpitData();
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
            <span className="panel-eyebrow">Coach AI / Command center</span>
            <h3>Asistente tactico con contexto del club</h3>
            <p>
              Consulta el problema, revisa que evidencia usa y ejecuta acciones
              sobre visor, sesion o Lineup Lab sin salir del flujo.
            </p>
          </div>
          <div className="ai-hero-metrics" aria-label="Resumen del agente">
            <MetricPill
              label="Plantel"
              value={`${cockpitContext.availablePlayers}/${team.players.length}`}
            />
            <MetricPill label="Shapes" value={cockpitContext.shapes} />
            <MetricPill
              label="Evidencia"
              value={cockpitContext.videoTags + cockpitContext.videoTracks}
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
              onRefresh={() => void refreshCockpitData()}
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
                  disabled={!input || loading}
                  onClick={() => void runCoachAgent()}
                >
                  {loading ? "Analizando..." : "Consultar Coach AI"}
                </button>
                <span>
                  Usa plantel, Lineup Lab, reportes, memoria y evidencia de
                  video disponible.
                </span>
              </div>
              {error ? (
                <div className="ai-card ai-error-card" role="alert">
                  <b>Error del agente</b>
                  <p>{error}</p>
                </div>
              ) : null}
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
              <AdviceResult advice={advice} responseMode={responseMode} />
            ) : !coachInterview.active || !coachInterview.questions.length ? (
              <EmptyState context={cockpitContext} />
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
): CoachAgentRuntimeContext {
  const lineupLab = useAppStore.getState().lineupLab;
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const toPlayer = (player: Player) => ({
    name: player.name,
    num: player.num,
    positions: player.positions,
    status: player.status,
    profile: player.profile,
    attributes: {
      speed: player.attributes.speed,
      pass: player.attributes.pass,
      tactical: player.attributes.tactical,
      duel: player.attributes.duel,
    },
  });

  return {
    shapeContext: coachShapeContext,
    teamModel: team.model,
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

function buildCockpitContext({
  team,
  lineupLab,
  coachShapeContext,
  reports,
  tagsCount,
  tracksCount,
  sessionBlocks,
  selectedExerciseTitle,
}: {
  team: ReturnType<typeof useAppStore.getState>["team"];
  lineupLab: ReturnType<typeof useAppStore.getState>["lineupLab"];
  coachShapeContext: ReturnType<
    typeof useAppStore.getState
  >["coachShapeContext"];
  reports: SavedPostMatchReport[];
  tagsCount: number;
  tracksCount: number;
  sessionBlocks: number;
  selectedExerciseTitle: string;
}): CockpitContext {
  const recentReports = [...reports]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, 3);
  const acceptedMemory = reports.flatMap((savedReport) =>
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
  );

  return {
    availablePlayers: team.players.filter(
      (player) => player.status === "available",
    ).length,
    unavailablePlayers: team.players.filter(
      (player) => player.status !== "available",
    ).length,
    teamModel: team.model || "Modelo de equipo no definido",
    shapes: lineupLab.shapes.length,
    transitions: lineupLab.savedTransitions.length,
    activeShape:
      coachShapeContext?.selectedShapeName ??
      lineupLab.shapes[0]?.name ??
      "Sin shape activo",
    currentExercise: selectedExerciseTitle,
    sessionBlocks,
    videoTags: tagsCount,
    videoTracks: tracksCount,
    recentReports,
    acceptedMemory: acceptedMemory.slice(0, 5),
    teamPatterns: detectTeamPatterns(reports, { limit: 4 }),
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
          <h4>Conexion IA</h4>
        </div>
        <button type="button" className="secondary" onClick={onRefresh}>
          Refrescar
        </button>
      </div>
      <div className="ai-status-grid">
        <StatusLine
          label="OpenRouter"
          value={status?.openRouterConfigured ? "Configurado" : "Sin key"}
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
      {lastRun.state === "error" ? (
        <p className="muted-panel">{lastRun.message}</p>
      ) : null}
    </section>
  );
}

function ActiveContextPanel({ context }: { context: CockpitContext }) {
  return (
    <section className="ai-rail-card">
      <span className="panel-eyebrow">Contexto activo</span>
      <h4>Que va a leer el agente</h4>
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
      <h4>Ultimos partidos</h4>
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
      <h4>Aprendizajes del staff</h4>
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
      <h4>Historia del equipo</h4>
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
  return (
    <section className="coach-report interview-panel">
      <header className="coach-report-head compact">
        <div>
          <span className="panel-eyebrow">Entrevista tactica</span>
          <h3>Falta evidencia antes de diagnosticar</h3>
          <p>
            Respondé lo que puedas. Si preferís avanzar igual, el agente va a
            devolver una hipotesis con confianza limitada.
          </p>
        </div>
        <div className="confidence-badge">
          <span>Evidencia</span>
          <b>{audit ? evidenceStrengthLabel(audit.evidenceStrength) : "Baja"}</b>
        </div>
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
        <button type="button" disabled={loading} onClick={onSubmit}>
          {loading ? "Analizando..." : "Responder y continuar analisis"}
        </button>
        <button
          type="button"
          className="secondary"
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
  responseMode,
}: {
  advice: CoachMatchAdvice;
  responseMode: CoachResponse["mode"] | null;
}) {
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const lineups = useAppStore((state) => state.team.lineups);
  const shapes = useAppStore((state) => state.lineupLab.shapes);
  const actionGroups = buildAdviceActionGroups(advice);
  const evidenceItems = buildEvidenceViewModel(advice.evidenceCitations);
  const directActions = advice.actions.filter((action) => {
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
  });

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
    }
  }

  return (
    <section className="coach-report">
      <header className="coach-report-head">
        <div>
          <span className="panel-eyebrow">Informe de staff</span>
          <h3>
            {responseMode === "hypothesis"
              ? "Hipotesis del Coach AI"
              : "Lectura del Coach AI"}
          </h3>
          <p>
            Respuesta basada en contexto activo, memoria validada, reportes y
            evidencia disponible.
          </p>
        </div>
        <ConfidenceBadge confidence={advice.reflection.confidence} />
      </header>

      <article className="coach-main-read">
        <span>Lectura tactica</span>
        <p>{advice.tacticalReading}</p>
      </article>

      <KnowledgeGapPanel advice={advice} evidenceItems={evidenceItems} />

      <div className="coach-report-grid">
        <ReportBlock title="Causa probable" value={advice.probableCause} />
        <ReportBlock title="Ajuste principal" value={advice.mainAdjustment} />
      </div>

      <ReportList
        title="Instrucciones de campo"
        items={advice.onFieldInstructions}
      />

      <div className="coach-report-grid">
        <ReportBlock title="Test del miercoles" value={advice.wednesdayTest} />
        <ReportBlock title="Foco del sabado" value={advice.saturdayFocus} />
      </div>

      <div className="coach-report-grid">
        <ReportList title="Riesgos del ajuste" items={advice.adjustmentRisks} />
        <ReportList title="Senales de exito" items={advice.successSignals} />
      </div>

      <EvidencePanel evidenceItems={evidenceItems} />

      <ActionPanel
        actionGroups={actionGroups}
        directActions={directActions}
        actionStatus={actionStatus}
        runAction={runAction}
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
    </section>
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
          <h4>Que sabe / que no sabe</h4>
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
              {currentEvidence.length} fuente(s) confirmadas por evidencia
              actual.
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

function EvidencePanel({ evidenceItems }: { evidenceItems: EvidenceViewModel[] }) {
  const currentEvidence = evidenceItems.filter((item) => item.bucket === "current");
  const previousMemory = evidenceItems.filter((item) => item.bucket === "memory");
  const contextSources = evidenceItems.filter((item) => item.bucket === "context");

  return (
    <section className="coach-report-card evidence-panel">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Evidencia y trazabilidad</span>
          <h4>Apoyado en</h4>
        </div>
        <span className="ai-context-chip">{evidenceItems.length} fuentes</span>
      </div>
      <EvidenceBar
        current={currentEvidence.length}
        memory={previousMemory.length}
        context={contextSources.length}
      />
      {evidenceItems.length ? (
        <div className="evidence-groups">
          <EvidenceGroup
            title="Confirmado por evidencia actual"
            description="Observaciones o datos del caso actual."
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
              action.type === "applyLineup" ? !action.lineupId : !action.shapeId
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

function buildAdviceActionGroups(advice: CoachMatchAdvice) {
  const exercises = getAllExercises();
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
  if (!items.length) return null;

  return (
    <section className="coach-report-card">
      <span className="panel-eyebrow">{title}</span>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ context }: { context: CockpitContext }) {
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
  };
  return labels[sourceType];
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
  if (citation.sourceType === "observation") return "current";
  if (citation.sourceType === "memory" || citation.sourceType === "report") {
    return "memory";
  }
  return "context";
}

function modeLabelForCitation(citation: CoachEvidenceCitation) {
  const labels: Record<CoachEvidenceCitation["sourceType"], string> = {
    observation: "Confirmado por evidencia actual",
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
  };
  return labels[kind];
}

function labelForLastRun(lastRun: LastRunState, loading: boolean) {
  if (loading || lastRun.state === "running") return "Analizando";
  if (lastRun.state === "success") return `OK ${formatClock(lastRun.at)}`;
  if (lastRun.state === "error") return `Error ${formatClock(lastRun.at)}`;
  return "Sin consultas";
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
