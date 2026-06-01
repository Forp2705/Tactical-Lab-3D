import {
  type Actor,
  type Exercise,
  ExerciseSchema,
  type Layer,
  type Phase,
  type Vec2,
} from "../schemas.js";

const phases = (
  duration: number,
  activeLayers: Layer[] = ["withBall", "withoutBall"],
): Phase[] => [
  {
    id: "setup",
    name: "Setup",
    start: 0,
    end: duration * 0.28,
    activeLayers: ["notes"],
    notes: "Estructura inicial, sin ruido visual.",
  },
  {
    id: "execution",
    name: "Ejecución",
    start: duration * 0.28,
    end: duration * 0.72,
    activeLayers,
    notes: "Aparecen rutas y triggers de la consigna principal.",
  },
  {
    id: "outcome",
    name: "Resultado",
    start: duration * 0.72,
    end: duration,
    activeLayers: [...activeLayers, "notes"],
    notes: "Se remarca ventaja, recuperación o zona objetivo.",
  },
];

const extraExercises: unknown[] = [
  {
    id: "rondo-4v2-dos-zonas",
    title: "Rondo 4v2 a dos zonas con cambio vertical",
    phase: "transOff",
    principle: "cambio de zona + reaccion tras perdida",
    level: "U14+",
    intensity: "high",
    rpe: 7,
    density: 0.7,
    players: { min: 8, max: 8 },
    duration: 14,
    space: "2 zonas de 16x16 m",
    material: [
      { name: "conos", qty: 12, unit: "u" },
      { name: "pelotas", qty: 6, unit: "u" },
    ],
    objective: {
      primary:
        "Asegurar posesion y cambiar rapido a la zona opuesta tras atraer presion.",
    },
    organization:
      "Dos cuadrados conectados. Cuatro apoyos conservan, dos defienden y dos esperan como apoyos destino.",
    rules: [
      "Se cambia de zona despues de 4 pases",
      "Si el defensor roba, ataca mini-zona central",
      "El receptor destino juega de cara en dos toques",
    ],
    coaching: [
      "Atraer antes de cambiar",
      "El apoyo destino debe estar perfilado antes del pase",
      "Reaccionar cinco metros hacia perdida",
    ],
    errors: [
      "Cambio sin fijar al defensor",
      "Receptor esperando plano",
      "Defensor que roba sin primer pase seguro",
    ],
    success:
      "Completar 5 cambios de zona en 3 minutos con primer control orientado.",
    progressions: [
      "Cambio obligatorio a un toque",
      "Defensor que roba puede finalizar en mini-arco",
    ],
    regressions: [
      "Tres defensores pasivos al inicio",
      "Zona destino sin oposicion",
    ],
    scene: {
      duration: 14,
      pitchMode: "small",
      actors: [
        actor("a1", "own", 4, "AP", { x: 18, y: 35 }, [
          { t: 5, pos: { x: 22, y: 34 } },
        ]),
        actor("a2", "own", 6, "AP", { x: 36, y: 25 }, [
          { t: 4, pos: { x: 40, y: 29 } },
        ]),
        actor("a3", "own", 8, "AP", { x: 36, y: 48 }, [
          { t: 7, pos: { x: 39, y: 50 } },
        ]),
        actor("a4", "own", 10, "AP", { x: 18, y: 58 }, [
          { t: 8, pos: { x: 23, y: 58 } },
        ]),
        actor("d1", "rival", 2, "DEF", { x: 27, y: 41 }, [
          { t: 4, pos: { x: 35, y: 32 } },
          { t: 8, pos: { x: 44, y: 47 } },
        ]),
        actor("d2", "rival", 3, "DEF", { x: 30, y: 51 }, [
          { t: 5, pos: { x: 35, y: 47 } },
          { t: 9, pos: { x: 47, y: 51 } },
        ]),
        actor("t1", "own", 7, "DEST", { x: 70, y: 35 }, [
          { t: 9, pos: { x: 75, y: 36 } },
        ]),
        actor("t2", "own", 11, "DEST", { x: 70, y: 58 }, [
          { t: 10, pos: { x: 76, y: 55 } },
        ]),
      ],
      ball: {
        start: { x: 18, y: 35, z: 0 },
        path: [
          { t: 2, pos: { x: 36, y: 25, z: 0.4 } },
          { t: 4, pos: { x: 36, y: 48, z: 0.4 } },
          { t: 7, pos: { x: 70, y: 35, z: 0.8 } },
          { t: 11, pos: { x: 70, y: 58, z: 0.4 } },
        ],
      },
      overlays: [
        {
          id: "rz1",
          type: "pass",
          from: "a1",
          to: "a2",
          start: 0.5,
          end: 2.2,
          layer: "withBall",
        },
        {
          id: "rz2",
          type: "pass",
          from: "a3",
          to: "t1",
          start: 5.5,
          end: 7.6,
          label: "cambio",
          layer: "withBall",
        },
        {
          id: "rz3",
          type: "press",
          from: "d1",
          to: "a2",
          start: 2,
          end: 5,
          layer: "press",
        },
        {
          id: "rz4",
          type: "run",
          from: "t2",
          to: { x: 76, y: 55 },
          start: 7,
          end: 11,
          label: "apoyo",
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "rzz1",
          label: "zona A",
          rect: { x: 12, y: 22, w: 32, h: 42 },
          color: "#5eead4",
          layer: "notes",
          visibleInPhases: ["setup"],
        },
        {
          id: "rzz2",
          label: "zona B",
          rect: { x: 62, y: 22, w: 28, h: 42 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "rzt1",
          description: "Defensor interior queda fijado por dos pases cortos",
          whenT: 5.5,
          cause: { actorId: "d1", action: "badControl" },
          activatesOverlays: ["rz2"],
        },
      ],
      phases: phases(14, ["withBall", "withoutBall", "press"]),
    },
  },
  {
    id: "central-step-in",
    title: "Central conduce y encuentra mediocentro libre",
    phase: "attackOrg",
    principle: "progresion central",
    level: "U18+",
    intensity: "med",
    rpe: 6,
    density: 0.55,
    players: { min: 7, max: 8 },
    duration: 15,
    space: "medio campo central",
    material: [
      { name: "pelotas", qty: 8, unit: "u" },
      { name: "conos", qty: 8, unit: "u" },
    ],
    objective: {
      primary:
        "Usar la conduccion del central para atraer y jugar al mediocentro libre.",
    },
    organization:
      "Dos centrales, pivote, interior y punta contra tres presionantes.",
    rules: [
      "Central conduce si no salta rival",
      "Pivote no baja a la misma linea",
      "Punta fija central rival",
    ],
    coaching: [
      "Primer toque del central hacia delante",
      "Pivote se esconde y aparece fuera de sombra",
      "Interior prepara apoyo de cara",
    ],
    errors: [
      "Conduccion sin escanear",
      "Pivote delante del rival",
      "Pase vertical forzado sin ventaja",
    ],
    success: "Encontrar al mediocentro perfilado 6 veces en 10 intentos.",
    progressions: [
      "Agregar rival sobre interior",
      "Finalizar en mini-arco tras tercer hombre",
    ],
    regressions: [
      "Presionante arranca dos metros tarde",
      "Permitir pase lateral de seguridad",
    ],
    scene: {
      duration: 15,
      pitchMode: "half",
      actors: [
        actor("c4", "own", 4, "DFC", { x: 24, y: 42 }, [
          { t: 5, pos: { x: 38, y: 43 } },
        ]),
        actor("c5", "own", 5, "DFC", { x: 22, y: 62 }, [
          { t: 5, pos: { x: 24, y: 64 } },
        ]),
        actor("p6", "own", 6, "PIV", { x: 48, y: 52 }, [
          { t: 7, pos: { x: 56, y: 48 } },
        ]),
        actor("i8", "own", 8, "INT", { x: 62, y: 40 }, [
          { t: 10, pos: { x: 68, y: 38 } },
        ]),
        actor("n9", "own", 9, "FIJA", { x: 72, y: 54 }, [
          { t: 8, pos: { x: 78, y: 54 } },
        ]),
        actor("pr9", "rival", 9, "PRES", { x: 40, y: 49 }, [
          { t: 5, pos: { x: 36, y: 43 } },
        ]),
        actor("pr10", "rival", 10, "SOMB", { x: 50, y: 56 }, [
          { t: 7, pos: { x: 52, y: 51 } },
        ]),
      ],
      ball: {
        start: { x: 24, y: 42, z: 0 },
        path: [
          { t: 5.5, pos: { x: 38, y: 43, z: 0 } },
          { t: 8, pos: { x: 56, y: 48, z: 0.6 } },
          { t: 11, pos: { x: 68, y: 38, z: 0.4 } },
        ],
      },
      overlays: [
        {
          id: "cs1",
          type: "dribble",
          from: "c4",
          to: { x: 38, y: 43 },
          start: 1.5,
          end: 5.8,
          label: "atraer",
          layer: "withBall",
        },
        {
          id: "cs2",
          type: "pass",
          from: "c4",
          to: "p6",
          start: 6,
          end: 8.2,
          label: "vertical",
          layer: "withBall",
        },
        {
          id: "cs3",
          type: "pass",
          from: "p6",
          to: "i8",
          start: 8.5,
          end: 11.2,
          label: "de cara",
          layer: "withBall",
        },
        {
          id: "cs4",
          type: "lineBlocked",
          from: "pr10",
          to: "p6",
          start: 3,
          end: 7,
          layer: "cover",
        },
      ],
      zones: [
        {
          id: "csz1",
          label: "espalda",
          rect: { x: 52, y: 42, w: 14, h: 18 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "cst1",
          description: "El punta no salta y el central puede conducir",
          whenT: 2,
          cause: { actorId: "pr9", action: "cbCarry" },
          activatesOverlays: ["cs1", "cs2"],
        },
      ],
      phases: phases(15, ["withBall", "cover"]),
    },
  },
  {
    id: "finalizacion-ruptura-debil",
    title: "Finalizacion con ruptura al lado debil",
    phase: "attackOrg",
    principle: "fijar-liberar",
    level: "U17+",
    intensity: "high",
    rpe: 7,
    density: 0.64,
    players: { min: 7, max: 8 },
    duration: 13,
    space: "tercio final",
    material: [
      { name: "pelotas", qty: 10, unit: "u" },
      { name: "arco", qty: 1, unit: "u" },
    ],
    objective: {
      primary: "Fijar por dentro y atacar espalda del lateral opuesto.",
    },
    organization:
      "Interior, mediapunta, extremo debil y 9 contra linea de tres defensores.",
    rules: [
      "La ruptura empieza cuando el mediapunta recibe",
      "El 9 arrastra al central",
      "Remate en maximo dos contactos",
    ],
    coaching: [
      "El extremo debil mira linea antes de arrancar",
      "Mediapunta pausa medio segundo",
      "Pase al espacio, no al pie",
    ],
    errors: [
      "Ruptura temprana en fuera de juego",
      "9 no fija al central",
      "Pase flotado lento",
    ],
    success: "Generar remate claro desde diagonal en 6 de 10 repeticiones.",
    progressions: [
      "Agregar recuperacion defensiva",
      "Permitir contra si falla pase",
    ],
    regressions: ["Defensores pasivos", "Salida sin fuera de juego"],
    scene: {
      duration: 13,
      pitchMode: "third",
      actors: [
        actor("m8", "own", 8, "INT", { x: 58, y: 55 }, [
          { t: 4, pos: { x: 64, y: 52 } },
        ]),
        actor("mp", "own", 10, "MP", { x: 70, y: 48 }, [
          { t: 6, pos: { x: 74, y: 47 } },
        ]),
        actor("w7", "own", 7, "ED", { x: 62, y: 78 }, [
          { t: 6.5, pos: { x: 78, y: 70 } },
          { t: 10, pos: { x: 90, y: 60 } },
        ]),
        actor("st", "own", 9, "DC", { x: 82, y: 45 }, [
          { t: 7, pos: { x: 88, y: 42 } },
        ]),
        actor("d3", "rival", 3, "LI", { x: 76, y: 72 }, [
          { t: 7, pos: { x: 80, y: 68 } },
        ]),
        actor("d4", "rival", 4, "DFC", { x: 84, y: 48 }, [
          { t: 8, pos: { x: 86, y: 45 } },
        ]),
        actor("gk2", "rival", 1, "GK", { x: 96, y: 50 }, [
          { t: 9, pos: { x: 95, y: 54 } },
        ]),
      ],
      ball: {
        start: { x: 58, y: 55, z: 0 },
        path: [
          { t: 4, pos: { x: 70, y: 48, z: 0.4 } },
          { t: 8.2, pos: { x: 90, y: 60, z: 1.3 } },
          { t: 11, pos: { x: 96, y: 52, z: 1.8 } },
        ],
      },
      overlays: [
        {
          id: "fr1",
          type: "pass",
          from: "m8",
          to: "mp",
          start: 1,
          end: 4.4,
          layer: "withBall",
        },
        {
          id: "fr2",
          type: "run",
          from: "w7",
          to: { x: 90, y: 60 },
          start: 5,
          end: 10,
          label: "espalda",
          layer: "withoutBall",
        },
        {
          id: "fr3",
          type: "pass",
          from: "mp",
          to: { x: 90, y: 60 },
          start: 6.5,
          end: 8.6,
          label: "ventaja",
          layer: "withBall",
        },
        {
          id: "fr4",
          type: "run",
          from: "st",
          to: { x: 88, y: 42 },
          start: 5.5,
          end: 8,
          label: "fija",
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "frz1",
          label: "lado debil",
          rect: { x: 78, y: 58, w: 18, h: 22 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "frt1",
          description: "Mediapunta recibe entre lineas y lateral mira pelota",
          whenT: 6,
          cause: { actorId: "mp", action: "receiveBack" },
          activatesOverlays: ["fr2", "fr3"],
        },
      ],
      phases: phases(13, ["withBall", "withoutBall"]),
    },
  },
  {
    id: "bloque-medio-basculacion",
    title: "Bloque medio: bascular sin partirse",
    phase: "defenseOrg",
    principle: "basculacion + cobertura",
    level: "U18+",
    intensity: "med",
    rpe: 6,
    density: 0.5,
    players: { min: 12, max: 14 },
    duration: 18,
    space: "60x45 m",
    material: [
      { name: "conos", qty: 12, unit: "u" },
      { name: "pelotas", qty: 6, unit: "u" },
    ],
    objective: {
      primary: "Mover bloque a banda manteniendo distancia entre lineas.",
    },
    organization:
      "Dos lineas propias contra circulacion rival de central a lateral.",
    rules: [
      "El 9 orienta, no persigue",
      "Extremo salta si lateral controla hacia delante",
      "Interior cierra carril central",
    ],
    coaching: [
      "Distancia lateral de 8 a 10 metros",
      "Lado opuesto cierra, no queda abierto",
      "Central propio protege espalda del lateral",
    ],
    errors: [
      "Bloque corre tarde y largo",
      "Interior salta dejando pivote",
      "Lado debil no compacta",
    ],
    success: "Forzar pase atras o banda en 8 de 12 circulaciones.",
    progressions: [
      "Agregar cambio de orientacion rival",
      "Rival puede filtrar al punta",
    ],
    regressions: ["Rival juega a dos toques", "Marcar carriles con conos"],
    scene: {
      duration: 18,
      pitchMode: "half",
      actors: [
        actor("bm9", "own", 9, "DC", { x: 52, y: 48 }, [
          { t: 6, pos: { x: 47, y: 45 } },
        ]),
        actor("bm11", "own", 11, "EI", { x: 48, y: 30 }, [
          { t: 7, pos: { x: 42, y: 27 } },
        ]),
        actor("bm7", "own", 7, "ED", { x: 48, y: 70 }, [
          { t: 7, pos: { x: 53, y: 63 } },
        ]),
        actor("bm8", "own", 8, "MC", { x: 40, y: 43 }, [
          { t: 8, pos: { x: 36, y: 38 } },
        ]),
        actor("bm6", "own", 6, "MCD", { x: 38, y: 55 }, [
          { t: 8, pos: { x: 40, y: 50 } },
        ]),
        actor("bm3", "own", 3, "LI", { x: 30, y: 28 }, [
          { t: 8, pos: { x: 27, y: 25 } },
        ]),
        actor("bm4", "own", 4, "DFC", { x: 28, y: 46 }, [
          { t: 8, pos: { x: 30, y: 42 } },
        ]),
        actor("rcb", "rival", 4, "DFC", { x: 66, y: 52 }, [
          { t: 5, pos: { x: 60, y: 45 } },
        ]),
        actor("rlb", "rival", 3, "LI", { x: 66, y: 24 }, [
          { t: 9, pos: { x: 58, y: 22 } },
        ]),
        actor("rpiv", "rival", 6, "PIV", { x: 58, y: 48 }, [
          { t: 7, pos: { x: 56, y: 45 } },
        ]),
      ],
      ball: {
        start: { x: 66, y: 52, z: 0 },
        path: [
          { t: 5, pos: { x: 58, y: 48, z: 0.4 } },
          { t: 9, pos: { x: 66, y: 24, z: 0.8 } },
          { t: 13, pos: { x: 60, y: 22, z: 0.3 } },
        ],
      },
      overlays: [
        {
          id: "bm1",
          type: "press",
          from: "bm11",
          to: "rlb",
          start: 7,
          end: 12,
          label: "salto",
          layer: "press",
        },
        {
          id: "bm2",
          type: "cover",
          from: "bm8",
          to: "rpiv",
          start: 5,
          end: 11,
          label: "cierra",
          layer: "cover",
        },
        {
          id: "bm3o",
          type: "run",
          from: "bm7",
          to: { x: 53, y: 63 },
          start: 5,
          end: 10,
          label: "lado debil",
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "bmz1",
          label: "compacto",
          rect: { x: 24, y: 22, w: 32, h: 48 },
          color: "#5eead4",
          layer: "cover",
          visibleInPhases: ["execution"],
        },
      ],
      triggers: [
        {
          id: "bmt1",
          description: "Pase a lateral con control hacia delante",
          whenT: 9,
          cause: { actorId: "rlb", action: "closedLateral" },
          activatesOverlays: ["bm1"],
        },
      ],
      phases: phases(18, ["withoutBall", "press", "cover"]),
    },
  },
  {
    id: "contraataque-4v3",
    title: "Contraataque 4v3 tras robo central",
    phase: "transOff",
    principle: "primer pase + ocupar carriles",
    level: "U16+",
    intensity: "veryHigh",
    rpe: 8,
    density: 0.75,
    players: { min: 7, max: 8 },
    duration: 10,
    space: "medio campo a arco",
    material: [
      { name: "pelotas", qty: 8, unit: "u" },
      { name: "arco", qty: 1, unit: "u" },
    ],
    objective: {
      primary:
        "Tras robo, encontrar primer pase seguro y atacar 4v3 en 8 segundos.",
    },
    organization:
      "Robo de mediocentro, extremos abiertos, 9 fija y mediapunta decide pase final.",
    rules: [
      "Primer pase no puede ser hacia atras",
      "Finalizar antes de 8 segundos",
      "Extremos ocupan carriles separados",
    ],
    coaching: [
      "El robo necesita cabeza arriba inmediata",
      "El portador atrae al central antes de soltar",
      "Carril opuesto llega a remate, no mira",
    ],
    errors: [
      "Todos corren hacia pelota",
      "Pase final demasiado temprano",
      "9 corre hacia el mismo carril que extremo",
    ],
    success: "Rematar con superioridad en 7 de 10 transiciones.",
    progressions: ["Agregar defensor de recuperacion", "Limitar a tres pases"],
    regressions: ["Defensores empiezan de espaldas", "Sin limite de tiempo"],
    scene: {
      duration: 10,
      pitchMode: "half",
      actors: [
        actor("ct6", "own", 6, "ROBO", { x: 44, y: 52 }, [
          { t: 2, pos: { x: 49, y: 48 } },
        ]),
        actor("ct10", "own", 10, "MP", { x: 55, y: 48 }, [
          { t: 5, pos: { x: 68, y: 45 } },
        ]),
        actor("ct7", "own", 7, "ED", { x: 54, y: 74 }, [
          { t: 6, pos: { x: 80, y: 68 } },
        ]),
        actor("ct11", "own", 11, "EI", { x: 54, y: 28 }, [
          { t: 6, pos: { x: 78, y: 34 } },
        ]),
        actor("ct9", "own", 9, "DC", { x: 66, y: 52 }, [
          { t: 7, pos: { x: 84, y: 50 } },
        ]),
        actor("cd4", "rival", 4, "DFC", { x: 76, y: 43 }, [
          { t: 7, pos: { x: 80, y: 44 } },
        ]),
        actor("cd5", "rival", 5, "DFC", { x: 78, y: 58 }, [
          { t: 7, pos: { x: 82, y: 55 } },
        ]),
      ],
      ball: {
        start: { x: 43, y: 54, z: 0 },
        path: [
          { t: 2.5, pos: { x: 55, y: 48, z: 0.4 } },
          { t: 5.5, pos: { x: 80, y: 68, z: 0.7 } },
          { t: 8.5, pos: { x: 91, y: 52, z: 1.2 } },
        ],
      },
      overlays: [
        {
          id: "ct1",
          type: "press",
          from: "ct6",
          to: { x: 43, y: 54 },
          start: 0,
          end: 2,
          label: "robo",
          layer: "press",
        },
        {
          id: "ct2",
          type: "pass",
          from: "ct6",
          to: "ct10",
          start: 2,
          end: 3.2,
          label: "primer pase",
          layer: "withBall",
        },
        {
          id: "ct3",
          type: "run",
          from: "ct7",
          to: { x: 80, y: 68 },
          start: 2.5,
          end: 7,
          label: "ancho",
          layer: "withoutBall",
        },
        {
          id: "ct4",
          type: "pass",
          from: "ct10",
          to: "ct7",
          start: 4.5,
          end: 6,
          layer: "withBall",
        },
      ],
      zones: [
        {
          id: "ctz1",
          label: "8 seg",
          rect: { x: 74, y: 35, w: 22, h: 36 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "ctt1",
          description: "Robo central con rival abierto",
          whenT: 1.5,
          cause: { actorId: "ct6", action: "badControl" },
          activatesOverlays: ["ct2", "ct3"],
        },
      ],
      phases: phases(10, ["withBall", "withoutBall", "press"]),
    },
  },
  {
    id: "salida-lateral-tercer-hombre",
    title: "Salida por lateral con tercer hombre interior",
    phase: "attackOrg",
    principle: "tercer hombre por fuera",
    level: "U17+",
    intensity: "med",
    rpe: 6,
    density: 0.57,
    players: { min: 8, max: 9 },
    duration: 15,
    space: "medio campo lateral",
    material: [
      { name: "pelotas", qty: 8, unit: "u" },
      { name: "conos", qty: 10, unit: "u" },
    ],
    objective: {
      primary: "Liberar lateral mediante pared indirecta con interior.",
    },
    organization:
      "Central, lateral, pivote, interior y extremo contra presion lateral.",
    rules: [
      "El lateral no recibe parado contra linea",
      "Interior juega de cara",
      "Extremo fija altura rival",
    ],
    coaching: [
      "Central atrae al extremo rival",
      "Pivote cambia angulo de pase",
      "Interior devuelve al espacio",
    ],
    errors: [
      "Lateral pegado a banda sin salida",
      "Interior recibe de espaldas",
      "Pivote no ofrece linea diagonal",
    ],
    success: "Superar primera presion lateral en 6 de 10 acciones.",
    progressions: [
      "Rival puede saltar al pivote",
      "Finalizar en mini-arco exterior",
    ],
    regressions: [
      "Presion lateral pasiva",
      "Permitir conduccion libre del central",
    ],
    scene: {
      duration: 15,
      pitchMode: "half",
      actors: [
        actor("sl4", "own", 4, "DFC", { x: 24, y: 35 }, [
          { t: 4, pos: { x: 31, y: 35 } },
        ]),
        actor("sl3", "own", 3, "LI", { x: 34, y: 18 }, [
          { t: 8, pos: { x: 52, y: 18 } },
        ]),
        actor("sl6", "own", 6, "PIV", { x: 42, y: 45 }, [
          { t: 5, pos: { x: 46, y: 42 } },
        ]),
        actor("sl8", "own", 8, "INT", { x: 52, y: 34 }, [
          { t: 7, pos: { x: 58, y: 30 } },
        ]),
        actor("sl11", "own", 11, "EI", { x: 64, y: 18 }, [
          { t: 9, pos: { x: 70, y: 16 } },
        ]),
        actor("sr7", "rival", 7, "EXT", { x: 39, y: 27 }, [
          { t: 5, pos: { x: 35, y: 24 } },
        ]),
        actor("sr8", "rival", 8, "MC", { x: 48, y: 40 }, [
          { t: 7, pos: { x: 53, y: 36 } },
        ]),
        actor("sr2", "rival", 2, "LD", { x: 60, y: 22 }, [
          { t: 9, pos: { x: 62, y: 19 } },
        ]),
      ],
      ball: {
        start: { x: 24, y: 35, z: 0 },
        path: [
          { t: 4, pos: { x: 42, y: 45, z: 0.4 } },
          { t: 6.5, pos: { x: 52, y: 34, z: 0.4 } },
          { t: 9, pos: { x: 52, y: 18, z: 0.5 } },
          { t: 12, pos: { x: 70, y: 16, z: 0.3 } },
        ],
      },
      overlays: [
        {
          id: "sl1",
          type: "pass",
          from: "sl4",
          to: "sl6",
          start: 2,
          end: 4.5,
          layer: "withBall",
        },
        {
          id: "sl2",
          type: "pass",
          from: "sl6",
          to: "sl8",
          start: 4.8,
          end: 6.8,
          label: "de cara",
          layer: "withBall",
        },
        {
          id: "sl3o",
          type: "pass",
          from: "sl8",
          to: "sl3",
          start: 6.8,
          end: 9.3,
          label: "tercer hombre",
          layer: "withBall",
        },
        {
          id: "sl4o",
          type: "run",
          from: "sl3",
          to: { x: 52, y: 18 },
          start: 5,
          end: 9,
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "slz1",
          label: "salida",
          rect: { x: 46, y: 12, w: 18, h: 16 },
          color: "#5eead4",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "slt1",
          description: "Extremo rival salta al central y abre pase interior",
          whenT: 4,
          cause: { actorId: "sr7", action: "closedLateral" },
          activatesOverlays: ["sl2", "sl3o"],
        },
      ],
      phases: phases(15, ["withBall", "withoutBall"]),
    },
  },
  {
    id: "defensa-centro-lateral",
    title: "Defensa de centro lateral y segunda jugada",
    phase: "abpDef",
    principle: "defender area + rechace",
    level: "U18+",
    intensity: "med",
    rpe: 6,
    density: 0.52,
    players: { min: 9, max: 11 },
    duration: 12,
    space: "area propia",
    material: [
      { name: "pelotas", qty: 10, unit: "u" },
      { name: "arco", qty: 1, unit: "u" },
    ],
    objective: {
      primary:
        "Defender centro lateral atacando zona y asegurar segunda jugada.",
    },
    organization:
      "Linea defensiva, mediocentro de rechace y atacantes que cargan area.",
    rules: [
      "Central cercano ataca pelota",
      "Central alejado cubre espalda",
      "Mediocentro no se mete debajo del arco",
    ],
    coaching: [
      "Perfilarse viendo pelota y marca",
      "Primer despeje a banda si no hay control",
      "Rechace frontal se defiende hacia delante",
    ],
    errors: [
      "Todos retroceden al arco",
      "Nadie protege frontal",
      "Central alejado mira solo pelota",
    ],
    success: "Despejar o controlar segunda jugada en 8 de 10 centros.",
    progressions: [
      "Agregar atacante en frontal",
      "Contraataque tras despeje limpio",
    ],
    regressions: ["Centro sin oposicion", "Atacantes entran tarde"],
    scene: {
      duration: 12,
      pitchMode: "third",
      actors: [
        actor("dlb", "rival", 11, "CENT", { x: 78, y: 18 }, [
          { t: 3, pos: { x: 82, y: 17 } },
        ]),
        actor("da9", "rival", 9, "REM", { x: 88, y: 48 }, [
          { t: 6, pos: { x: 92, y: 52 } },
        ]),
        actor("da7", "rival", 7, "2P", { x: 82, y: 62 }, [
          { t: 6, pos: { x: 91, y: 60 } },
        ]),
        actor("dc4", "own", 4, "DFC", { x: 86, y: 47 }, [
          { t: 6, pos: { x: 90, y: 50 } },
        ]),
        actor("dc5", "own", 5, "DFC", { x: 84, y: 58 }, [
          { t: 6, pos: { x: 88, y: 60 } },
        ]),
        actor("dgk", "own", 1, "GK", { x: 96, y: 50 }, [
          { t: 6, pos: { x: 95, y: 52 } },
        ]),
        actor("dm6", "own", 6, "REC", { x: 75, y: 44 }, [
          { t: 7, pos: { x: 79, y: 46 } },
        ]),
        actor("dfb", "own", 2, "LD", { x: 82, y: 22 }, [
          { t: 5, pos: { x: 84, y: 20 } },
        ]),
      ],
      ball: {
        start: { x: 78, y: 18, z: 0 },
        path: [
          { t: 5, pos: { x: 90, y: 52, z: 4.1 } },
          { t: 8, pos: { x: 78, y: 46, z: 1.2 } },
        ],
      },
      overlays: [
        {
          id: "dc1",
          type: "pass",
          from: "dlb",
          to: { x: 90, y: 52 },
          start: 1,
          end: 5,
          label: "centro",
          layer: "withBall",
        },
        {
          id: "dc2",
          type: "cover",
          from: "dc5",
          to: { x: 91, y: 60 },
          start: 3,
          end: 7,
          label: "espalda",
          layer: "cover",
        },
        {
          id: "dc3",
          type: "run",
          from: "dm6",
          to: { x: 79, y: 46 },
          start: 5,
          end: 8,
          label: "rechace",
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "dcz1",
          label: "rechace",
          rect: { x: 72, y: 38, w: 15, h: 16 },
          color: "#f8d86a",
          layer: "cover",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "dct1",
          description: "Centro lateral al intervalo entre central y arquero",
          whenT: 4,
          cause: { actorId: "dlb", action: "closedLateral" },
          activatesOverlays: ["dc2", "dc3"],
        },
      ],
      phases: phases(12, ["withBall", "withoutBall", "cover"]),
    },
  },
  {
    id: "pressing-portero-recibe",
    title: "Presion alta cuando recibe el arquero",
    phase: "defenseOrg",
    principle: "trigger arquero",
    level: "Semi-pro",
    intensity: "high",
    rpe: 8,
    density: 0.68,
    players: { min: 10, max: 12 },
    duration: 16,
    space: "primer tercio rival",
    material: [
      { name: "pelotas", qty: 8, unit: "u" },
      { name: "mini-arcos", qty: 2, unit: "u" },
    ],
    objective: {
      primary:
        "Activar presion coordinada cuando el arquero recibe y forzar salida a banda.",
    },
    organization:
      "Tridente presiona salida rival con pivote propio protegiendo pase interior.",
    rules: [
      "9 tapa central alejado",
      "Extremo salta al central cercano",
      "Interior salta si el pase entra al pivote",
    ],
    coaching: [
      "La carrera del 9 es curva",
      "Extremo llega con cuerpo hacia linea",
      "Pivote propio no rompe antes del trigger",
    ],
    errors: [
      "Presionar al arquero recto",
      "Extremo deja pase interior",
      "Interior salta tarde",
    ],
    success: "Forzar despeje o recuperacion en banda en 6 de 10 salidas.",
    progressions: [
      "Rival puede jugar tercer hombre",
      "Sumar lateral rival alto",
    ],
    regressions: ["Arquero a dos toques", "Un central rival fijo"],
    scene: {
      duration: 16,
      pitchMode: "half",
      actors: [
        actor("pgk", "rival", 1, "GK", { x: 10, y: 50 }, [
          { t: 3, pos: { x: 12, y: 50 } },
        ]),
        actor("pcb4", "rival", 4, "DFC", { x: 25, y: 36 }, [
          { t: 6, pos: { x: 23, y: 34 } },
        ]),
        actor("pcb5", "rival", 5, "DFC", { x: 25, y: 64 }, [
          { t: 6, pos: { x: 28, y: 66 } },
        ]),
        actor("pp6", "rival", 6, "PIV", { x: 42, y: 50 }, [
          { t: 7, pos: { x: 44, y: 50 } },
        ]),
        actor("pr9o", "own", 9, "DC", { x: 38, y: 50 }, [
          { t: 5, pos: { x: 22, y: 58 } },
        ]),
        actor("pr11o", "own", 11, "EI", { x: 44, y: 34 }, [
          { t: 7, pos: { x: 30, y: 34 } },
        ]),
        actor("pr7o", "own", 7, "ED", { x: 44, y: 66 }, [
          { t: 7, pos: { x: 33, y: 66 } },
        ]),
        actor("pr8o", "own", 8, "INT", { x: 52, y: 48 }, [
          { t: 8, pos: { x: 45, y: 50 } },
        ]),
      ],
      ball: {
        start: { x: 25, y: 36, z: 0 },
        path: [
          { t: 3, pos: { x: 10, y: 50, z: 0.5 } },
          { t: 7, pos: { x: 25, y: 64, z: 0.7 } },
          { t: 10, pos: { x: 33, y: 70, z: 0.4 } },
        ],
      },
      overlays: [
        {
          id: "pg1",
          type: "press",
          from: "pr9o",
          to: "pgk",
          start: 3,
          end: 7,
          label: "curva",
          layer: "press",
        },
        {
          id: "pg2",
          type: "press",
          from: "pr7o",
          to: "pcb5",
          start: 5,
          end: 9,
          label: "salto",
          layer: "press",
        },
        {
          id: "pg3",
          type: "cover",
          from: "pr8o",
          to: "pp6",
          start: 5,
          end: 10,
          label: "pivote",
          layer: "cover",
        },
      ],
      zones: [
        {
          id: "pgz1",
          label: "trampa",
          rect: { x: 22, y: 62, w: 18, h: 18 },
          color: "#ef4444",
          layer: "press",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "pgt1",
          description: "Arquero recibe de vuelta mirando su arco",
          whenT: 3,
          cause: { actorId: "pgk", action: "backPass" },
          activatesOverlays: ["pg1", "pg2"],
        },
      ],
      phases: phases(16, ["press", "cover"]),
    },
  },
  {
    id: "posesion-6v3-pivote",
    title: "Posesion 6v3 encontrando al pivote",
    phase: "attackOrg",
    principle: "hombre libre interior",
    level: "U15+",
    intensity: "med",
    rpe: 5,
    density: 0.6,
    players: { min: 9, max: 9 },
    duration: 13,
    space: "30x25 m",
    material: [
      { name: "conos", qty: 10, unit: "u" },
      { name: "pelotas", qty: 6, unit: "u" },
    ],
    objective: {
      primary:
        "Circular hasta encontrar pivote entre lineas y descargar de cara.",
    },
    organization:
      "Seis poseedores por fuera e interior contra tres defensores escalonados.",
    rules: [
      "Pivote puntua si descarga de cara",
      "Defensor que roba juega fuera en 3 segundos",
      "No mas de dos pases en la misma banda",
    ],
    coaching: [
      "Pivote no se muestra siempre",
      "El pase interior necesita angulo previo",
      "Tras descargar, acelerar a lado opuesto",
    ],
    errors: [
      "Forzar pase vertical tapado",
      "Pivote quieto en sombra",
      "Apoyos exteriores sin altura",
    ],
    success: "Ocho recepciones limpias del pivote en cinco minutos.",
    progressions: ["Pivote a un toque", "Defensores pueden cambiar marcas"],
    regressions: ["Pivote sin marca directa", "Mas espacio entre lineas"],
    scene: {
      duration: 13,
      pitchMode: "small",
      actors: [
        actor("po1", "own", 2, "AP", { x: 24, y: 28 }, [
          { t: 5, pos: { x: 28, y: 28 } },
        ]),
        actor("po2", "own", 4, "AP", { x: 24, y: 70 }, [
          { t: 5, pos: { x: 28, y: 70 } },
        ]),
        actor("po3", "own", 6, "PIV", { x: 50, y: 50 }, [
          { t: 6, pos: { x: 54, y: 47 } },
        ]),
        actor("po4", "own", 8, "AP", { x: 50, y: 26 }, [
          { t: 8, pos: { x: 58, y: 28 } },
        ]),
        actor("po5", "own", 10, "AP", { x: 76, y: 30 }, [
          { t: 9, pos: { x: 80, y: 35 } },
        ]),
        actor("po6", "own", 11, "AP", { x: 76, y: 70 }, [
          { t: 9, pos: { x: 80, y: 64 } },
        ]),
        actor("pd1", "rival", 7, "DEF", { x: 42, y: 40 }, [
          { t: 5, pos: { x: 48, y: 43 } },
        ]),
        actor("pd2", "rival", 8, "DEF", { x: 44, y: 60 }, [
          { t: 6, pos: { x: 50, y: 56 } },
        ]),
        actor("pd3", "rival", 9, "DEF", { x: 62, y: 50 }, [
          { t: 7, pos: { x: 58, y: 48 } },
        ]),
      ],
      ball: {
        start: { x: 24, y: 28, z: 0 },
        path: [
          { t: 3, pos: { x: 50, y: 26, z: 0.5 } },
          { t: 6, pos: { x: 54, y: 47, z: 0.4 } },
          { t: 8.5, pos: { x: 76, y: 70, z: 0.7 } },
        ],
      },
      overlays: [
        {
          id: "pv1",
          type: "pass",
          from: "po1",
          to: "po4",
          start: 1,
          end: 3.3,
          layer: "withBall",
        },
        {
          id: "pv2",
          type: "pass",
          from: "po4",
          to: "po3",
          start: 4.5,
          end: 6.5,
          label: "pivote",
          layer: "withBall",
        },
        {
          id: "pv3",
          type: "pass",
          from: "po3",
          to: "po6",
          start: 6.8,
          end: 9,
          label: "de cara",
          layer: "withBall",
        },
        {
          id: "pv4",
          type: "cover",
          from: "pd1",
          to: "po3",
          start: 3,
          end: 6,
          layer: "cover",
        },
      ],
      zones: [
        {
          id: "pvz1",
          label: "entre lineas",
          rect: { x: 44, y: 42, w: 16, h: 16 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["execution"],
        },
      ],
      triggers: [
        {
          id: "pvt1",
          description: "Defensor salta a banda y libera espalda",
          whenT: 4.5,
          cause: { actorId: "pd1", action: "ballToPivot" },
          activatesOverlays: ["pv2"],
        },
      ],
      phases: phases(13, ["withBall", "cover"]),
    },
  },
  {
    id: "abp-corner-corto",
    title: "ABP corner corto con 2v1 y centro tenso",
    phase: "abpOff",
    principle: "corner corto",
    level: "Amateur+",
    intensity: "med",
    rpe: 5,
    density: 0.48,
    players: { min: 7, max: 9 },
    duration: 11,
    space: "esquina + area",
    material: [
      { name: "pelotas", qty: 10, unit: "u" },
      { name: "arco", qty: 1, unit: "u" },
    ],
    objective: {
      primary:
        "Crear 2v1 en corner corto y atacar zona entre penal y area chica.",
    },
    organization:
      "Ejecutor corto, receptor, apoyo de descarga, dos rematadores y defensa zonal.",
    rules: [
      "Si salta un defensor, pared y centro",
      "Si no salta, conducir linea de fondo",
      "Rematadores atacan alturas distintas",
    ],
    coaching: [
      "El receptor no se pega a la linea",
      "Centro tenso al espacio libre",
      "Segundo rematador llega al rechace",
    ],
    errors: [
      "Corner corto sin ventaja",
      "Centro bombeado sin carrera",
      "Dos rematadores al mismo punto",
    ],
    success:
      "Centro tenso con remate o rechace controlado en 6 de 10 acciones.",
    progressions: [
      "Defensor puede doblar marca",
      "Contraataque si defensa roba",
    ],
    regressions: ["Defensor pasivo", "Sin arquero"],
    scene: {
      duration: 11,
      pitchMode: "third",
      actors: [
        actor("cc10", "own", 10, "EJ", { x: 92, y: 6 }, [
          { t: 1, pos: { x: 92, y: 6 } },
        ]),
        actor("cc11", "own", 11, "REC", { x: 84, y: 14 }, [
          { t: 4, pos: { x: 88, y: 13 } },
        ]),
        actor("cc8", "own", 8, "AP", { x: 78, y: 28 }, [
          { t: 5, pos: { x: 83, y: 26 } },
        ]),
        actor("cc9", "own", 9, "REM", { x: 84, y: 50 }, [
          { t: 7, pos: { x: 91, y: 47 } },
        ]),
        actor("cc5", "own", 5, "2P", { x: 78, y: 60 }, [
          { t: 8, pos: { x: 90, y: 58 } },
        ]),
        actor("cd2", "rival", 2, "SALE", { x: 87, y: 18 }, [
          { t: 4, pos: { x: 86, y: 14 } },
        ]),
        actor("cd4", "rival", 4, "DEF", { x: 88, y: 50 }, [
          { t: 8, pos: { x: 89, y: 49 } },
        ]),
      ],
      ball: {
        start: { x: 92, y: 6, z: 0 },
        path: [
          { t: 2.5, pos: { x: 84, y: 14, z: 0.2 } },
          { t: 5, pos: { x: 88, y: 13, z: 0 } },
          { t: 8, pos: { x: 91, y: 47, z: 1.1 } },
        ],
      },
      overlays: [
        {
          id: "cc1",
          type: "pass",
          from: "cc10",
          to: "cc11",
          start: 0.5,
          end: 2.7,
          label: "corto",
          layer: "abp",
        },
        {
          id: "cc2",
          type: "dribble",
          from: "cc11",
          to: { x: 88, y: 13 },
          start: 3,
          end: 5,
          label: "linea",
          layer: "abp",
        },
        {
          id: "cc3",
          type: "pass",
          from: "cc11",
          to: { x: 91, y: 47 },
          start: 5.5,
          end: 8.2,
          label: "tenso",
          layer: "abp",
        },
        {
          id: "cc4",
          type: "run",
          from: "cc9",
          to: { x: 91, y: 47 },
          start: 5,
          end: 8,
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "ccz1",
          label: "zona tensa",
          rect: { x: 87, y: 42, w: 10, h: 18 },
          color: "#f8d86a",
          layer: "abp",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "cct1",
          description: "Defensor salta al corto y abre linea de fondo",
          whenT: 3.5,
          cause: { actorId: "cd2", action: "closedLateral" },
          activatesOverlays: ["cc2", "cc3"],
        },
      ],
      phases: phases(11, ["abp", "withoutBall"]),
    },
  },
  {
    id: "activacion-pase-tercer-hombre",
    title: "Activacion: pase, apoyo y tercer hombre",
    phase: "attackOrg",
    principle: "perfil corporal + apoyo",
    level: "U12+",
    intensity: "low",
    rpe: 3,
    density: 0.42,
    players: { min: 5, max: 6 },
    duration: 9,
    space: "18x18 m",
    material: [
      { name: "conos", qty: 6, unit: "u" },
      { name: "pelotas", qty: 5, unit: "u" },
    ],
    objective: {
      primary: "Automatizar recepcion perfilada y descarga al tercer hombre.",
    },
    organization:
      "Rombo de cuatro apoyos con un conector interior y rotacion simple.",
    rules: [
      "Recibir con pie alejado",
      "Despues de pasar, ocupar cono libre",
      "Tercer hombre devuelve de cara",
    ],
    coaching: [
      "Escaneo antes del pase",
      "Apoyo en diagonal, no en linea",
      "Cambiar ritmo despues de descargar",
    ],
    errors: [
      "Recibir cuadrado",
      "Pasar y quedarse",
      "Apoyo escondido detras del cono",
    ],
    success: "Secuencia limpia 8 veces sin romper distancias.",
    progressions: ["Agregar defensor sombra", "Un toque en el tercer hombre"],
    regressions: ["Sin rotacion", "Pases libres a dos toques"],
    scene: {
      duration: 9,
      pitchMode: "small",
      actors: [
        actor("ac1", "own", 2, "A", { x: 28, y: 50 }, [
          { t: 5, pos: { x: 38, y: 36 } },
        ]),
        actor("ac2", "own", 4, "B", { x: 50, y: 32 }, [
          { t: 5, pos: { x: 62, y: 50 } },
        ]),
        actor("ac3", "own", 6, "C", { x: 72, y: 50 }, [
          { t: 5, pos: { x: 50, y: 68 } },
        ]),
        actor("ac4", "own", 8, "D", { x: 50, y: 68 }, [
          { t: 5, pos: { x: 28, y: 50 } },
        ]),
        actor("ac5", "own", 10, "3H", { x: 50, y: 50 }, [
          { t: 4, pos: { x: 54, y: 48 } },
        ]),
      ],
      ball: {
        start: { x: 28, y: 50, z: 0 },
        path: [
          { t: 2, pos: { x: 50, y: 32, z: 0.3 } },
          { t: 4, pos: { x: 50, y: 50, z: 0.2 } },
          { t: 6, pos: { x: 72, y: 50, z: 0.3 } },
        ],
      },
      overlays: [
        {
          id: "acp1",
          type: "pass",
          from: "ac1",
          to: "ac2",
          start: 0.5,
          end: 2.2,
          layer: "withBall",
        },
        {
          id: "acp2",
          type: "pass",
          from: "ac2",
          to: "ac5",
          start: 2.2,
          end: 4.2,
          label: "apoyo",
          layer: "withBall",
        },
        {
          id: "acp3",
          type: "pass",
          from: "ac5",
          to: "ac3",
          start: 4.2,
          end: 6.2,
          label: "3 hombre",
          layer: "withBall",
        },
        {
          id: "acr1",
          type: "run",
          from: "ac1",
          to: { x: 38, y: 36 },
          start: 2.2,
          end: 5.2,
          label: "rota",
          layer: "withoutBall",
        },
      ],
      zones: [
        {
          id: "acz1",
          label: "perfil",
          rect: { x: 43, y: 43, w: 14, h: 14 },
          color: "#5eead4",
          layer: "notes",
          visibleInPhases: ["execution"],
        },
      ],
      triggers: [
        {
          id: "act1",
          description: "Receptor juega de cara al conector",
          whenT: 3.5,
          cause: { actorId: "ac2", action: "receiveBack" },
          activatesOverlays: ["acp2", "acp3"],
        },
      ],
      phases: phases(9, ["withBall", "withoutBall"]),
    },
  },
];

function actor(
  id: string,
  team: Actor["team"],
  num: number,
  role: string,
  start: Vec2,
  path: Actor["path"] = [],
): Actor {
  return {
    id,
    team,
    num,
    role,
    start,
    path,
    facingMode: "auto",
    state: [{ t: 0, state: "idle" }],
  };
}

const rawExercises: unknown[] = [
  {
    id: "rondo-4v2-salida",
    title: "Rondo 4v2 con salida por apoyo libre",
    phase: "attackOrg",
    principle: "amplitud + tercer hombre",
    level: "U15+",
    intensity: "med",
    rpe: 5,
    density: 0.62,
    players: { min: 6, max: 6 },
    duration: 12,
    space: "20x20 m",
    material: [
      { name: "conos", qty: 8, unit: "u" },
      { name: "pelotas", qty: 4, unit: "u" },
      { name: "pecheras", qty: 2, unit: "colores" },
    ],
    objective: {
      primary: "Conectar 6 pases y salir por el apoyo que quedó libre.",
      secondary: "Orientar el primer control lejos del defensor más cercano.",
    },
    organization:
      "Cuatro apoyos exteriores contra dos defensores dentro del cuadrado.",
    rules: [
      "Dos toques máximo",
      "Si el defensor roba, cambia con quien perdió",
      "La salida vale doble si llega al apoyo opuesto",
    ],
    coaching: [
      "Abrir línea de pase antes de recibir",
      "El apoyo opuesto no debe mirar la pelota quieto",
      "El tercer hombre aparece cuando el defensor salta",
    ],
    errors: [
      "Apoyos parados en la misma altura",
      "Pase al pie fuerte sin perfil de recepción",
      "Defensores corriendo sin orientar presión",
    ],
    success:
      "Tres salidas limpias en dos minutos sin que los apoyos se cierren.",
    progressions: [
      "Un toque para el apoyo frontal",
      "Reducir a 16x16",
      "Salida obligatoria después del cuarto pase",
    ],
    regressions: [
      "Permitir tres toques",
      "Defensores pasivos los primeros 20 segundos",
    ],
    scene: {
      duration: 12,
      pitchMode: "small",
      actors: [
        actor("r1", "own", 4, "AP", { x: 24, y: 48 }, [
          { t: 4, pos: { x: 28, y: 44 } },
          { t: 9, pos: { x: 24, y: 48 } },
        ]),
        actor("r2", "own", 6, "AP", { x: 50, y: 26 }, [
          { t: 3, pos: { x: 55, y: 31 } },
        ]),
        actor("r3", "own", 8, "AP", { x: 76, y: 48 }, [
          { t: 6, pos: { x: 70, y: 52 } },
        ]),
        actor("r4", "own", 10, "AP", { x: 50, y: 74 }, [
          { t: 8, pos: { x: 45, y: 68 } },
        ]),
        actor("b1", "rival", 2, "DEF", { x: 44, y: 47 }, [
          { t: 4, pos: { x: 52, y: 41 } },
          { t: 8, pos: { x: 58, y: 55 } },
        ]),
        actor("b2", "rival", 3, "DEF", { x: 58, y: 55 }, [
          { t: 5, pos: { x: 52, y: 56 } },
          { t: 10, pos: { x: 43, y: 49 } },
        ]),
      ],
      ball: {
        start: { x: 24, y: 48, z: 0 },
        path: [
          { t: 2.5, pos: { x: 50, y: 26, z: 0.8 } },
          { t: 5.2, pos: { x: 76, y: 48, z: 0.6 } },
          { t: 7.8, pos: { x: 50, y: 74, z: 0.5 } },
          { t: 10.5, pos: { x: 24, y: 48, z: 0.4 } },
        ],
      },
      overlays: [
        {
          id: "p1",
          type: "pass",
          from: "r1",
          to: "r2",
          start: 1,
          end: 3,
          label: "atraer",
          layer: "withBall",
        },
        {
          id: "p2",
          type: "pass",
          from: "r2",
          to: "r3",
          start: 3.2,
          end: 5.5,
          label: "tercer hombre",
          layer: "withBall",
        },
        {
          id: "p3",
          type: "pass",
          from: "r3",
          to: "r4",
          start: 5.8,
          end: 8,
          layer: "withBall",
        },
        {
          id: "pr1",
          type: "press",
          from: "b1",
          to: "r2",
          start: 2,
          end: 5,
          label: "salto",
          layer: "press",
        },
      ],
      zones: [
        {
          id: "z1",
          label: "salida",
          rect: { x: 15, y: 38, w: 18, h: 24 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "tr1",
          description: "Defensor salta al apoyo frontal",
          whenT: 3.1,
          cause: { actorId: "b1", action: "ballToPivot" },
          visualMarker: { pos: { x: 52, y: 38 }, icon: "press" },
          activatesOverlays: ["p2"],
        },
      ],
      phases: phases(12, ["withBall", "press"]),
    },
  },
  {
    id: "salida-3-1",
    title: "Salida 3+1 contra dos puntas",
    phase: "attackOrg",
    principle: "salida 3+1",
    level: "U18+",
    intensity: "med",
    rpe: 6,
    density: 0.58,
    players: { min: 7, max: 8 },
    duration: 16,
    space: "medio campo",
    material: [
      { name: "pelotas", qty: 8, unit: "u" },
      { name: "mini-arcos", qty: 2, unit: "u" },
    ],
    objective: {
      primary:
        "Progresar al segundo carril usando al pivote como tercer hombre.",
    },
    organization:
      "Arquero, dos centrales, pivote y lateral contra primera línea de presión.",
    rules: [
      "El pivote no recibe si está tapado",
      "El lateral solo progresa si el extremo rival queda fijado",
    ],
    coaching: [
      "Central alejado se abre antes del pase al arquero",
      "Pivote se perfila de lado, no de espaldas",
      "La progresión nace cuando el punta separa su carrera",
    ],
    errors: [
      "Pase al pivote con rival en la espalda",
      "Laterales demasiado altos antes de atraer",
      "Arquero juega de primera sin fijar",
    ],
    success: "Cinco progresiones limpias al carril derecho en cuatro minutos.",
    progressions: [
      "Agregar mediapunta rival",
      "Exigir pase vertical después de progresar",
    ],
    regressions: [
      "Presión pasiva al inicio",
      "Permitir conducción del central sin oposición",
    ],
    scene: {
      duration: 16,
      pitchMode: "half",
      actors: [
        actor("gk", "own", 1, "GK", { x: 8, y: 50 }, [
          { t: 2, pos: { x: 10, y: 50 } },
        ]),
        actor("cb1", "own", 4, "DFC", { x: 25, y: 36 }, [
          { t: 5, pos: { x: 22, y: 31 } },
        ]),
        actor("cb2", "own", 5, "DFC", { x: 25, y: 64 }, [
          { t: 5, pos: { x: 24, y: 69 } },
        ]),
        actor("dm", "own", 6, "PIV", { x: 42, y: 50 }, [
          { t: 7, pos: { x: 48, y: 48 } },
          { t: 12, pos: { x: 56, y: 43 } },
        ]),
        actor("rb", "own", 2, "LD", { x: 45, y: 78 }, [
          { t: 9, pos: { x: 62, y: 78 } },
          { t: 14, pos: { x: 72, y: 70 } },
        ]),
        actor("st1", "rival", 9, "PRES", { x: 32, y: 44 }, [
          { t: 4, pos: { x: 26, y: 39 } },
        ]),
        actor("st2", "rival", 11, "PRES", { x: 33, y: 58 }, [
          { t: 6, pos: { x: 40, y: 56 } },
        ]),
      ],
      ball: {
        start: { x: 8, y: 50, z: 0 },
        path: [
          { t: 3, pos: { x: 25, y: 36, z: 0.7 } },
          { t: 7, pos: { x: 42, y: 50, z: 0.5 } },
          { t: 10.5, pos: { x: 45, y: 78, z: 0.8 } },
          { t: 14, pos: { x: 72, y: 70, z: 0.4 } },
        ],
      },
      overlays: [
        {
          id: "s1",
          type: "pass",
          from: "gk",
          to: "cb1",
          start: 1,
          end: 3.5,
          label: "atraer",
          layer: "withBall",
        },
        {
          id: "s2",
          type: "pass",
          from: "cb1",
          to: "dm",
          start: 4.6,
          end: 7.4,
          label: "tercer hombre",
          layer: "withBall",
        },
        {
          id: "s3",
          type: "pass",
          from: "dm",
          to: "rb",
          start: 8,
          end: 10.8,
          layer: "withBall",
        },
        {
          id: "s4",
          type: "run",
          from: "rb",
          to: { x: 72, y: 70 },
          start: 9,
          end: 14,
          label: "progresar",
          layer: "withoutBall",
        },
        {
          id: "s5",
          type: "press",
          from: "st1",
          to: "cb1",
          start: 2,
          end: 5,
          layer: "press",
        },
      ],
      zones: [
        {
          id: "zs1",
          label: "3+1",
          rect: { x: 18, y: 28, w: 34, h: 44 },
          color: "#5eead4",
          layer: "notes",
          visibleInPhases: ["setup"],
        },
        {
          id: "zs2",
          label: "progresión",
          rect: { x: 60, y: 64, w: 22, h: 22 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "trs1",
          description: "Punta orienta presión hacia central izquierdo",
          whenT: 4,
          cause: { actorId: "st1", action: "cbCarry" },
          activatesOverlays: ["s2"],
        },
      ],
      phases: phases(16, ["withBall", "withoutBall", "press"]),
    },
  },
  {
    id: "presion-pase-atras",
    title: "Presión tras pase atrás orientando a banda",
    phase: "transDef",
    principle: "presión tras pérdida",
    level: "Semi-pro",
    intensity: "high",
    rpe: 8,
    density: 0.72,
    players: { min: 9, max: 10 },
    duration: 15,
    space: "45x40 m",
    material: [
      { name: "conos", qty: 10, unit: "u" },
      { name: "pelotas", qty: 6, unit: "u" },
    ],
    objective: {
      primary: "Forzar el pase lateral y recuperar antes de 8 segundos.",
    },
    organization:
      "Bloque ofensivo pierde pelota y activa presión sobre pase atrás.",
    rules: [
      "El 9 tapa pase interior",
      "Extremo salta cuando el central controla hacia banda",
      "Interior protege pase al pivote",
    ],
    coaching: [
      "La primera carrera tapa, no roba",
      "El extremo llega curvado para cerrar línea interior",
      "El interior decide entre saltar o cubrir pivote",
    ],
    errors: [
      "9 corre recto y deja abierto al pivote",
      "Extremo salta tarde",
      "Línea de medios se parte",
    ],
    success:
      "Recuperar o forzar despeje en 8 segundos en 6 de 10 repeticiones.",
    progressions: [
      "Agregar salida rival por tercer hombre",
      "Dar punto si el rival supera la presión",
    ],
    regressions: ["Pase atrás obligatorio", "Central rival con dos toques"],
    scene: {
      duration: 15,
      pitchMode: "half",
      actors: [
        actor("r9", "own", 9, "DC", { x: 58, y: 50 }, [
          { t: 4, pos: { x: 48, y: 45 } },
          { t: 8, pos: { x: 42, y: 43 } },
        ]),
        actor("r11", "own", 11, "EI", { x: 55, y: 30 }, [
          { t: 5, pos: { x: 44, y: 28 } },
          { t: 9, pos: { x: 38, y: 24 } },
        ]),
        actor("r7", "own", 7, "ED", { x: 55, y: 70 }, [
          { t: 6, pos: { x: 52, y: 70 } },
        ]),
        actor("r8", "own", 8, "INT", { x: 48, y: 58 }, [
          { t: 6, pos: { x: 43, y: 54 } },
        ]),
        actor("r6", "own", 6, "MCD", { x: 42, y: 47 }, [
          { t: 7, pos: { x: 44, y: 49 } },
        ]),
        actor("b4", "rival", 4, "DFC", { x: 36, y: 42 }, [
          { t: 5, pos: { x: 34, y: 38 } },
        ]),
        actor("b5", "rival", 5, "DFC", { x: 38, y: 60 }, [
          { t: 5, pos: { x: 35, y: 62 } },
        ]),
        actor("b6", "rival", 6, "PIV", { x: 46, y: 50 }, [
          { t: 6, pos: { x: 47, y: 50 } },
        ]),
        actor("b2", "rival", 2, "LD", { x: 46, y: 78 }, [
          { t: 8, pos: { x: 42, y: 78 } },
        ]),
      ],
      ball: {
        start: { x: 58, y: 56, z: 0 },
        path: [
          { t: 2.5, pos: { x: 38, y: 60, z: 0.5 } },
          { t: 6.5, pos: { x: 46, y: 78, z: 0.5 } },
          { t: 10, pos: { x: 42, y: 78, z: 0.2 } },
        ],
      },
      overlays: [
        {
          id: "pp1",
          type: "press",
          from: "r9",
          to: "b5",
          start: 2,
          end: 6,
          label: "curva",
          layer: "press",
        },
        {
          id: "pp2",
          type: "press",
          from: "r11",
          to: "b4",
          start: 3.5,
          end: 8,
          label: "salto",
          layer: "press",
        },
        {
          id: "pp3",
          type: "cover",
          from: "r8",
          to: "b6",
          start: 4,
          end: 9,
          label: "tapar pivote",
          layer: "cover",
        },
        {
          id: "pp4",
          type: "lineBlocked",
          from: "b5",
          to: "b6",
          start: 4.5,
          end: 9,
          layer: "cover",
        },
      ],
      zones: [
        {
          id: "zp1",
          label: "trampa",
          rect: { x: 35, y: 70, w: 18, h: 18 },
          color: "#ef4444",
          layer: "press",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "trp1",
          description: "Pase atrás al central perfilado hacia banda",
          whenT: 2.5,
          cause: { actorId: "b5", action: "backPass" },
          activatesOverlays: ["pp1", "pp2"],
        },
      ],
      phases: phases(15, ["press", "cover"]),
    },
  },
  {
    id: "banda-centro-atras",
    title: "Ataque por banda y centro atrás",
    phase: "attackOrg",
    principle: "centro atrás",
    level: "U18+",
    intensity: "high",
    rpe: 7,
    density: 0.67,
    players: { min: 7, max: 8 },
    duration: 14,
    space: "45x35 m",
    material: [
      { name: "mini-arcos", qty: 1, unit: "u" },
      { name: "pelotas", qty: 8, unit: "u" },
    ],
    objective: {
      primary: "Fijar lateral y atacar zona de penal con pase atrás.",
    },
    organization:
      "Triángulo lateral-interior-extremo contra lateral, central y mediocentro.",
    rules: [
      "El extremo no centra si el 9 está estático",
      "El interior pisa zona de rechace",
      "Centro atrás solo al espacio, no al cuerpo",
    ],
    coaching: [
      "El lateral dobla cuando el extremo fija",
      "El 9 arrastra al central antes de atacar",
      "El interior llega, no espera",
    ],
    errors: [
      "Centro frontal sin ventaja",
      "Extremo acelera antes de fijar",
      "Área ocupada por dos jugadores en la misma línea",
    ],
    success: "Generar remate limpio desde zona de penal o segundo palo.",
    progressions: [
      "Agregar segundo central",
      "Limitar tiempo de finalización a 5 segundos",
    ],
    regressions: ["Defensor lateral pasivo", "Permitir centro sin oposición"],
    scene: {
      duration: 14,
      pitchMode: "third",
      actors: [
        actor("li", "own", 3, "LI", { x: 48, y: 24 }, [
          { t: 5, pos: { x: 63, y: 18 } },
          { t: 10, pos: { x: 78, y: 22 } },
        ]),
        actor("ei", "own", 11, "EI", { x: 60, y: 28 }, [
          { t: 4, pos: { x: 68, y: 20 } },
          { t: 8, pos: { x: 76, y: 18 } },
        ]),
        actor("int", "own", 8, "INT", { x: 58, y: 45 }, [
          { t: 7, pos: { x: 72, y: 43 } },
          { t: 11, pos: { x: 80, y: 47 } },
        ]),
        actor("dc", "own", 9, "DC", { x: 76, y: 54 }, [
          { t: 7, pos: { x: 84, y: 52 } },
          { t: 11, pos: { x: 88, y: 45 } },
        ]),
        actor("ld", "rival", 2, "LD", { x: 64, y: 27 }, [
          { t: 7, pos: { x: 70, y: 22 } },
        ]),
        actor("dfc", "rival", 5, "DFC", { x: 80, y: 52 }, [
          { t: 9, pos: { x: 84, y: 50 } },
        ]),
        actor("mc", "rival", 6, "MC", { x: 63, y: 49 }, [
          { t: 8, pos: { x: 69, y: 48 } },
        ]),
      ],
      ball: {
        start: { x: 58, y: 45, z: 0 },
        path: [
          { t: 3, pos: { x: 60, y: 28, z: 0.5 } },
          { t: 6, pos: { x: 72, y: 18, z: 0.5 } },
          { t: 10, pos: { x: 84, y: 46, z: 0.7 } },
        ],
      },
      overlays: [
        {
          id: "ba1",
          type: "pass",
          from: "int",
          to: "ei",
          start: 1,
          end: 3.4,
          label: "fijar",
          layer: "withBall",
        },
        {
          id: "ba2",
          type: "run",
          from: "li",
          to: { x: 78, y: 22 },
          start: 3,
          end: 10,
          label: "doblar",
          layer: "withoutBall",
        },
        {
          id: "ba3",
          type: "pass",
          from: "ei",
          to: "li",
          start: 5.5,
          end: 7,
          layer: "withBall",
        },
        {
          id: "ba4",
          type: "pass",
          from: "li",
          to: { x: 84, y: 46 },
          start: 8.5,
          end: 11,
          label: "centro atrás",
          layer: "withBall",
        },
      ],
      zones: [
        {
          id: "zb1",
          label: "carril",
          rect: { x: 56, y: 12, w: 28, h: 18 },
          color: "#5eead4",
          layer: "withoutBall",
          visibleInPhases: ["execution"],
        },
        {
          id: "zb2",
          label: "penal",
          rect: { x: 78, y: 38, w: 16, h: 18 },
          color: "#f8d86a",
          layer: "notes",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "trb1",
          description: "Extremo fija al lateral y libera doblaje",
          whenT: 5,
          cause: { actorId: "ei", action: "closedLateral" },
          activatesOverlays: ["ba2", "ba3"],
        },
      ],
      phases: phases(14, ["withBall", "withoutBall"]),
    },
  },
  {
    id: "abp-corner-segundo-palo",
    title: "ABP córner al segundo palo + rechace",
    phase: "abpOff",
    principle: "finalización ABP",
    level: "Amateur+",
    intensity: "med",
    rpe: 5,
    density: 0.45,
    players: { min: 8, max: 9 },
    duration: 10,
    space: "área + frontal",
    material: [
      { name: "pelotas", qty: 10, unit: "u" },
      { name: "conos", qty: 4, unit: "u" },
    ],
    objective: { primary: "Atacar segundo palo y preparar rechace frontal." },
    organization:
      "Ejecutor, dos atacantes de área, bloqueador y jugador de rechace.",
    rules: [
      "El bloqueador no choca, ocupa trayectoria",
      "El rematador arranca tarde",
      "El rechace nunca pisa el área chica",
    ],
    coaching: [
      "El segundo palo se ataca desde fuera de la marca visual",
      "El rechace queda perfilado para rematar o reiniciar",
      "El ejecutor mira zona, no solo compañero",
    ],
    errors: [
      "Arranque anticipado",
      "Todos atacan primera línea",
      "Rechace demasiado cerca de centrales",
    ],
    success: "Remate o segunda jugada controlada en 7 de 10 envíos.",
    progressions: ["Defensa activa", "Agregar contraataque si rival despeja"],
    regressions: ["Marcas pasivas", "Sin arquero al inicio"],
    scene: {
      duration: 10,
      pitchMode: "third",
      actors: [
        actor("ej", "own", 10, "EJ", { x: 92, y: 6 }, [
          { t: 1.5, pos: { x: 92, y: 6 } },
        ]),
        actor("a9", "own", 9, "REM", { x: 78, y: 52 }, [
          { t: 4, pos: { x: 88, y: 61 } },
          { t: 7, pos: { x: 91, y: 58 } },
        ]),
        actor("a5", "own", 5, "BLOQ", { x: 82, y: 44 }, [
          { t: 4, pos: { x: 84, y: 47 } },
        ]),
        actor("a8", "own", 8, "REC", { x: 72, y: 42 }, [
          { t: 6, pos: { x: 76, y: 45 } },
        ]),
        actor("d4", "rival", 4, "DEF", { x: 84, y: 52 }, [
          { t: 5, pos: { x: 86, y: 54 } },
        ]),
        actor("d5", "rival", 5, "DEF", { x: 79, y: 45 }, [
          { t: 5, pos: { x: 82, y: 47 } },
        ]),
        actor("gk", "rival", 1, "GK", { x: 96, y: 50 }, [
          { t: 6, pos: { x: 95, y: 54 } },
        ]),
      ],
      ball: {
        start: { x: 92, y: 6, z: 0 },
        path: [
          { t: 4.8, pos: { x: 89, y: 59, z: 4.2 } },
          { t: 7.2, pos: { x: 76, y: 45, z: 1.1 } },
        ],
      },
      overlays: [
        {
          id: "ab1",
          type: "pass",
          from: "ej",
          to: { x: 89, y: 59 },
          start: 1,
          end: 5,
          label: "segundo palo",
          layer: "abp",
        },
        {
          id: "ab2",
          type: "run",
          from: "a9",
          to: { x: 91, y: 58 },
          start: 2.5,
          end: 7,
          label: "tarde",
          layer: "abp",
        },
        {
          id: "ab3",
          type: "cover",
          from: "a8",
          to: { x: 76, y: 45 },
          start: 4,
          end: 8,
          label: "rechace",
          layer: "cover",
        },
      ],
      zones: [
        {
          id: "za1",
          label: "2º palo",
          rect: { x: 86, y: 54, w: 10, h: 13 },
          color: "#f8d86a",
          layer: "abp",
          visibleInPhases: ["execution"],
        },
        {
          id: "za2",
          label: "rechace",
          rect: { x: 70, y: 38, w: 14, h: 13 },
          color: "#5eead4",
          layer: "cover",
          visibleInPhases: ["outcome"],
        },
      ],
      triggers: [
        {
          id: "trabp1",
          description: "Bloqueador ocupa trayectoria del defensor central",
          whenT: 3,
          cause: { actorId: "a5", action: "closedLateral" },
          activatesOverlays: ["ab2"],
        },
      ],
      phases: phases(10, ["abp", "cover"]),
    },
  },
];

const compactCuratedSpecs = [
  {
    id: "salida-3-1-pivote-sombra",
    title: "Salida 3+1 encontrando pivote a la espalda",
    phase: "attackOrg",
    principle: "salida limpia + tercer hombre",
    focus: "Fijar primera presion y soltar al pivote cuando aparece la sombra.",
  },
  {
    id: "presion-salto-lateral",
    title: "Presion coordinada con salto del lateral",
    phase: "defenseOrg",
    principle: "presion orientada a banda",
    focus: "Cerrar dentro y saltar cuando el pase viaja al lateral.",
  },
  {
    id: "transicion-primer-pase-seguro",
    title: "Transicion ofensiva con primer pase seguro",
    phase: "transOff",
    principle: "asegurar tras robo",
    focus: "Robar, pausar medio segundo y conectar al apoyo de cara.",
  },
  {
    id: "transicion-perdida-cinco-segundos",
    title: "Perdida y presion de cinco segundos",
    phase: "transDef",
    principle: "presion tras perdida",
    focus: "Achicar hacia pelota y negar el primer pase vertical.",
  },
  {
    id: "abp-falta-bloqueo-frontal",
    title: "ABP falta lateral con bloqueo frontal",
    phase: "abpOff",
    principle: "ABP segundo movimiento",
    focus: "Bloquear sin chocar y atacar zona frontal liberada.",
  },
  {
    id: "abp-defensa-zona-rechace",
    title: "ABP defensiva protegiendo rechace",
    phase: "abpDef",
    principle: "defensa de area + rechace",
    focus: "Ganar primer contacto y dejar un jugador perfilado para rechace.",
  },
  {
    id: "rondo-5v2-pared-interior",
    title: "Rondo 5v2 con pared interior",
    phase: "attackOrg",
    principle: "pared + apoyo interior",
    focus: "Usar pared corta para eliminar al defensor que salta.",
  },
  {
    id: "bloque-medio-trampa-pivote",
    title: "Bloque medio cerrando pase al pivote",
    phase: "defenseOrg",
    principle: "bloque medio compacto",
    focus: "Tapar pivote, orientar central hacia fuera y saltar en banda.",
  },
  {
    id: "ataque-cambio-orientacion-extremo",
    title: "Cambio de orientacion para extremo aislado",
    phase: "attackOrg",
    principle: "cambio de orientacion",
    focus: "Atraer por dentro y cambiar al extremo con ventaja corporal.",
  },
  {
    id: "finalizacion-centro-raso",
    title: "Finalizacion con centro raso atras",
    phase: "attackOrg",
    principle: "llegada a zona de remate",
    focus: "Atacar primer palo para liberar pase atras al interior.",
  },
  {
    id: "defensa-centro-lateral",
    title: "Defensa de centro lateral y segunda jugada",
    phase: "defenseOrg",
    principle: "defensa del area",
    focus:
      "Central ataca centro, lateral cierra segundo palo y pivote rechace.",
  },
  {
    id: "tercer-hombre-banda-derecha",
    title: "Tercer hombre en banda derecha",
    phase: "attackOrg",
    principle: "tercer hombre exterior",
    focus: "Fijar lateral, descargar de cara y lanzar ruptura exterior.",
  },
  {
    id: "presion-arquero-pase-atras",
    title: "Presion cuando el rival juega atras al arquero",
    phase: "defenseOrg",
    principle: "trigger arquero",
    focus: "Delantero curva carrera y extremos tapan centrales.",
  },
  {
    id: "salida-vs-doble-punta",
    title: "Salida contra doble punta",
    phase: "attackOrg",
    principle: "superioridad en primera linea",
    focus: "Separar centrales y usar mediocentro como hombre libre.",
  },
  {
    id: "contraataque-carril-central",
    title: "Contraataque por carril central con apoyos",
    phase: "transOff",
    principle: "progresion rapida",
    focus: "Primer pase vertical, apoyo de cara y ruptura al espacio.",
  },
  {
    id: "repliegue-temporizar-banda",
    title: "Repliegue temporizando en banda",
    phase: "transDef",
    principle: "temporizar y cerrar dentro",
    focus: "No robar de frente; orientar fuera hasta que llegue ayuda.",
  },
  {
    id: "abp-corner-corto-tercer-hombre",
    title: "Corner corto y tercer hombre frontal",
    phase: "abpOff",
    principle: "ABP corner corto",
    focus: "Atraer dos marcas y jugar de cara al remate frontal.",
  },
  {
    id: "abp-defensa-bloqueo-segundo-palo",
    title: "ABP defensiva contra bloqueo al segundo palo",
    phase: "abpDef",
    principle: "marcas y zona mixta",
    focus: "Comunicar bloqueo y proteger segundo palo con ventaja.",
  },
  {
    id: "posesion-6v3-hombre-libre",
    title: "Posesion 6v3 detectando hombre libre",
    phase: "attackOrg",
    principle: "hombre libre interior",
    focus: "Mover al bloque rival hasta que el interior reciba de cara.",
  },
  {
    id: "defensa-linea-pase-bloqueada",
    title: "Bloquear linea de pase al 9",
    phase: "defenseOrg",
    principle: "linea bloqueada",
    focus: "Central no persigue; perfila cuerpo y niega recepcion del 9.",
  },
] as const;

function compactCuratedExercises(): unknown[] {
  return compactCuratedSpecs.map((spec, index) => {
    const duration = 11 + (index % 4);
    const attacking = spec.phase === "attackOrg" || spec.phase === "transOff";
    const abp = spec.phase === "abpOff" || spec.phase === "abpDef";
    const xShift = (index % 5) * 2;
    const yShift = (index % 4) * 3;
    const ownStart = attacking ? 30 : 58;
    const targetX = attacking ? 72 : 40;
    const pitchMode = abp ? "third" : index % 3 === 0 ? "half" : "full";

    return {
      id: spec.id,
      title: spec.title,
      phase: spec.phase,
      principle: spec.principle,
      level: index % 2 === 0 ? "U16+" : "Amateur+",
      intensity:
        spec.phase === "transDef" || spec.phase === "defenseOrg"
          ? "high"
          : "med",
      rpe: spec.phase === "transDef" ? 8 : spec.phase === "abpDef" ? 5 : 6,
      density: spec.phase.startsWith("abp") ? 0.42 : 0.62,
      players: { min: abp ? 8 : 7, max: abp ? 10 : 9 },
      duration: abp ? 10 : 14,
      space: abp ? "tercio final y area" : "medio campo adaptado",
      material: [
        { name: "pelotas", qty: abp ? 10 : 6, unit: "u" },
        { name: "conos", qty: 8, unit: "u" },
        { name: "pecheras", qty: 2, unit: "colores" },
      ],
      objective: {
        primary: spec.focus,
        secondary: "Que la escena se entienda en una sola reproduccion.",
      },
      organization: abp
        ? "Rutina en tercio final con ejecutor, atacantes, defensores y jugador de rechace."
        : "Unidad reducida con superioridad contextual, oposicion activa y zona objetivo.",
      rules: [
        "La accion principal aparece despues del primer pase",
        "Si se pierde la pelota, reaccion inmediata de 3 segundos",
        "La jugada se reinicia si la distancia entre lineas se rompe",
      ],
      coaching: [
        spec.focus,
        attacking
          ? "El receptor debe perfilarse antes de que viaje la pelota"
          : "El defensor salta cuando la pelota viaja, no antes",
        "Priorizar timing y distancia, no velocidad sin sentido",
      ],
      errors: [
        "Correr antes de fijar al rival",
        "Recibir plano y sin escaneo previo",
        "Acumular jugadores sobre la pelota",
      ],
      success: attacking
        ? "Llegar a zona objetivo con pelota controlada en 6 de 10 acciones."
        : "Forzar pase atras, robo o despeje orientado en 6 de 10 acciones.",
      progressions: [
        "Limitar toques en el apoyo central",
        "Agregar defensor que pueda interceptar el pase clave",
      ],
      regressions: [
        "Defensor pasivo en el primer intento",
        "Aumentar dos metros el espacio de recepcion",
      ],
      scene: {
        duration,
        pitchMode,
        actors: [
          actor("o1", "own", 2, "AP", { x: ownStart, y: 24 + yShift }, [
            { t: duration * 0.58, pos: { x: ownStart + 8, y: 24 + yShift } },
          ]),
          actor("o2", "own", 6, "PIV", { x: ownStart + 8, y: 47 }, [
            { t: duration * 0.5, pos: { x: ownStart + 16, y: 48 } },
          ]),
          actor("o3", "own", 8, "INT", { x: ownStart + 18, y: 62 - yShift }, [
            { t: duration * 0.72, pos: { x: targetX - 8, y: 58 - yShift } },
          ]),
          actor("o4", "own", 10, "LIB", { x: ownStart + 24, y: 40 }, [
            { t: duration * 0.64, pos: { x: targetX, y: 40 + yShift } },
          ]),
          actor("o5", "own", 9, "FIN", { x: targetX - 4, y: 54 }, [
            { t: duration * 0.82, pos: { x: targetX + 8, y: 52 } },
          ]),
          actor("r1", "rival", 4, "DEF", { x: ownStart + 22 + xShift, y: 46 }, [
            { t: duration * 0.55, pos: { x: ownStart + 30, y: 48 } },
          ]),
          actor("r2", "rival", 5, "DEF", { x: targetX - 12, y: 58 }, [
            { t: duration * 0.76, pos: { x: targetX - 5, y: 54 } },
          ]),
        ],
        ball: {
          start: { x: ownStart, y: 24 + yShift, z: 0 },
          path: [
            { t: duration * 0.25, pos: { x: ownStart + 8, y: 47, z: 0.35 } },
            { t: duration * 0.5, pos: { x: ownStart + 24, y: 40, z: 0.45 } },
            { t: duration * 0.75, pos: { x: targetX, y: 40 + yShift, z: 0.5 } },
          ],
        },
        overlays: [
          {
            id: `${spec.id}-p1`,
            type: "pass",
            from: "o1",
            to: "o2",
            start: duration * 0.12,
            end: duration * 0.28,
            layer: "withBall",
          },
          {
            id: `${spec.id}-p2`,
            type: "pass",
            from: "o2",
            to: "o4",
            start: duration * 0.34,
            end: duration * 0.52,
            label: "clave",
            layer: "withBall",
          },
          {
            id: `${spec.id}-r1`,
            type: attacking ? "run" : "press",
            from: attacking ? "o5" : "r1",
            to: attacking ? { x: targetX + 8, y: 52 } : "o2",
            start: duration * 0.42,
            end: duration * 0.78,
            layer: attacking ? "withoutBall" : "press",
          },
          {
            id: `${spec.id}-c1`,
            type: spec.phase.startsWith("abp") ? "cover" : "lineBlocked",
            from: spec.phase.startsWith("abp") ? "o3" : "r2",
            to: spec.phase.startsWith("abp") ? { x: targetX - 4, y: 50 } : "o5",
            start: duration * 0.55,
            end: duration * 0.9,
            layer: spec.phase.startsWith("abp") ? "cover" : "rival",
          },
        ],
        zones: [
          {
            id: `${spec.id}-zone`,
            label: attacking ? "ventaja" : "trampa",
            rect: { x: targetX - 9, y: 34, w: 18, h: 24 },
            color: attacking ? "#5eead4" : "#f87171",
            layer: attacking ? "withoutBall" : "press",
            visibleInPhases: ["execution", "outcome"],
          },
        ],
        triggers: [
          {
            id: `${spec.id}-trigger`,
            description: attacking
              ? "El rival salta y aparece hombre libre"
              : "Pase orientado activa salto coordinado",
            whenT: duration * 0.45,
            cause: {
              actorId: attacking ? "o2" : "r1",
              action: attacking ? "receiveBack" : "closedLateral",
            },
            visualMarker: {
              pos: attacking
                ? { x: ownStart + 16, y: 48 }
                : { x: ownStart + 28, y: 48 },
              icon: "!",
            },
            activatesOverlays: [`${spec.id}-p2`, `${spec.id}-r1`],
          },
        ],
        phases: phases(duration, [
          "withBall",
          attacking ? "withoutBall" : "press",
          spec.phase.startsWith("abp") ? "abp" : "rival",
        ]),
      },
    };
  });
}

rawExercises.push(...extraExercises, ...compactCuratedExercises());

function validateCatalog(raw: unknown[]): Exercise[] {
  return raw.map((item, i) => {
    const result = ExerciseSchema.safeParse(item);
    if (!result.success) {
      console.error(`Ejercicio #${i} invlido:`, result.error.issues);
      throw new Error(`Catalog validation failed for entry #${i}`);
    }
    return result.data;
  });
}

export const catalog: Exercise[] = validateCatalog(rawExercises);
