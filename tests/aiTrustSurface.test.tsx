import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEvidenceViewModel, InterviewPanel } from "../src/ai/AiView";
import type {
  ContextualQuestion,
  EvidenceAudit,
} from "../src/ai/CoachSchemas";

const interviewQuestion: ContextualQuestion = {
  id: "q-transition-1",
  category: "defensiveTransition",
  question: "Cuando pierden la pelota, donde queda parado el pivote?",
  whyItMatters: "Define si el problema es de distancia o de reaccion.",
  informationValue: "high",
  tacticalRiskReduced: "",
  expectedImpactOnDiagnosis: "high",
  evidenceTarget: "zone",
  purpose: "locateZone",
  answerKind: "shortText",
  blocksClaimIds: [],
};

const partialAudit: EvidenceAudit = {
  covered: ["ownTeam"],
  missing: [
    { target: "zone", reason: "Falta confirmar la zona donde se pierde la pelota." },
  ],
  criticalMissingCount: 1,
  evidenceStrength: "partial",
};

// zustand v5 sirve getInitialState() al render estatico, asi que el panel
// (presentacional puro) se renderiza directo con props en vez de via store.
function renderInterview() {
  return renderToStaticMarkup(
    <InterviewPanel
      questions={[interviewQuestion]}
      audit={partialAudit}
      drafts={{}}
      loading={false}
      onDraftChange={() => {}}
      onSubmit={() => {}}
      onSkip={() => {}}
    />,
  );
}

describe("W17 trust surface (region respuesta)", () => {
  it("H2: renders interview question category as an es-AR label, never the raw enum", () => {
    const markup = renderInterview();
    expect(markup).toContain("Transicion defensiva");
    expect(markup).not.toContain("defensiveTransition");
  });

  it("H3: interview evidence meter shows the enum label instead of an invented percentage", () => {
    const markup = renderInterview();
    // El valor visible del meter es el label del enum; ningun porcentaje se
    // muestra como texto (width:NN% del fill cualitativo de la barra es css,
    // no contenido).
    expect(markup).toContain("<b>Media</b>");
    expect(markup).not.toContain("%</b>");
    expect(markup).not.toContain(">58%");
  });

  it("H1: buildEvidenceViewModel keeps relevance undefined when the citation omits it", () => {
    const [item] = buildEvidenceViewModel([
      {
        sourceType: "knowledge",
        sourceId: "kno-1",
        title: "Distancias tras perdida",
        excerpt: "El bloque debe achicar antes del segundo pase.",
        evidenceTargets: [],
      },
    ]);
    expect(item.relevance).toBeUndefined();
  });

  it("H1: buildEvidenceViewModel still clamps a declared relevance", () => {
    const [item] = buildEvidenceViewModel([
      {
        sourceType: "observation",
        sourceId: "manual-observation-1",
        title: "Observacion manual",
        excerpt: "El pivote quedo lejos en tres perdidas seguidas.",
        relevance: 1.4,
        evidenceTargets: [],
      },
    ]);
    expect(item.relevance).toBe(1);
  });

  it("H6: no score/date/opponent metadata is fabricated from citation text", () => {
    const [item] = buildEvidenceViewModel([
      {
        sourceType: "report",
        sourceId: "rep-1",
        title: "Reporte vs Atletico Norte",
        excerpt: "Salimos en 4-3-3 el 2026-06-20 y el rival presiono alto.",
        evidenceTargets: [],
      },
    ]);
    expect((item as Record<string, unknown>).score).toBeUndefined();
    expect((item as Record<string, unknown>).date).toBeUndefined();
    expect((item as Record<string, unknown>).opponent).toBeUndefined();
  });
});
