import type { Player } from "@/data";

export type TacticalAdjustment =
  | "highBlock"
  | "lowBlock"
  | "threeCenterBacks"
  | "freeFullback"
  | "pivotRoleChange"
  | "highPress"
  | "directPlay"
  | "counterPress"
  | "protectWeakSide"
  | "supportNine";

export type PlayerFitFinding = {
  id: string;
  adjustment: TacticalAdjustment;
  level: "risk" | "warning" | "strength";
  statement: string;
  players: string[];
  evidence: string[];
};

export function analyzePlayerFit(
  players: Player[],
  adjustments: TacticalAdjustment[] = DEFAULT_ADJUSTMENTS,
): PlayerFitFinding[] {
  const available = players.filter((player) => player.status === "available");
  const findings: PlayerFitFinding[] = [];
  const centerBacks = available.filter((player) => hasAnyPosition(player, ["CB"]));
  const pivots = available.filter((player) => hasAnyPosition(player, ["CDM", "CM"]));
  const fullbacks = available.filter((player) =>
    hasAnyPosition(player, ["LB", "RB", "WB"]),
  );
  const wideAttackers = available.filter((player) =>
    hasAnyPosition(player, ["LW", "RW", "AM"]),
  );
  const nines = available.filter((player) => hasAnyPosition(player, ["ST"]));
  const interiors = available.filter((player) =>
    hasAnyPosition(player, ["CM", "CAM", "AM"]),
  );

  if (adjustments.includes("highBlock") || adjustments.includes("highPress")) {
    const slowCenterBacks = centerBacks.filter((player) =>
      profileHas(player, [
        "lento",
        "poca velocidad",
        "sufre a la espalda",
        "espalda",
        "pesado",
        "no corrige hacia atras",
      ]),
    );
    if (slowCenterBacks.length) {
      findings.push({
        id: "slow-cb-high-block",
        adjustment: "highBlock",
        level: "risk",
        statement:
          "Subir el bloque expone espalda de centrales con baja velocidad. Necesita presion real al poseedor o cobertura mas baja.",
        players: slowCenterBacks.map(labelPlayer),
        evidence: slowCenterBacks.map((player) => `perfil: ${player.profile}`),
      });
    }
  }

  if (adjustments.includes("pivotRoleChange") || adjustments.includes("highPress")) {
    const lowPassPivots = pivots.filter((player) =>
      profileHas(player, [
        "sufre de espaldas",
        "pase inseguro",
        "poca recepcion",
        "no gira",
        "limitado con pelota",
        "se complica bajo presion",
      ]),
    );
    if (lowPassPivots.length) {
      findings.push({
        id: "pivot-build-up-risk",
        adjustment: "pivotRoleChange",
        level: "warning",
        statement:
          "Salida interior condicionada: el 5/pivote no sostiene recepcion y pase bajo presion sin apoyos cercanos.",
        players: lowPassPivots.map(labelPlayer),
        evidence: lowPassPivots.map((player) => `perfil: ${player.profile}`),
      });
    }
  }

  if (adjustments.includes("freeFullback")) {
    const aggressiveFullbacks = fullbacks.filter((player) =>
      profileHas(player, ["lateral alto", "profundo", "ofensivo", "pasa mucho"]),
    );
    const lowPressWingers = wideAttackers.filter((player) =>
      profileHas(player, ["no repliega", "no vuelve", "baja intensidad", "pierde marca"]),
    );
    if (aggressiveFullbacks.length && lowPressWingers.length) {
      findings.push({
        id: "fullback-winger-2v1",
        adjustment: "freeFullback",
        level: "risk",
        statement:
          "Liberar lateral puede generar 2v1 en banda si el extremo no repliega o no tapa pase exterior.",
        players: [...aggressiveFullbacks, ...lowPressWingers].map(labelPlayer),
        evidence: [
          ...aggressiveFullbacks.map((player) => `perfil lateral: ${player.profile}`),
          ...lowPressWingers.map((player) => `perfil extremo: ${player.profile}`),
        ],
      });
    }
  }

  if (adjustments.includes("supportNine")) {
    const isolatedNines = nines.filter((player) =>
      profileHas(player, ["fija", "juega de espaldas", "descarga", "aguanta"]),
    );
    const farInteriors = interiors.filter((player) =>
      profileHas(player, ["llega tarde", "queda lejos", "poco apoyo", "no acompana"]),
    );
    if (isolatedNines.length && farInteriors.length) {
      findings.push({
        id: "nine-support-risk",
        adjustment: "supportNine",
        level: "warning",
        statement:
          "El 9 puede fijar, pero necesita interiores mas cercanos; si llegan tarde, vuelve a quedar aislado.",
        players: [...isolatedNines, ...farInteriors].map(labelPlayer),
        evidence: farInteriors.map((player) => `perfil: ${player.profile}`),
      });
    }
  }

  if (adjustments.includes("highPress") || adjustments.includes("counterPress")) {
    const lowPressCore = available.filter(
      (player) =>
        hasAnyPosition(player, ["CM", "CDM", "LW", "RW", "ST"]) &&
        profileHas(player, [
          "no presiona",
          "baja intensidad",
          "llega tarde",
          "no sostiene presion",
          "no repliega",
        ]),
    );
    if (lowPressCore.length >= 2) {
      findings.push({
        id: "press-intensity-risk",
        adjustment: "highPress",
        level: "risk",
        statement:
          "Presion alta con baja intensidad de presion en varios roles puede partir al equipo.",
        players: lowPressCore.map(labelPlayer),
        evidence: lowPressCore.map((player) => `perfil: ${player.profile}`),
      });
    }
  }

  const aerialCenterBacks = centerBacks.filter(
    (player) =>
      (player.height ?? 0) >= 185 ||
      profileHas(player, ["duelo aereo", "juego aereo", "fuerte arriba", "gana centros"]),
  );
  if (adjustments.includes("lowBlock") && aerialCenterBacks.length >= 2) {
    findings.push({
      id: "medium-block-aerial-strength",
      adjustment: "lowBlock",
      level: "strength",
      statement:
        "Bloque medio/bajo puede ser fortaleza si se protege centro y se obliga al rival a centrar.",
      players: aerialCenterBacks.map(labelPlayer),
      evidence: aerialCenterBacks.map((player) =>
        player.height ? `altura ${player.height}cm` : `perfil: ${player.profile}`,
      ),
    });
  }

  const organizer = pivots
    .filter((player) =>
      profileHas(player, ["ordena", "lectura", "primer pase", "pausa", "lidera"]),
    )[0];
  if (organizer) {
    findings.push({
      id: "tactical-pivot-strength",
      adjustment: "pivotRoleChange",
      level: "strength",
      statement:
        "Hay un mediocentro cuyo perfil puede ordenar salida, presion o reagrupamiento.",
      players: [labelPlayer(organizer)],
      evidence: [`perfil: ${organizer.profile}`],
    });
  }

  return findings;
}

