import { useAppStore } from "@/state/useAppStore";
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

export function PostMatchAnalysisView() {
  const videoTags = useAppStore((state) => state.tags);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [report, setReport] = useState<PostMatchReport | null>(null);
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
  const canGenerate = Boolean(
    form.opponent.trim() &&
      form.result.trim() &&
      form.ownSystem.trim() &&
      (form.staffNotes.trim() || parsedTags.length),
  );

  useEffect(() => {
    void refreshHistory();
  }, []);

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
      const nextReport = await requestPostMatchReport(buildInput(form));
      setReport(nextReport);
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
      const saved = await savePostMatchReport(report, buildInput(form), {
        notes: staffReviewNotes,
        acceptedMemoryCandidateIds: [],
      });
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
            onChange={(event) =>
              updateField(setForm, "venue", event.target.value)
            }
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
        <p className="muted-panel" style={{ marginTop: 8 }}>
          Formato recomendado: <code>12&apos; label | zone | note</code>. El
          minuto es opcional, pero ayuda a ordenar la evidencia.
        </p>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={!canGenerate || Boolean(loading)}
            onClick={() => void generateReport()}
          >
            {loading === "generate" ? "Generando..." : "Generar informe"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!videoTags.length || Boolean(loading)}
            onClick={() =>
              updateField(setForm, "tagsText", tagsFromVideo(videoTags))
            }
          >
            Usar tags del video
          </button>
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

  return (
    <>
      <TextCard title="Resumen ejecutivo" value={report.executiveSummary} />
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
      <ListCard
        title="Foco para el proximo partido"
        items={report.saturdayFocus}
      />
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
        severity: "medium" as const,
      };
    });
}

function tagsFromVideo(tags: { label: string; time: number }[]) {
  return tags
    .map((tag) => `${formatTagTime(tag.time)} ${tag.label}`)
    .join("\n");
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
      const payload = [tag.label, tag.zone, tag.note].filter(Boolean).join(" | ");
      return [time, payload].filter(Boolean).join(" ");
    })
    .join("\n");
}

function formatTagTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatMinuteTag(minute: number) {
  const wholeMinutes = Math.floor(minute);
  const rawSeconds = Math.round((minute - wholeMinutes) * 60);
  const seconds = rawSeconds === 60 ? 59 : rawSeconds;
  if (!seconds) return `${wholeMinutes}'`;
  return `${wholeMinutes}:${String(seconds).padStart(2, "0")}`;
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
