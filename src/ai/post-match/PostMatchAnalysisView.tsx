import { useAppStore } from "@/state/useAppStore";
import { contrastTextWithGameModel } from "@/data/gameModel";
import { ConfidenceMeter } from "@/ui/tacticalPrimitives";
import {
  formatVideoEvidenceTime,
  getVideoEvidenceItems,
  summarizeVideoEvidence,
  videoEvidenceToTagsText,
  type VideoEvidenceItem,
  type VideoEvidenceSummary,
} from "@/video/videoEvidence";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  commitMemoryCandidates,
  listPostMatchReports,
  requestPostMatchReport,
  savePostMatchReport,
} from "./postMatchClient";
import {
  getAcceptanceCriteria,
  getOwnTeamProblems,
  humanizeEvidenceList,
  humanizeReportText,
  memoryCategoryLabel,
  memoryScopeLabel,
  subjectLabel,
} from "./reportPresentation";
import type {
  MemoryCandidate,
  PostMatchInput,
  PostMatchReport,
  PostMatchTag,
  SavedPostMatchReport,
} from "./schemas";

type FormState = {
  opponent: string;
  result: string;
  competition: string;
  date: string;
  ownSystem: string;
  opponentSystem: string;
  venue: string;
  planBeforeMatch: string;
  staffNotes: string;
  tagsText: string;
};

type PostMatchMode = "simple" | "advanced";

type SimpleFormState = {
  opponent: string;
  result: string;
  date: string;
  ownSystem: string;
  note1: string;
  note2: string;
  note3: string;
  problems: string;
  positives: string;
};

const INITIAL_FORM: FormState = {
  opponent: "",
  result: "",
  competition: "",
  date: new Date().toISOString().slice(0, 10),
  ownSystem: "4-4-2",
  opponentSystem: "",
  venue: "",
  planBeforeMatch: "",
  staffNotes: "",
  tagsText: "",
};

const INITIAL_SIMPLE_FORM: SimpleFormState = {
  opponent: "",
  result: "",
  date: new Date().toISOString().slice(0, 10),
  ownSystem: "4-4-2",
  note1: "",
  note2: "",
  note3: "",
  problems: "",
  positives: "",
};