export function inferAdjustmentsFromText(text: string): TacticalAdjustment[] {
  const normalized = normalize(text);
  const adjustments: TacticalAdjustment[] = [];
  if (hasAny(normalized, ["subir bloque", "bloque alto", "presion alta"])) {
    adjustments.push("highBlock", "highPress");
  }
  if (hasAny(normalized, ["bajar bloque", "bloque bajo", "replegar"])) {
    adjustments.push("lowBlock");
  }
  if (hasAny(normalized, ["tercer central", "linea de 3", "3 centrales"])) {
    adjustments.push("threeCenterBacks");
  }
  if (hasAny(normalized, ["liberar lateral", "lateral alto", "lateral ofensivo"])) {
    adjustments.push("freeFullback");
  }
  if (hasAny(normalized, ["rol del 5", "pivote", "salida interior"])) {
    adjustments.push("pivotRoleChange");
  }
  if (hasAny(normalized, ["directo", "juego directo", "segunda pelota"])) {
    adjustments.push("directPlay");
  }
  if (hasAny(normalized, ["tras perdida", "contrapresion", "counterpress"])) {
    adjustments.push("counterPress");
  }
  if (hasAny(normalized, ["banda debil", "lado debil", "nos ganan por banda"])) {
    adjustments.push("protectWeakSide");
  }
  if (hasAny(normalized, ["9 aislado", "delantero aislado", "apoyos al 9"])) {
    adjustments.push("supportNine");
  }
  return [...new Set(adjustments.length ? adjustments : DEFAULT_ADJUSTMENTS)];
}

const DEFAULT_ADJUSTMENTS: TacticalAdjustment[] = [
  "highBlock",
  "pivotRoleChange",
  "freeFullback",
  "highPress",
  "supportNine",
  "lowBlock",
];

function hasAnyPosition(player: Player, positions: Player["positions"]) {
  return player.positions.some((position) => positions.includes(position));
}

function labelPlayer(player: Player) {
  return `#${player.num} ${player.name}`;
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function profileHas(player: Player, terms: string[]) {
  return hasAny(normalize(player.profile), terms);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
