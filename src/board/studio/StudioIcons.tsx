/**
 * Glifos del rail del Estudio Tactico (W27) — portados 1:1 de los paths SVG
 * de MOCKUP-NORTE.html (fidelidad visual). Puramente presentacional: sin
 * logica, sin test dedicado (ver studioToolGroups.test.ts para la cobertura
 * real, la coherencia del VOCABULARIO).
 */

const ICON_PATHS: Record<string, JSX.Element> = {
  select: (
    <path d="M3 2l9 5-4 1-2 4z" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
  ),
  move: (
    <path
      d="M8 2v12M2 8h12M8 2l-2 2m2-2l2 2M8 14l-2-2m2 2l2-2M2 8l2-2m-2 2l2 2M14 8l-2-2m2 2l-2 2"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
    />
  ),
  erase: (
    <>
      <rect x={3} y={6} width={10} height={6} rx={1} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <path d="M6 6V4a2 2 0 014 0v2" fill="none" stroke="currentColor" strokeWidth={1.3} />
    </>
  ),
  note: (
    <path d="M11 3l2 2-7 7-3 1 1-3z" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />
  ),
  pass: <path d="M2 12L12 4m0 0h-4m4 0v4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />,
  longPass: (
    <path d="M1 13C5 5 10 4 15 3m-4-1l4 1-2 4" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
  ),
  cross: (
    <path d="M2 12c4-7 8-7 12-4m-4-3l4 3-4 2" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
  ),
  switch: (
    <path
      d="M2 4h9m0 0L8 1m3 3L8 7M14 12H5m0 0l3-3m-3 3l3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
    />
  ),
  carry: (
    <>
      <path
        d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle cx={13} cy={5} r={1.6} fill="currentColor" />
    </>
  ),
  shot: <path d="M2 13L13 3m0 0h-5m5 0v5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />,
  movement: (
    <>
      <path d="M2 12L12 4" fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="3 2" strokeLinecap="round" />
      <path d="M12 4h-4m4 0v4" fill="none" stroke="currentColor" strokeWidth={1.4} />
    </>
  ),
  run: (
    <path d="M2 13C6 11 8 7 13 3m0 0h-4m4 0v4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
  ),
  support: (
    <path d="M3 12l5-3 5 3M8 9V3m0 0L5 6m3-3l3 3" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
  ),
  rotation: (
    <path d="M12 3a6 6 0 10 2 5m-2-5V1m0 2h3" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
  ),
  pressure: (
    <path d="M3 13l4-4m2-2l4-4M3 3l10 10" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
  ),
  mark: (
    <>
      <circle cx={8} cy={8} r={5.4} fill="none" stroke="currentColor" strokeWidth={1.3} strokeDasharray="3 2.4" />
      <circle cx={8} cy={8} r={1.6} fill="currentColor" />
    </>
  ),
  cover: (
    <path
      d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4z"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
    />
  ),
  recovery: <path d="M13 3L4 11m0 0h4m-4 0V7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />,
  zone: (
    <>
      <rect x={2.5} y={4} width={11} height={8} rx={1.5} fill="currentColor" opacity={0.25} />
      <rect x={2.5} y={4} width={11} height={8} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.2} />
    </>
  ),
  block: (
    <>
      <rect x={2} y={6} width={12} height={4.5} fill="none" stroke="currentColor" strokeWidth={1.3} />
      <path d="M5 6v4.5M8 6v4.5M11 6v4.5" stroke="currentColor" strokeWidth={1} />
    </>
  ),
  cone: <path d="M8 2l4 11H4z" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round" />,
  goal: (
    <>
      <path d="M3 12V5h10v7M3 12h10" fill="none" stroke="currentColor" strokeWidth={1.3} />
      <path d="M5 5v5m3-5v5m3-5v5" stroke="currentColor" strokeWidth={0.8} opacity={0.7} />
    </>
  ),
  mannequin: (
    <>
      <circle cx={8} cy={4} r={2} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <path d="M5 14v-4a3 3 0 016 0v4" fill="none" stroke="currentColor" strokeWidth={1.2} />
    </>
  ),
  ballPlace: (
    <>
      <circle cx={8} cy={8} r={5.6} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <path d="M8 5l2.6 1.9-1 3H6.4l-1-3z" fill="currentColor" />
    </>
  ),
};

export function StudioToolIcon({ id }: { id: string }) {
  const path = ICON_PATHS[id];
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true">
      {path ?? <circle cx={8} cy={8} r={2} fill="currentColor" />}
    </svg>
  );
}
