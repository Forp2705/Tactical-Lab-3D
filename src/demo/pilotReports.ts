import type { SavedPostMatchReport } from "@/ai/post-match/schemas";

export const pilotReportsSeed: SavedPostMatchReport[] = [
  {
    id: "pilot-report-3",
    savedAt: "2026-06-02T11:15:00.000Z",
    report: {
      matchContext: {
        opponent: "San Telmo",
        result: "1-1",
        interpretedResult: {
          ownGoals: 1,
          rivalGoals: 1,
          outcome: "draw",
          label: "Empate 1-1",
        },
        competition: "Primera B",
        date: "2026-06-01",
        ownSystem: "4-3-3",
        opponentSystem: "4-4-2",
        venue: "Local",
      },
      executiveSummary:
        "El equipo compitió mejor con balón, pero volvió a quedar partido tras pérdida y permitió progresiones interiores que obligaron al pivote a defender demasiados metros.",
      matchStory:
        "RomboIQ detecta un patrón repetido: la primera presión salta, pero el interior y el extremo del lado de la pérdida llegan tarde. Cuando eso pasa, el rival encuentra al mediocentro libre y rompe la primera línea.",
      ownStrengths: [
        {
          strength:
            "La salida del central derecho encontró al mediocentro libre con más continuidad que en semanas anteriores.",
          evidence: ["24' salida limpia por carril central", "39' tercer hombre con interior derecho"],
        },
      ],
      ownProblems: [
        {
          problem:
            "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["18' transición rival por dentro", "67' recepción libre entre líneas"],
          severity: "high",
        },
      ],
      ownTeamProblems: [
        {
          problem:
            "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["18' transición rival por dentro", "67' recepción libre entre líneas"],
          severity: "high",
          probableCause:
            "El extremo izquierdo cerró tarde y el interior quedó a distinta altura del pivote.",
        },
        {
          problem:
            "La presión sobre pase atrás no se sostuvo y el rival salió limpio por dentro.",
          evidence: ["31' salida rival con tercer hombre", "58' pase vertical al interior"],
          severity: "medium",
          probableCause:
            "El nueve saltó sin respaldo de los extremos y el pivote llegó tarde al segundo receptor.",
        },
      ],
      conditioningContext: [
        "Seis recuperaciones en campo rival, pero solo dos con estructura cercana para sostener la segunda acción.",
        "El rival buscó atraer por banda y acelerar hacia el carril central.",
      ],
      rivalVulnerabilities: [
        {
          vulnerability: "El lateral izquierdo rival dejó espacio a su espalda cuando el extremo saltó por dentro.",
          evidence: ["41' ruptura de Lucas Medina", "72' cambio de orientación limpio"],
          howWeExploitedIt: "Cuando el extremo fijó por fuera, el equipo progresó con claridad.",
        },
      ],
      observedRisks: [
        {
          risk: "Quedar con el pivote aislado cada vez que el primer salto llega tarde.",
          evidence: ["18' transición rival", "67' recepción interior"],
          owner: "own",
        },
      ],
      tacticalTradeoffs: [
        {
          decision: "Saltar alto con extremos agresivos.",
          upside: "Recuperar arriba y acortar el campo.",
          downside: "Dejar grande la distancia interior-pivote si el salto no es coordinado.",
          subject: "own",
          evidence: ["31' salida rival limpia", "58' pase vertical libre"],
        },
      ],
      flankAsymmetries: [
        {
          flank: "left",
          description: "La izquierda llegó más tarde a la pérdida que la derecha.",
          subject: "own",
          evidence: ["18' pérdida por izquierda", "54' apoyo tardío del extremo"],
          implication: "Conviene entrenar cierre interior del extremo izquierdo.",
        },
      ],
      tacticalInferences: [
        {
          inference:
            "El problema principal no es la intención de presionar sino la distancia entre interior, pivote y extremo tras pérdida.",
          basedOn: ["18' transición rival", "31' salida rival limpia", "67' recepción interior"],
          confidence: "high",
        },
      ],
      memoryInfluence: [
        {
          memoryItem: "El pivote sufre cuando el bloque se parte tras pérdida.",
          usedAs: "supportedByCurrentEvidence",
          currentEvidence: ["18' transición rival", "67' recepción interior"],
        },
      ],
      grounding: {
        resultPerspective: "Propio",
        evidenceUsed: ["18' transición rival por dentro", "31' salida rival con tercer hombre", "67' recepción libre entre líneas"],
        unsupportedClaims: [],
        subjectAttributionWarnings: [],
      },
      keyPatterns: [
        {
          pattern: "La presión tras pérdida llega con buena intención pero sin estructura corta detrás del primer salto.",
          evidence: ["18' transición rival", "31' pase atrás rival"],
          tacticalImpact: "El rival encuentra recepción limpia por dentro y obliga al pivote a correr hacia atrás.",
        },
      ],
      mainProblems: [
        {
          problem: "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          probableCause: "Los interiores no cerraron a la misma altura del pivote después del primer salto.",
          severity: "high",
          examplesToReview: ["18' transición rival por dentro", "67' recepción libre entre líneas"],
        },
      ],
      positives: [
        "La salida con central conductor mejoró respecto a la semana anterior.",
        "El equipo encontró al extremo derecho con ventaja cuando pudo fijar por fuera.",
      ],
      wednesdayTest: [
        {
          hypothesis:
            "Si el interior del lado de la pérdida cierra cinco metros antes, el pivote llega acompañado y el rival no rompe por dentro.",
          test:
            "Ejercicio de presión tras pérdida con doble carril y obligación de cerrar interior antes del segundo pase rival.",
          successSignals: [
            "Recuperación en tres pases o menos",
            "Pivote con apoyo a menos de ocho metros",
          ],
          fallbackIfFails:
            "Bajar una altura al extremo para proteger al pivote antes del salto del nueve.",
        },
      ],
      saturdayFocus: [
        "No dejar al pivote defendiendo solo tras pérdida.",
        "Coordinar altura del extremo y del interior antes del primer salto.",
      ],
      risksOfOvercorrection: [
        "Si el extremo se hunde demasiado pronto, el equipo pierde agresividad para recuperar arriba.",
      ],
      missingInformation: [
        "Falta medir cuántas pérdidas se produjeron con el lateral izquierdo por delante de la línea del balón.",
      ],
      memoryCandidates: [
        {
          id: "pilot-memory-3a",
          statement:
            "Cuando la presión tras pérdida llega tarde por izquierda, el pivote queda demasiado expuesto.",
          category: "teamPattern",
          evidence: ["18' transición rival por dentro", "54' apoyo tardío del extremo"],
          confidence: "high",
          scope: "validated",
          status: "accepted",
          selectedByStaff: true,
        },
      ],
      reflection: {
        mainUncertainty:
          "La lectura es sólida, pero falta confirmar si la altura del lateral izquierdo agrava o solo acompaña el problema.",
        alternativeInterpretation:
          "Parte del desorden puede venir del timing del nueve y no solo de la distancia interior-pivote.",
        confidence: 0.78,
      },
    },
    sourceInput: {
      matchContext: {
        opponent: "San Telmo",
        result: "1-1",
        competition: "Primera B",
        date: "2026-06-01",
        ownSystem: "4-3-3",
        opponentSystem: "4-4-2",
        venue: "Local",
      },
      planBeforeMatch:
        "Saltar alto sobre pase atrás y proteger al pivote con el interior del lado de la pérdida.",
      staffNotes:
        "Competimos mejor con balón, pero el equipo volvió a quedar largo tras pérdida. El pivote llegó solo varias veces.",
      tags: [
        { minute: 18, label: "transición rival por dentro", severity: "high" },
        { minute: 31, label: "salida rival con tercer hombre", severity: "medium" },
      ],
    },
    staffReview: {
      notes:
        "Validado por el staff. El foco de la semana es proteger mejor al pivote tras pérdida.",
      acceptedMemoryCandidateIds: ["pilot-memory-3a"],
    },
  },
  {
    id: "pilot-report-2",
    savedAt: "2026-05-28T10:05:00.000Z",
    report: {
      matchContext: {
        opponent: "Midland",
        result: "2-1",
        interpretedResult: {
          ownGoals: 2,
          rivalGoals: 1,
          outcome: "win",
          label: "Victoria 2-1",
        },
        competition: "Primera B",
        date: "2026-05-27",
        ownSystem: "4-3-3",
        opponentSystem: "4-2-3-1",
        venue: "Visitante",
      },
      executiveSummary:
        "El equipo mejoró la salida con el central conductor, pero el bloque volvió a partirse tras pérdida y concedió recepciones interiores evitables.",
      matchStory:
        "La primera parte tuvo mejor secuencia de pases y progresión central, aunque el rival encontró ventajas cada vez que el interior quedó lejos del pivote después de una pérdida.",
      ownStrengths: [
        {
          strength: "La salida por dentro encontró más veces al mediocentro libre.",
          evidence: ["14' central conduce y fija", "45' progresión central limpia"],
        },
      ],
      ownProblems: [
        {
          problem:
            "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["22' recepción interior rival", "63' carrera defensiva del pivote"],
          severity: "medium",
        },
      ],
      ownTeamProblems: [
        {
          problem:
            "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["22' recepción interior rival", "63' carrera defensiva del pivote"],
          severity: "medium",
          probableCause: "El interior del lado fuerte quedó por delante de la línea del balón.",
        },
      ],
      conditioningContext: [
        "El equipo recuperó alto cinco veces, pero no sostuvo la segunda jugada con la misma consistencia.",
      ],
      rivalVulnerabilities: [
        {
          vulnerability: "El pivote rival saltó tarde cuando el central condujo.",
          evidence: ["14' progresión central", "45' tercer hombre libre"],
          howWeExploitedIt: "El mediocentro propio recibió perfilado entre líneas.",
        },
      ],
      observedRisks: [
        {
          risk: "Perder compactación tras pérdida cuando el interior queda por delante.",
          evidence: ["22' recepción interior rival"],
          owner: "own",
        },
      ],
      tacticalTradeoffs: [
        {
          decision: "Acelerar la progresión central con el central conductor.",
          upside: "El equipo atacó mejor la espalda del mediocentro rival.",
          downside: "Si se pierde en esa zona, el pivote queda muy expuesto.",
          subject: "own",
          evidence: ["14' progresión central", "22' transición rival"],
        },
      ],
      flankAsymmetries: [],
      tacticalInferences: [
        {
          inference:
            "La mejora con balón no resolvió por sí sola la protección del pivote tras pérdida.",
          basedOn: ["14' progresión central", "22' transición rival"],
          confidence: "medium",
        },
      ],
      memoryInfluence: [],
      grounding: {
        resultPerspective: "Propio",
        evidenceUsed: ["14' progresión central", "22' recepción interior rival"],
        unsupportedClaims: [],
        subjectAttributionWarnings: [],
      },
      keyPatterns: [
        {
          pattern: "Se repite la distancia grande entre interior y pivote tras pérdida.",
          evidence: ["22' recepción interior rival", "63' carrera defensiva del pivote"],
          tacticalImpact: "El rival puede progresar por dentro antes de que llegue la ayuda.",
        },
      ],
      mainProblems: [
        {
          problem: "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          probableCause: "El interior llegó tarde a cerrar por dentro.",
          severity: "medium",
          examplesToReview: ["22' recepción interior rival"],
        },
      ],
      positives: [
        "La salida por dentro mejoró con el central conductor.",
        "El equipo encontró más veces al mediocentro libre entre líneas.",
      ],
      wednesdayTest: [
        {
          hypothesis:
            "Si el interior reacciona antes hacia dentro, el equipo protege mejor la segunda jugada.",
          test:
            "Juego reducido con pérdida condicionada y cierre obligatorio del interior hacia el pivote.",
          successSignals: ["Pivote con apoyo cercano", "Menos recepciones rivales por dentro"],
        },
      ],
      saturdayFocus: [
        "Sostener la compactación interior tras pérdida.",
      ],
      risksOfOvercorrection: [
        "Si el interior se mete demasiado temprano, se puede perder amplitud para robar afuera.",
      ],
      missingInformation: [],
      memoryCandidates: [
        {
          id: "pilot-memory-2a",
          statement:
            "La distancia interior-pivote sigue siendo un indicador clave de estabilidad tras pérdida.",
          category: "staffPrinciple",
          evidence: ["22' recepción interior rival", "63' carrera defensiva del pivote"],
          confidence: "medium",
          scope: "repeatWatch",
          status: "candidate",
          selectedByStaff: false,
        },
      ],
      reflection: {
        mainUncertainty:
          "Falta medir si el lateral acompaña o corrige tarde la misma jugada.",
        alternativeInterpretation:
          "También puede estar influyendo el timing del nueve en el primer salto.",
        confidence: 0.71,
      },
    },
    sourceInput: {
      matchContext: {
        opponent: "Midland",
        result: "2-1",
        competition: "Primera B",
        date: "2026-05-27",
        ownSystem: "4-3-3",
        opponentSystem: "4-2-3-1",
        venue: "Visitante",
      },
      staffNotes:
        "Mejoramos con balón, pero el pivote volvió a quedar solo tras pérdida. Hay que revisar la distancia del interior.",
      tags: [{ minute: 22, label: "recepción interior rival", severity: "medium" }],
    },
    staffReview: {
      notes: "Guardar como antecedente de compactación interior.",
      acceptedMemoryCandidateIds: [],
    },
  },
  {
    id: "pilot-report-1",
    savedAt: "2026-05-21T09:40:00.000Z",
    report: {
      matchContext: {
        opponent: "Dock Sud",
        result: "0-2",
        interpretedResult: {
          ownGoals: 0,
          rivalGoals: 2,
          outcome: "loss",
          label: "Derrota 0-2",
        },
        competition: "Primera B",
        date: "2026-05-20",
        ownSystem: "4-3-3",
        opponentSystem: "4-4-2",
        venue: "Visitante",
      },
      executiveSummary:
        "El equipo quedó demasiado largo entre líneas y nunca logró proteger al pivote cuando perdió arriba.",
      matchStory:
        "La presión inicial no encontró respaldo. El rival atrajo por banda y jugó por dentro con demasiada facilidad.",
      ownStrengths: [],
      ownProblems: [
        {
          problem: "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["12' transición rival", "49' recepción libre interior"],
          severity: "medium",
        },
      ],
      ownTeamProblems: [
        {
          problem: "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          evidence: ["12' transición rival", "49' recepción libre interior"],
          severity: "medium",
          probableCause: "El equipo saltó sin acortar detrás del balón.",
        },
      ],
      conditioningContext: [
        "El rival buscó atraer por un costado para entrar rápido por dentro.",
      ],
      rivalVulnerabilities: [],
      observedRisks: [
        {
          risk: "Quedar partidos entre la primera y la segunda línea.",
          evidence: ["12' transición rival"],
          owner: "own",
        },
      ],
      tacticalTradeoffs: [],
      flankAsymmetries: [],
      tacticalInferences: [
        {
          inference: "El problema fue colectivo y estructural, no individual.",
          basedOn: ["12' transición rival", "49' recepción libre interior"],
          confidence: "medium",
        },
      ],
      memoryInfluence: [],
      grounding: {
        resultPerspective: "Propio",
        evidenceUsed: ["12' transición rival", "49' recepción libre interior"],
        unsupportedClaims: [],
        subjectAttributionWarnings: [],
      },
      keyPatterns: [
        {
          pattern: "El rival progresó por dentro cuando el equipo perdió compactación.",
          evidence: ["12' transición rival"],
          tacticalImpact: "El pivote defendió demasiados metros hacia atrás.",
        },
      ],
      mainProblems: [
        {
          problem: "El bloque quedó largo tras pérdida y el pivote defendió demasiado solo.",
          probableCause: "La primera presión no tuvo respaldo interior.",
          severity: "medium",
          examplesToReview: ["12' transición rival"],
        },
      ],
      positives: [],
      wednesdayTest: [
        {
          hypothesis:
            "Si el equipo acorta detrás de la presión, el pivote no queda expuesto.",
          test: "Tarea de presión tras pérdida con referencias de distancia interior.",
          successSignals: ["Menos recepciones interiores rivales"],
        },
      ],
      saturdayFocus: ["Acortar el equipo tras pérdida."],
      risksOfOvercorrection: [],
      missingInformation: [],
      memoryCandidates: [],
      reflection: {
        mainUncertainty: "Falta separar cuánto pesó el timing del nueve y cuánto la altura de los interiores.",
        alternativeInterpretation: "La distancia entre líneas pudo venir de pérdidas mal perfiladas en salida.",
        confidence: 0.68,
      },
    },
    sourceInput: {
      matchContext: {
        opponent: "Dock Sud",
        result: "0-2",
        competition: "Primera B",
        date: "2026-05-20",
        ownSystem: "4-3-3",
        opponentSystem: "4-4-2",
        venue: "Visitante",
      },
      staffNotes:
        "Nos rompieron por dentro varias veces después de pérdida. El pivote quedó demasiado solo.",
      tags: [{ minute: 12, label: "transición rival", severity: "medium" }],
    },
    staffReview: {
      notes: "Primer punto de partida para el patrón de compactación.",
      acceptedMemoryCandidateIds: [],
    },
  },
];
