function clamp(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function HomeProblemPaper({
  activeDiagnosis,
  objective,
  annotation,
  diaFoco,
  rivalChipLabel,
  baseFormation,
  onOpenDiagnostico,
  onOpenLecturaCompleta,
}: {
  activeDiagnosis: string;
  objective?: string;
  annotation?: string;
  diaFoco: string;
  rivalChipLabel?: string;
  baseFormation?: string;
  onOpenDiagnostico: () => void;
  onOpenLecturaCompleta: () => void;
}) {
  const isEmpty = !activeDiagnosis.trim();

  return (
    <article className="home-paper home-paper-problem" title={activeDiagnosis || undefined}>
      <span className="home-paper-tape" aria-hidden="true" />
      <span className="panel-eyebrow home-paper-eyebrow">
        PROBLEMA DE LA SEMANA
      </span>
      <h3 className="home-paper-title">
        {isEmpty ? "SIN PROBLEMA FORMULADO" : activeDiagnosis}
      </h3>
      {isEmpty ? (
        <p className="home-paper-body">
          Carga una observacion o abri Diagnostico para formular el problema
          de la semana.
        </p>
      ) : (
        <>
          {objective ? <p className="home-paper-body">{objective}</p> : null}
          {annotation ? (
            <p className="home-paper-annotation">{clamp(annotation, 48)}</p>
          ) : null}
          <div className="home-paper-chips">
            <span className="chip home-paper-chip">{diaFoco}</span>
            {rivalChipLabel ? (
              <span className="chip home-paper-chip">{rivalChipLabel}</span>
            ) : null}
            {baseFormation ? (
              <span className="chip home-paper-chip">{baseFormation}</span>
            ) : null}
          </div>
        </>
      )}
      <div className="home-paper-actions">
        <button
          type="button"
          className="home-paper-link-cta"
          onClick={onOpenDiagnostico}
        >
          Abrir diagnostico
        </button>
        <button
          type="button"
          className="home-paper-secondary-link"
          onClick={onOpenLecturaCompleta}
        >
          ver lectura completa
        </button>
      </div>
    </article>
  );
}