export function PostMatchAnalysisView() {
  const videoTags = useAppStore((state) => state.tags);
  const videoTracks = useAppStore((state) => state.tracks);
  const pendingVideoEvidenceText = useAppStore(
    (state) => state.pendingPostMatchEvidenceText,
  );
  const consumePendingPostMatchEvidenceText = useAppStore(
    (state) => state.consumePendingPostMatchEvidenceText,
  );
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [mode, setMode] = useState<PostMatchMode>("simple");
  const [simpleForm, setSimpleForm] =
    useState<SimpleFormState>(INITIAL_SIMPLE_FORM);
  const [report, setReport] = useState<PostMatchReport | null>(null);
  const [lastGeneratedInput, setLastGeneratedInput] =
    useState<PostMatchInput | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(
    [],
  );
  const [staffReviewNotes, setStaffReviewNotes] = useState("");
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedPostMatchReport[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"generate" | "save" | "memory" | null>(
    null,
  );
  const parsedTags = useMemo(() => parseTags(form.tagsText), [form.tagsText]);
  const videoEvidenceItems = useMemo(
    () => getVideoEvidenceItems(videoTags, videoTracks),
    [videoTags, videoTracks],
  );
  const videoEvidenceSummary = useMemo(
    () => summarizeVideoEvidence(videoTags, videoTracks),
    [videoTags, videoTracks],
  );
  const canGenerate = Boolean(
    mode === "simple"
      ? simpleForm.opponent.trim() &&
          simpleForm.result.trim() &&
          simpleForm.ownSystem.trim() &&
          simpleHasEvidence(simpleForm)
      : form.opponent.trim() &&
          form.result.trim() &&
          form.ownSystem.trim() &&
          (form.staffNotes.trim() || parsedTags.length),
  );

  useEffect(() => {
    void refreshHistory();
  }, []);

  useEffect(() => {
    if (!pendingVideoEvidenceText) return;
    const evidenceText = consumePendingPostMatchEvidenceText();
    if (!evidenceText) return;
    setForm((current) => ({
      ...current,
      tagsText: mergeEvidenceText(current.tagsText, evidenceText),
    }));
    setStatus("Evidencia del video importada para revisar antes de generar.");
  }, [consumePendingPostMatchEvidenceText, pendingVideoEvidenceText]);

  async function refreshHistory() {
    try {
      const nextHistory = await listPostMatchReports();
      setHistory(nextHistory);
      setHistoryError(null);
    } catch (requestError) {
      setHistoryError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cargar el historial de reportes.",
      );
    }
  }

  async function generateReport() {
    if (!canGenerate || loading) return;
    setLoading("generate");
    setError(null);
    setStatus(null);

    try {
      const input =
        mode === "simple" ? buildSimpleInput(simpleForm) : buildInput(form);
      const nextReport = await requestPostMatchReport(input);
      setReport(nextReport);
      setLastGeneratedInput(input);
      setSavedReportId(null);
      setSelectedCandidateIds([]);
      setStatus("Informe generado. Revisalo antes de guardar o pasar memoria.");
    } catch (requestError) {
      setReport(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo generar el informe post-partido.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function saveReport() {
    if (!report || loading) return;
    setLoading("save");
    setError(null);
    setStatus(null);

    try {
      const saved = await savePostMatchReport(
        report,
        lastGeneratedInput ?? buildInput(form),
        {
          notes: staffReviewNotes,
          acceptedMemoryCandidateIds: [],
        },
      );
      setReport(saved.report);
      setSavedReportId(saved.id);
      setHistory((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      try {
        const { downloadPostMatchPdf } = await import("./PostMatchPdf");
        await downloadPostMatchPdf(saved.report, staffReviewNotes);
        setStatus(
          "Reporte guardado y PDF generado. La memoria todavia no se actualizo.",
        );
      } catch (pdfError) {
        console.error("Post-match PDF generation failed", pdfError);
        setStatus(
          "Reporte guardado, pero no se pudo generar el PDF. La memoria todavia no se actualizo.",
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo guardar el reporte.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function commitSelectedMemory() {
    if (!report || !savedReportId || !selectedCandidateIds.length || loading) {
      return;
    }
    setLoading("memory");
    setError(null);
    setStatus(null);

    try {
      const selectedCandidates = report.memoryCandidates
        .filter((candidate) => selectedCandidateIds.includes(candidate.id))
        .map((candidate) => ({ ...candidate, selectedByStaff: true }));
      const result = await commitMemoryCandidates({
        reportId: savedReportId,
        candidates: selectedCandidates,
      });
      setStatus(
        `Memoria actualizada: ${result.committedCount} aprendizajes guardados, ${result.skippedDuplicates} duplicados omitidos.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo actualizar la memoria.",
      );
    } finally {
      setLoading(null);
    }
  }

  function openSavedReport(saved: SavedPostMatchReport) {
    setForm(formFromSavedReport(saved));
    setMode("advanced");
    setLastGeneratedInput(saved.sourceInput ?? null);
    setReport(saved.report);
    setSavedReportId(saved.id);
    setStaffReviewNotes(saved.staffReview.notes ?? "");
    setSelectedCandidateIds(saved.staffReview.acceptedMemoryCandidateIds);
    setStatus(`Reporte ${saved.id} cargado desde historial.`);
    setError(null);
  }

  return (
    <section className="ai-layout post-match-layout">
      <div className="team-card">
        <span className="panel-eyebrow">Post Match</span>
        <h3>Analisis post-partido</h3>
        <div className="segmented-control" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={mode === "simple" ? "active" : ""}
            onClick={() => setMode("simple")}
          >
            Simple
          </button>
          <button
            type="button"
            className={mode === "advanced" ? "active" : ""}
            onClick={() => setMode("advanced")}
          >
            Avanzado
          </button>
        </div>
        {mode === "simple" ? (
          <SimplePostMatchForm form={simpleForm} setForm={setSimpleForm} />
        ) : (
          <AdvancedPostMatchForm
            form={form}
            setForm={setForm}
            videoEvidenceItems={videoEvidenceItems}
            videoEvidenceSummary={videoEvidenceSummary}
            onImportVideoEvidence={() =>
              updateField(
                setForm,
                "tagsText",
                mergeEvidenceText(
                  form.tagsText,
                  videoEvidenceToTagsText(videoTags, videoTracks),
                ),
              )
            }
          />
        )}
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={!canGenerate || Boolean(loading)}
            onClick={() => void generateReport()}
          >
            {loading === "generate" ? "Generando..." : "Generar informe"}
          </button>
          {mode === "advanced" ? (
            <button
              type="button"
              className="secondary"
              disabled={
                (!videoTags.length && !videoTracks.length) || Boolean(loading)
              }
              onClick={() =>
                updateField(
                  setForm,
                  "tagsText",
                  mergeEvidenceText(
                    form.tagsText,
                    videoEvidenceToTagsText(videoTags, videoTracks),
                  ),
                )
              }
            >
              Importar evidencia del video
            </button>
          ) : null}
        </div>
        <p className="muted-panel" style={{ marginTop: 12 }}>
          La generacion no escribe memoria. Los aprendizajes quedan como
          candidatos hasta que el staff los seleccione.
        </p>
        <div className="ai-card" style={{ marginTop: 16 }}>
          <div className="section-title">
            <b>Historial de reportes</b>
            <button
              type="button"
              className="secondary"
              onClick={() => void refreshHistory()}
            >
              Refrescar
            </button>
          </div>
          {historyError ? <p className="muted-panel">{historyError}</p> : null}
          {history.length ? (
            <div className="report-history-list">
              {history.map((saved) => (
                <button
                  type="button"
                  className="report-history-item secondary"
                  key={saved.id}
                  onClick={() => openSavedReport(saved)}
                >
                  <b>
                    {saved.report.matchContext.opponent} ·{" "}
                    {saved.report.matchContext.result}
                  </b>
                  <small>
                    {saved.report.matchContext.date ?? "sin fecha"} ·{" "}
                    {saved.report.matchContext.ownSystem}
                  </small>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted-panel">
              Todavia no hay reportes guardados en historial.
            </p>
          )}
        </div>
      </div>

      <div className="team-card ai-output">
        <span className="panel-eyebrow">Reporte estructurado</span>
        <h3>Revision del staff</h3>
        {status ? <p className="success-text">{status}</p> : null}
        {error ? (
          <div className="ai-card" role="alert">
            <b>Error</b>
            <p>{error}</p>
          </div>
        ) : null}
        {report ? (
          <ReportReview
            report={report}
            selectedCandidateIds={selectedCandidateIds}
            setSelectedCandidateIds={setSelectedCandidateIds}
            staffReviewNotes={staffReviewNotes}
            setStaffReviewNotes={setStaffReviewNotes}
            savedReportId={savedReportId}
            loading={loading}
            onSave={() => void saveReport()}
            onCommitMemory={() => void commitSelectedMemory()}
          />
        ) : (
          <div className="ai-card">
            <b>Sin informe todavia</b>
            <p>
              Carga contexto, notas o tags para generar un reporte post-partido
              validado.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SimplePostMatchForm({
  form,
  setForm,
}: {
  form: SimpleFormState;
  setForm: Dispatch<SetStateAction<SimpleFormState>>;
}) {
  return (
    <>
      <p className="muted-panel" style={{ marginBottom: 12 }}>
        Carga lo minimo para un informe corto. Si necesitás plan previo, tags o
        más contexto, pasá a modo avanzado.
      </p>
      <div className="form-grid">
        <Field
          label="Rival"
          value={form.opponent}
          onChange={(value) => updateSimpleField(setForm, "opponent", value)}
        />
        <Field
          label="Resultado"
          value={form.result}
          onChange={(value) => updateSimpleField(setForm, "result", value)}
        />
        <Field
          label="Fecha"
          type="date"
          value={form.date}
          onChange={(value) => updateSimpleField(setForm, "date", value)}
        />
        <Field
          label="Sistema propio"
          value={form.ownSystem}
          onChange={(value) => updateSimpleField(setForm, "ownSystem", value)}
        />
      </div>
      <label className="stacked-field">
        Nota principal 1
        <input
          value={form.note1}
          onChange={(event) =>
            updateSimpleField(setForm, "note1", event.target.value)
          }
          placeholder="Ej: nos costó sostener el bloque tras pérdida."
        />
      </label>
      <label className="stacked-field">
        Nota principal 2
        <input
          value={form.note2}
          onChange={(event) =>
            updateSimpleField(setForm, "note2", event.target.value)
          }
        />
      </label>
      <label className="stacked-field">
        Nota principal 3
        <input
          value={form.note3}
          onChange={(event) =>
            updateSimpleField(setForm, "note3", event.target.value)
          }
        />
      </label>
      <label className="stacked-field">
        Problemas destacados
        <textarea
          value={form.problems}
          onChange={(event) =>
            updateSimpleField(setForm, "problems", event.target.value)
          }
          placeholder="Qué problemas propios viste, sin inventar causas si no están claras."
        />
      </label>
      <label className="stacked-field">
        Aspectos positivos
        <textarea
          value={form.positives}
          onChange={(event) =>
            updateSimpleField(setForm, "positives", event.target.value)
          }
          placeholder="Qué funcionó o qué vulnerabilidad rival se aprovechó."
        />
      </label>
    </>
  );
}

function AdvancedPostMatchForm({
  form,
  setForm,
  videoEvidenceItems,
  videoEvidenceSummary,
  onImportVideoEvidence,
}: {
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  videoEvidenceItems: VideoEvidenceItem[];
  videoEvidenceSummary: VideoEvidenceSummary;
  onImportVideoEvidence: () => void;
}) {
  return (
    <>
      <div className="form-grid">
        <Field
          label="Rival"
          value={form.opponent}
          onChange={(value) => updateField(setForm, "opponent", value)}
        />
        <Field
          label="Resultado"
          value={form.result}
          onChange={(value) => updateField(setForm, "result", value)}
        />
        <Field
          label="Competencia"
          value={form.competition}
          onChange={(value) => updateField(setForm, "competition", value)}
        />
        <Field
          label="Fecha"
          type="date"
          value={form.date}
          onChange={(value) => updateField(setForm, "date", value)}
        />
        <Field
          label="Sistema propio"
          value={form.ownSystem}
          onChange={(value) => updateField(setForm, "ownSystem", value)}
        />
        <Field
          label="Sistema rival"
          value={form.opponentSystem}
          onChange={(value) => updateField(setForm, "opponentSystem", value)}
        />
      </div>
      <label className="stacked-field">
        Sede / contexto
        <input
          value={form.venue}
          onChange={(event) => updateField(setForm, "venue", event.target.value)}
        />
      </label>
      <label className="stacked-field">
        Plan previo
        <textarea
          value={form.planBeforeMatch}
          onChange={(event) =>
            updateField(setForm, "planBeforeMatch", event.target.value)
          }
          placeholder="Que querian hacer antes del partido."
        />
      </label>
      <label className="stacked-field">
        Notas del staff
        <textarea
          value={form.staffNotes}
          onChange={(event) =>
            updateField(setForm, "staffNotes", event.target.value)
          }
          placeholder="Lectura del cuerpo tecnico, dudas, problemas, cosas positivas y contexto."
        />
      </label>
      <label className="stacked-field">
        Tags / evidencia
        <textarea
          value={form.tagsText}
          onChange={(event) =>
            updateField(setForm, "tagsText", event.target.value)
          }
          placeholder="Una linea por evento. Formato sugerido: 12' recuperacion alta | carril central | robo tras pase atras."
        />
      </label>
      <VideoEvidenceImportPanel
        items={videoEvidenceItems}
        summary={videoEvidenceSummary}
        onImport={onImportVideoEvidence}
      />
      <p className="muted-panel" style={{ marginTop: 8 }}>
        Formato recomendado: <code>12&apos; label | zone | note</code>. El
        minuto es opcional, pero ayuda a ordenar la evidencia.
      </p>
    </>
  );
}

function ReportReview({
  report,
  selectedCandidateIds,
  setSelectedCandidateIds,
  staffReviewNotes,
  setStaffReviewNotes,
  savedReportId,
  loading,
  onSave,
  onCommitMemory,
}: {
  report: PostMatchReport;
  selectedCandidateIds: string[];
  setSelectedCandidateIds: (ids: string[]) => void;
  staffReviewNotes: string;
  setStaffReviewNotes: (notes: string) => void;
  savedReportId: string | null;
  loading: "generate" | "save" | "memory" | null;
  onSave: () => void;
  onCommitMemory: () => void;
}) {
  const ownTeamProblems = getOwnTeamProblems(report);
  const acceptanceCriteria = getAcceptanceCriteria(report);
  const gameModel = useAppStore((state) => state.gameModel);
  const modelContrast = contrastTextWithGameModel(
    [
      report.executiveSummary,
      report.matchStory,
      ...ownTeamProblems.map((item) => item.problem),
      ...report.positives,
      ...report.saturdayFocus,
    ].join(" "),
    gameModel,
  );

  return (
    <>
      <TextCard title="Resumen ejecutivo" value={report.executiveSummary} />
      <div className="ai-card">
        <b>Confianza del reporte</b>
        <ConfidenceMeter
          value={report.reflection.confidence}
          reason={report.reflection.mainUncertainty}
        />
      </div>
      {report.matchContext.interpretedResult ? (
        <TextCard
          title="Resultado interpretado"
          value={report.matchContext.interpretedResult.label}
        />
      ) : null}
      <ListCard
        title="Contexto condicionante"
        items={report.conditioningContext}
      />
      <TextCard title="Historia del partido" value={report.matchStory} />
      <EvidenceCards
        title="Fortalezas propias"
        items={report.ownStrengths}
        labelKey="strength"
      />
      <RivalVulnerabilityCards items={report.rivalVulnerabilities} />
      <OwnTeamProblemCards items={ownTeamProblems} />
      <TradeoffCards items={report.tacticalTradeoffs} />
      <FlankAsymmetryCards items={report.flankAsymmetries} />
      <PatternCards patterns={report.keyPatterns} />
      <WednesdayCards
        title="Prioridades de entrenamiento"
        tests={report.wednesdayTest}
      />
      <ModelContrastCard contrast={modelContrast} />
      <ListCard
        title="Foco para el proximo partido"
        items={report.saturdayFocus}
      />
      <details className="football-report-details">
        <summary>Ver reporte avanzado completo</summary>
      <ListCard
        title="Riesgos de sobrerreaccionar"
        items={report.risksOfOvercorrection}
      />
      <ListCard
        title="Informacion faltante"
        items={report.missingInformation}
      />
      <MemoryCandidatePicker
        candidates={report.memoryCandidates}
        selectedIds={selectedCandidateIds}
        setSelectedIds={setSelectedCandidateIds}
      />
      <ObservedRiskCards items={report.observedRisks} />
      <TacticalInferenceCards items={report.tacticalInferences} />
      <MemoryInfluenceCards items={report.memoryInfluence} />
      <ListCard
        title="Claims no sostenidos"
        items={report.grounding.unsupportedClaims}
      />
      <ListCard
        title="Alertas de atribucion"
        items={report.grounding.subjectAttributionWarnings}
      />
      <div className="ai-card">
        <b>Reflexion / confianza</b>
        <p>{humanizeReportText(report.reflection.mainUncertainty)}</p>
        <p>{humanizeReportText(report.reflection.alternativeInterpretation)}</p>
        <p>Confianza: {Math.round(report.reflection.confidence * 100)}%</p>
      </div>
      <ListCard title="Criterios de aceptacion" items={acceptanceCriteria} />
      </details>
      <label className="stacked-field">
        Revision del staff
        <textarea
          value={staffReviewNotes}
          onChange={(event) => setStaffReviewNotes(event.target.value)}
          placeholder="Correcciones, desacuerdos o validaciones antes de guardar."
        />
      </label>
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button type="button" disabled={Boolean(loading)} onClick={onSave}>
          {loading === "save" ? "Guardando..." : "Guardar reporte"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={
            !savedReportId || !selectedCandidateIds.length || Boolean(loading)
          }
          onClick={onCommitMemory}
        >
          {loading === "memory" ? "Guardando memoria..." : "Pasar a memoria"}
        </button>
      </div>
    </>
  );
}

function ModelContrastCard({
  contrast,
}: {
  contrast: ReturnType<typeof contrastTextWithGameModel>;
}) {
  const items = [
    ...contrast.aligned.map((item) => `Confirma: ${item}`),
    ...contrast.contradictions.map((item) => `Desvio: ${item}`),
    ...contrast.insufficientEvidence.map((item) => `Sin evidencia: ${item}`),
  ];

  return (
    <ListCard
      title="Contraste contra modelo de juego"
      items={items.length ? items : ["Sin evidencia suficiente para contrastar."]}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function VideoEvidenceImportPanel({
  items,
  summary,
  onImport,
}: {
  items: VideoEvidenceItem[];
  summary: VideoEvidenceSummary;
  onImport: () => void;
}) {
  return (
    <div className="video-evidence-panel post-match-evidence-panel">
      <div className="section-title">
        <div>
          <span className="panel-eyebrow">Video / Post partido / IA</span>
          <h4>Evidencia importable</h4>
        </div>
        <button type="button" disabled={!summary.total} onClick={onImport}>
          Importar al informe
        </button>
      </div>
      <div className="video-evidence-summary">
        <VideoEvidenceCount label="Total" value={summary.total} />
        <VideoEvidenceCount label="Tags" value={summary.tags} />
        <VideoEvidenceCount label="Tracks manuales" value={summary.manualTracks} />
        <VideoEvidenceCount label="Validados" value={summary.confirmedTracks} />
        <VideoEvidenceCount
          label="Asistidos"
          value={summary.assistedTracks}
          tone="low"
        />
      </div>
      {summary.assistedTracks ? (
        <p className="video-evidence-warning">
          Los tracks asistidos se mandan como evidencia de confianza baja. El
          informe debe tratarlos como apoyo, no como hecho confirmado.
        </p>
      ) : null}
      {items.length ? (
        <div className="video-evidence-preview">
          {items.slice(0, 8).map((item) => (
            <VideoEvidencePreviewItem item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="muted-panel">
          Todavia no hay tags/tracks de video para importar.
        </p>
      )}
    </div>
  );
}

function VideoEvidencePreviewItem({ item }: { item: VideoEvidenceItem }) {
  return (
    <article
      className={`video-evidence-item ${item.kind} ${item.confidence}`}
    >
      <span>{formatVideoEvidenceTime(item.time)}</span>
      <b>{item.label}</b>
      <small>
        {item.sourceLabel} - {item.confidenceLabel}
        {item.zone ? ` - ${item.zone}` : ""}
        {item.playerName ? ` - ${item.playerName}` : ""}
      </small>
      {item.note ? <small>{item.note}</small> : null}
    </article>
  );
}

function VideoEvidenceCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "low";
}) {
  return (
    <div className={`video-evidence-count ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function TextCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="ai-card">
      <b>{title}</b>
      <p>{humanizeReportText(value)}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="ai-card">
      <b>{title}</b>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{humanizeReportText(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceCards<T extends Record<string, unknown>>({
  title,
  items,
  labelKey,
  metaKey,
}: {
  title: string;
  items: T[];
  labelKey: keyof T;
  metaKey?: keyof T;
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>{title}</b>
      {items.map((item, index) => {
        const label = textValue(item[labelKey]);
        const meta = metaKey ? textValue(item[metaKey]) : "";
        const evidence = Array.isArray(item.evidence)
          ? humanizeEvidenceList(item.evidence.map((entry) => String(entry)))
          : [];

        return (
          <div className="report-subcard" key={`${title}-${index}-${label}`}>
            <strong>{meta ? `${label} · ${meta}` : label}</strong>
            <SmallList items={evidence} />
          </div>
        );
      })}
    </div>
  );
}

function RivalVulnerabilityCards({
  items,
}: {
  items: PostMatchReport["rivalVulnerabilities"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Vulnerabilidades del rival</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.vulnerability}-${index}`}>
          <strong>{humanizeReportText(item.vulnerability)}</strong>
          {item.howWeExploitedIt ? (
            <p>{humanizeReportText(item.howWeExploitedIt)}</p>
          ) : null}
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function OwnTeamProblemCards({
  items,
}: {
  items: Array<{
    problem: string;
    evidence: string[];
    severity: "low" | "medium" | "high";
    probableCause?: string;
  }>;
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Problemas propios principales</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.problem}-${index}`}>
          <strong>
            {humanizeReportText(item.problem)} - {item.severity}
          </strong>
          {item.probableCause ? (
            <p>{humanizeReportText(item.probableCause)}</p>
          ) : null}
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function TradeoffCards({
  items,
}: {
  items: PostMatchReport["tacticalTradeoffs"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Tradeoffs tacticos</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.decision}-${index}`}>
          <strong>
            {humanizeReportText(item.decision)} - {subjectLabel(item.subject)}
          </strong>
          <p>Ventaja: {humanizeReportText(item.upside)}</p>
          <p>Costo: {humanizeReportText(item.downside)}</p>
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function FlankAsymmetryCards({
  items,
}: {
  items: PostMatchReport["flankAsymmetries"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Asimetrias por banda</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.flank}-${index}`}>
          <strong>
            {item.flank} - {subjectLabel(item.subject)}
          </strong>
          <p>{humanizeReportText(item.description)}</p>
          {item.implication ? (
            <p>{humanizeReportText(item.implication)}</p>
          ) : null}
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function PatternCards({
  patterns,
}: {
  patterns: PostMatchReport["keyPatterns"];
}) {
  return (
    <div className="ai-card">
      <b>Patrones detectados</b>
      {patterns.map((item, index) => (
        <div className="report-subcard" key={`${item.pattern}-${index}`}>
          <strong>{humanizeReportText(item.pattern)}</strong>
          <p>{humanizeReportText(item.tacticalImpact)}</p>
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function ObservedRiskCards({
  items,
}: {
  items: PostMatchReport["observedRisks"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Riesgos observados</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.risk}-${index}`}>
          <strong>
            {humanizeReportText(item.risk)} - {subjectLabel(item.owner)}
          </strong>
          <SmallList items={humanizeEvidenceList(item.evidence)} />
        </div>
      ))}
    </div>
  );
}

function TacticalInferenceCards({
  items,
}: {
  items: PostMatchReport["tacticalInferences"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Inferencias tacticas</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.inference}-${index}`}>
          <strong>
            {humanizeReportText(item.inference)} - {item.confidence}
          </strong>
          <SmallList items={humanizeEvidenceList(item.basedOn)} />
        </div>
      ))}
    </div>
  );
}

function MemoryInfluenceCards({
  items,
}: {
  items: PostMatchReport["memoryInfluence"];
}) {
  if (!items.length) return null;

  return (
    <div className="ai-card">
      <b>Influencia de memoria previa</b>
      {items.map((item, index) => (
        <div className="report-subcard" key={`${item.memoryItem}-${index}`}>
          <strong>{humanizeReportText(item.memoryItem)}</strong>
          <p>
            {item.usedAs === "supportedByCurrentEvidence"
              ? "Confirmada por evidencia actual."
              : "Usada solo como contexto."}
          </p>
          <SmallList items={humanizeEvidenceList(item.currentEvidence)} />
        </div>
      ))}
    </div>
  );
}

function textValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function WednesdayCards({
  title = "Prioridades de entrenamiento",
  tests,
}: {
  title?: string;
  tests: PostMatchReport["wednesdayTest"];
}) {
  if (!tests.length) return null;

  return (
    <div className="ai-card">
      <b>{title}</b>
      {tests.map((item, index) => (
        <div className="report-subcard" key={`${item.hypothesis}-${index}`}>
          <strong>{humanizeReportText(item.hypothesis)}</strong>
          <p>{humanizeReportText(item.test)}</p>
          <SmallList items={item.successSignals.map(humanizeReportText)} />
          {item.fallbackIfFails ? (
            <p>{humanizeReportText(item.fallbackIfFails)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MemoryCandidatePicker({
  candidates,
  selectedIds,
  setSelectedIds,
}: {
  candidates: MemoryCandidate[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
}) {
  if (!candidates.length) return null;

  function toggle(candidateId: string) {
    setSelectedIds(
      selectedIds.includes(candidateId)
        ? selectedIds.filter((id) => id !== candidateId)
        : [...selectedIds, candidateId],
    );
  }

  return (
    <div className="ai-card">
      <b>Candidatos para memoria</b>
      <p className="muted-panel">
        Ninguno se guarda automaticamente. Selecciona solo aprendizajes que el
        staff valide.
      </p>
      {candidates.map((candidate) => (
        <label className="memory-candidate" key={candidate.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(candidate.id)}
            onChange={() => toggle(candidate.id)}
          />
          <span>
            <strong>{humanizeReportText(candidate.statement)}</strong>
            <small>
              {memoryCategoryLabel(candidate.category)} -{" "}
              {memoryScopeLabel(candidate.scope)} - {candidate.confidence}
            </small>
            <SmallList items={humanizeEvidenceList(candidate.evidence)} />
          </span>
        </label>
      ))}
    </div>
  );
}

function SmallList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul>
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{humanizeReportText(item)}</li>
      ))}
    </ul>
  );
}

function buildInput(form: FormState): PostMatchInput {
  return {
    matchContext: {
      opponent: form.opponent.trim(),
      result: form.result.trim(),
      competition: optionalText(form.competition),
      date: optionalText(form.date),
      ownSystem: form.ownSystem.trim(),
      opponentSystem: optionalText(form.opponentSystem),
      venue: optionalText(form.venue),
    },
    planBeforeMatch: optionalText(form.planBeforeMatch),
    staffNotes: optionalText(form.staffNotes),
    tags: parseTags(form.tagsText),
  };
}

function buildSimpleInput(form: SimpleFormState): PostMatchInput {
  const notes = [form.note1, form.note2, form.note3]
    .map((note) => note.trim())
    .filter(Boolean);
  const staffNotes = [
    "MODO SIMPLE POST-PARTIDO: generar un reporte corto, accionable y sin secciones innecesarias. Si falta evidencia, declararlo.",
    notes.length ? `Notas principales:\n- ${notes.join("\n- ")}` : "",
    optionalText(form.problems)
      ? `Problemas destacados:\n${form.problems.trim()}`
      : "",
    optionalText(form.positives)
      ? `Aspectos positivos:\n${form.positives.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    matchContext: {
      opponent: form.opponent.trim(),
      result: form.result.trim(),
      date: optionalText(form.date),
      ownSystem: form.ownSystem.trim(),
    },
    staffNotes,
    tags: [],
  };
}

function simpleHasEvidence(form: SimpleFormState) {
  return Boolean(
    form.note1.trim() ||
      form.note2.trim() ||
      form.note3.trim() ||
      form.problems.trim() ||
      form.positives.trim(),
  );
}

function parseTags(text: string): PostMatchTag[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(
        /^(\d{1,3})(?::(\d{1,2}))?(?:'|m|min)?\s*[-.,]?\s*(.*)$/i,
      );
      const minute = match
        ? Number(match[1]) + Number(match[2] ?? 0) / 60
        : undefined;
      const content = match ? match[3]?.trim() : line;
      const [labelPart, zonePart, notePart] = content
        .split("|")
        .map((part) => part.trim());

      return {
        minute,
        label: labelPart || content || line,
        zone: optionalText(zonePart),
        note: optionalText(notePart),
        severity: inferEvidenceSeverity(labelPart || content || line, notePart),
      };
    });
}

function inferEvidenceSeverity(
  label: string,
  note?: string,
): PostMatchTag["severity"] {
  const text = `${label} ${note ?? ""}`.toLowerCase();
  if (/\b(severidad|severity)\s*:?\s*(high|alta)\b/.test(text)) return "high";
  if (/\b(severidad|severity)\s*:?\s*(low|baja)\b/.test(text)) return "low";
  if (/\b(severidad|severity)\s*:?\s*(medium|media)\b/.test(text)) {
    return "medium";
  }
  if (text.includes("confirmed-track") || text.includes("validado")) {
    return "high";
  }
  if (text.includes("tracking manual")) return "high";
  if (text.includes("assist-track") || text.includes("assist-start")) {
    return "low";
  }
  if (text.includes("tracking asistido") && !text.includes("validado")) {
    return "low";
  }
  return "medium";
}

function formFromSavedReport(saved: SavedPostMatchReport): FormState {
  const source = saved.sourceInput;
  return {
    opponent: saved.report.matchContext.opponent,
    result: saved.report.matchContext.result,
    competition: saved.report.matchContext.competition ?? "",
    date: saved.report.matchContext.date ?? INITIAL_FORM.date,
    ownSystem: saved.report.matchContext.ownSystem,
    opponentSystem: saved.report.matchContext.opponentSystem ?? "",
    venue: saved.report.matchContext.venue ?? "",
    planBeforeMatch: source?.planBeforeMatch ?? "",
    staffNotes: source?.staffNotes ?? "",
    tagsText: source?.tags?.length ? stringifyTags(source.tags) : "",
  };
}

function stringifyTags(tags: PostMatchTag[]) {
  return tags
    .map((tag) => {
      const time = typeof tag.minute === "number" ? formatMinuteTag(tag.minute) : "";
      const note = [tag.note, severityNote(tag)]
        .filter(Boolean)
        .join("; ");
      const payload = [tag.label, tag.zone, note].filter(Boolean).join(" | ");
      return [time, payload].filter(Boolean).join(" ");
    })
    .join("\n");
}

function severityNote(tag: PostMatchTag) {
  if (tag.severity === "medium") return "";
  if (tag.note?.toLowerCase().includes("severidad")) return "";
  return `severidad: ${tag.severity}`;
}

function formatMinuteTag(minute: number) {
  const wholeMinutes = Math.floor(minute);
  const rawSeconds = Math.round((minute - wholeMinutes) * 60);
  const seconds = rawSeconds === 60 ? 59 : rawSeconds;
  if (!seconds) return `${wholeMinutes}'`;
  return `${wholeMinutes}:${String(seconds).padStart(2, "0")}`;
}

function mergeEvidenceText(current: string, incoming: string) {
  const existing = current.trim();
  const next = incoming.trim();
  if (!existing) return next;
  if (!next) return existing;
  const lines = new Set(
    [...existing.split(/\r?\n/), ...next.split(/\r?\n/)]
      .map((line) => line.trim())
      .filter(Boolean),
  );
  return Array.from(lines).join("\n");
}

function optionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function updateField(
  setForm: Dispatch<SetStateAction<FormState>>,
  key: keyof FormState,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function updateSimpleField(
  setForm: Dispatch<SetStateAction<SimpleFormState>>,
  key: keyof SimpleFormState,
  value: string,
) {
  setForm((current) => ({ ...current, [key]: value }));
}
