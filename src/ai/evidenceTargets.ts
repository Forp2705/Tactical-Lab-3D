import type { EvidenceTarget } from "./CoachSchemas.js";

const TARGET_RULES: Array<{ target: EvidenceTarget; patterns: RegExp[] }> = [
  {
    target: "cause",
    patterns: [
      /\bcausa\b/i,
      /\bpor que\b/i,
      /\bse debe\b/i,
      /\bnace\b/i,
      /\borigen\b/i,
      /\bfalla\b/i,
      /\bsin apoyo\b/i,
      /\bqueda solo\b/i,
    ],
  },
  {
    target: "zone",
    patterns: [
      /\bzona\b/i,
      /\bcarril\b/i,
      /\bbanda\b/i,
      /\bpor dentro\b/i,
      /\bcentral\b/i,
      /\bespalda\b/i,
      /\barea\b/i,
      /\bmedio\b/i,
    ],
  },
  {
    target: "trigger",
    patterns: [
      /\bgatillo\b/i,
      /\btrigger\b/i,
      /\bcuando\b/i,
      /\btras perdida\b/i,
      /\bpase atras\b/i,
      /\bcontrol\b/i,
      /\bsalto\b/i,
    ],
  },
  {
    target: "frequency",
    patterns: [
      /\bpatron\b/i,
      /\brepite\b/i,
      /\bfrecuencia\b/i,
      /\bvarias\b/i,
      /\brecurrente\b/i,
      /\bminutos\b/i,
    ],
  },
  {
    target: "ownTeam",
    patterns: [
      /\bnuestro\b/i,
      /\bpropio\b/i,
      /\bequipo\b/i,
      /\bvolantes\b/i,
      /\bdefensa\b/i,
      /\bpivote\b/i,
      /\blateral\b/i,
    ],
  },
  {
    target: "rival",
    patterns: [
      /\brival\b/i,
      /\boponente\b/i,
      /\bpresiona\b/i,
      /\bataca\b/i,
      /\bcontra\b/i,
      /\bvs\b/i,
    ],
  },
  {
    target: "phase",
    patterns: [
      /\bsalida\b/i,
      /\bpresion\b/i,
      /\btransicion\b/i,
      /\bbloque\b/i,
      /\bataque\b/i,
      /\babp\b/i,
      /\bpelota parada\b/i,
    ],
  },
  {
    target: "moment",
    patterns: [
      /\bprimer tiempo\b/i,
      /\bsegundo tiempo\b/i,
      /\bminuto\b/i,
      /\b\d{1,2}:\d{2}\b/i,
      /\b\d{1,2}'\b/i,
      /\btramo\b/i,
    ],
  },
  {
    target: "playerProfile",
    patterns: [
      /\bperfil\b/i,
      /\bjugador\b/i,
      /\b9\b/i,
      /\b5\b/i,
      /\bcentral\b/i,
      /\bvelocidad\b/i,
      /\bduelo\b/i,
    ],
  },
  {
    target: "risk",
    patterns: [
      /\briesgo\b/i,
      /\bexpone\b/i,
      /\btradeoff\b/i,
      /\bcontraataque\b/i,
      /\bespacio\b/i,
    ],
  },
  {
    target: "matchContext",
    patterns: [
      /\bpartido\b/i,
      /\breporte\b/i,
      /\bvideo\b/i,
      /\btag\b/i,
      /\btrack\b/i,
      /\bvs\b/i,
      /\bresultado\b/i,
    ],
  },
];

export function inferEvidenceTargets(text: string): EvidenceTarget[] {
  const targets = TARGET_RULES
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(text)))
    .map((rule) => rule.target);

  return [...new Set(targets)];
}
