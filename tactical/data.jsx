/* ===========================================================
   data.jsx — dominio mock de Tactical Lab Pro 3D
   Coordenadas de cancha en 0..100 (x = largo, y = ancho).
   =========================================================== */

const PLAYERS = [
  { id: "pl_1", name: "Tomás Álvarez", num: 1, pos: ["GK"], foot: "R", status: "available", profile: "Arquero iniciador, cómodo jugando corto.", attr: { vel: 58, res: 70, pas: 72, ctl: 68, pre: 30, due: 65, tac: 72 } },
  { id: "pl_2", name: "Nico Ferreyra", num: 2, pos: ["RB", "CB"], foot: "R", status: "available", profile: "Lateral profundo, ataca el carril exterior.", attr: { vel: 78, res: 82, pas: 66, ctl: 64, pre: 74, due: 68, tac: 69 } },
  { id: "pl_3", name: "Mateo Ruiz", num: 3, pos: ["LB", "WB"], foot: "L", status: "available", profile: "Lateral mixto para sostener o proyectar.", attr: { vel: 74, res: 80, pas: 70, ctl: 66, pre: 72, due: 66, tac: 71 } },
  { id: "pl_4", name: "Bruno Díaz", num: 4, pos: ["CB"], foot: "R", status: "available", profile: "Central de salida, pase vertical fiable.", attr: { vel: 60, res: 71, pas: 75, ctl: 70, pre: 52, due: 80, tac: 78 } },
  { id: "pl_5", name: "Iván Costa", num: 5, pos: ["CB", "CDM"], foot: "R", status: "doubt", profile: "Central corrector, fuerte en duelo.", attr: { vel: 67, res: 74, pas: 64, ctl: 62, pre: 58, due: 83, tac: 75 } },
  { id: "pl_6", name: "Santi Gómez", num: 6, pos: ["CDM", "CM"], foot: "R", status: "available", profile: "Pivote posicional, ordena alturas.", attr: { vel: 61, res: 79, pas: 77, ctl: 74, pre: 70, due: 72, tac: 82 } },
  { id: "pl_7", name: "Lucas Medina", num: 7, pos: ["RW", "ST"], foot: "R", status: "available", profile: "Extremo de ruptura, amenaza la espalda.", attr: { vel: 88, res: 77, pas: 66, ctl: 72, pre: 68, due: 55, tac: 67 } },
  { id: "pl_8", name: "Facu Romero", num: 8, pos: ["CM", "CDM"], foot: "R", status: "available", profile: "Interior mixto, timing de tercer hombre.", attr: { vel: 70, res: 86, pas: 80, ctl: 78, pre: 76, due: 69, tac: 80 } },
  { id: "pl_9", name: "Diego Lamas", num: 9, pos: ["ST", "CAM"], foot: "R", status: "available", profile: "9 de apoyo, descarga y ataca el área.", attr: { vel: 72, res: 73, pas: 68, ctl: 76, pre: 71, due: 75, tac: 77 } },
  { id: "pl_10", name: "Julián Vera", num: 10, pos: ["CAM", "CM"], foot: "L", status: "available", profile: "Conector creativo, recibe entre líneas.", attr: { vel: 69, res: 72, pas: 84, ctl: 86, pre: 60, due: 52, tac: 79 } },
  { id: "pl_11", name: "Lautaro Silva", num: 11, pos: ["LW", "RW"], foot: "L", status: "available", profile: "Extremo al pie, pausa antes del pase.", attr: { vel: 82, res: 74, pas: 71, ctl: 80, pre: 66, due: 58, tac: 70 } },
  { id: "pl_12", name: "Juan Pérez", num: 12, pos: ["GK"], foot: "R", status: "injured", profile: "Arquero suplente, minutos controlados.", attr: { vel: 55, res: 66, pas: 60, ctl: 60, pre: 25, due: 60, tac: 62 } },
  { id: "pl_14", name: "Emi Castro", num: 14, pos: ["CM", "CAM"], foot: "R", status: "available", profile: "Box-to-box de relevo, llega al área.", attr: { vel: 75, res: 88, pas: 74, ctl: 72, pre: 80, due: 70, tac: 73 } },
  { id: "pl_16", name: "Tobías Núñez", num: 16, pos: ["CB", "RB"], foot: "R", status: "suspended", profile: "Central agresivo en el salto a la presión.", attr: { vel: 71, res: 76, pas: 62, ctl: 60, pre: 78, due: 81, tac: 70 } },
];

const STATUS_LABEL = { available: "Disponible", doubt: "En duda", injured: "Lesionado", suspended: "Suspendido" };

/* ---- formación titular (4-3-3) en coords 0..100 (defendemos hacia x=0) ---- */
const LINEUP_433 = [
  { slot: "GK", x: 7, y: 50, playerId: "pl_1" },
  { slot: "RB", x: 24, y: 84, playerId: "pl_2" },
  { slot: "CB", x: 18, y: 62, playerId: "pl_4" },
  { slot: "CB", x: 18, y: 38, playerId: "pl_5" },
  { slot: "LB", x: 24, y: 16, playerId: "pl_3" },
  { slot: "CDM", x: 38, y: 50, playerId: "pl_6" },
  { slot: "CM", x: 50, y: 70, playerId: "pl_8" },
  { slot: "CAM", x: 52, y: 32, playerId: "pl_10" },
  { slot: "RW", x: 76, y: 84, playerId: "pl_7" },
  { slot: "ST", x: 82, y: 50, playerId: "pl_9" },
  { slot: "LW", x: 76, y: 16, playerId: "pl_11" },
];

const LINEUP_4231 = [
  { slot: "GK", x: 7, y: 50, playerId: "pl_1" },
  { slot: "RB", x: 26, y: 84, playerId: "pl_2" },
  { slot: "CB", x: 17, y: 62, playerId: "pl_4" },
  { slot: "CB", x: 17, y: 38, playerId: "pl_5" },
  { slot: "LB", x: 26, y: 16, playerId: "pl_3" },
  { slot: "CDM", x: 36, y: 60, playerId: "pl_6" },
  { slot: "CDM", x: 36, y: 40, playerId: "pl_8" },
  { slot: "CAM", x: 58, y: 50, playerId: "pl_10" },
  { slot: "RW", x: 70, y: 82, playerId: "pl_7" },
  { slot: "ST", x: 84, y: 50, playerId: "pl_9" },
  { slot: "LW", x: 70, y: 18, playerId: "pl_11" },
];

const SHAPES = {
  "4-3-3": LINEUP_433,
  "4-2-3-1": LINEUP_4231,
};

/* ---- helpers de actor / overlay ---- */
const A = (id, team, num, role, start, path = []) => ({ id, team, num, role, start, path });

/* ===========================================================
   EJERCICIOS — escenas con keyframes
   =========================================================== */
const EXERCISES = [
  {
    id: "salida-433-vs-press",
    title: "Salida 4-3-3 ante presión alta",
    phase: "attackOrg",
    phaseLabel: "Organización ofensiva",
    principle: "Atraer y romper la primera línea",
    level: "1er equipo",
    intensity: "high",
    rpe: 6,
    players: { min: 11, max: 14 },
    duration: 12,
    space: "Medio campo + zona de salida",
    objective: { primary: "Progresar por dentro tras fijar la primera presión rival y liberar al pivote." },
    success: "3 salidas limpias al hombre libre entre líneas en 4 minutos.",
    coaching: ["Pivote perfilado antes de recibir", "El central conduce para fijar al 9 rival", "Interior baja a generar superioridad"],
    scene: {
      duration: 12,
      camera: "broadcast",
      phases: [
        { id: "setup", name: "Setup", start: 0, end: 3.4 },
        { id: "execution", name: "Ejecución", start: 3.4, end: 8.6 },
        { id: "outcome", name: "Resultado", start: 8.6, end: 12 },
      ],
      actors: [
        A("o1", "own", 1, "GK", { x: 7, y: 50 }, [{ t: 2, pos: { x: 9, y: 50 } }, { t: 6, pos: { x: 9, y: 40 } }]),
        A("o4", "own", 4, "CB", { x: 18, y: 60 }, [{ t: 3, pos: { x: 24, y: 58 } }, { t: 6, pos: { x: 30, y: 56 } }]),
        A("o5", "own", 5, "CB", { x: 18, y: 40 }, [{ t: 4, pos: { x: 22, y: 36 } }]),
        A("o2", "own", 2, "RB", { x: 30, y: 86 }, [{ t: 5, pos: { x: 44, y: 88 } }, { t: 9, pos: { x: 58, y: 88 } }]),
        A("o3", "own", 3, "LB", { x: 30, y: 14 }, [{ t: 5, pos: { x: 42, y: 12 } }]),
        A("o6", "own", 6, "CDM", { x: 38, y: 50 }, [{ t: 3, pos: { x: 36, y: 56 } }, { t: 7, pos: { x: 46, y: 50 } }]),
        A("o8", "own", 8, "CM", { x: 50, y: 70 }, [{ t: 4, pos: { x: 44, y: 64 } }, { t: 8, pos: { x: 56, y: 60 } }]),
        A("o10", "own", 10, "CAM", { x: 54, y: 36 }, [{ t: 6, pos: { x: 50, y: 44 } }, { t: 9, pos: { x: 60, y: 46 } }]),
        A("o7", "own", 7, "RW", { x: 74, y: 86 }, [{ t: 8, pos: { x: 80, y: 80 } }]),
        A("o9", "own", 9, "ST", { x: 82, y: 50 }, [{ t: 7, pos: { x: 78, y: 44 } }]),
        A("o11", "own", 11, "LW", { x: 74, y: 14 }, [{ t: 8, pos: { x: 82, y: 20 } }]),
        // rival press
        A("r9", "rival", 9, "ST", { x: 30, y: 50 }, [{ t: 3, pos: { x: 24, y: 56 } }, { t: 6, pos: { x: 30, y: 54 } }]),
        A("r7", "rival", 7, "RW", { x: 34, y: 24 }, [{ t: 4, pos: { x: 28, y: 30 } }]),
        A("r11", "rival", 11, "LW", { x: 34, y: 76 }, [{ t: 4, pos: { x: 40, y: 82 } }]),
        A("r8", "rival", 8, "CM", { x: 48, y: 56 }, [{ t: 6, pos: { x: 42, y: 54 } }]),
        A("r6", "rival", 6, "CDM", { x: 50, y: 44 }, [{ t: 7, pos: { x: 48, y: 48 } }]),
      ],
      ball: {
        start: { x: 7, y: 50 },
        path: [
          { t: 2, pos: { x: 18, y: 60 }, carrier: "o4" },
          { t: 5, pos: { x: 30, y: 56 }, carrier: "o4" },
          { t: 6.4, pos: { x: 36, y: 56 }, carrier: "o6" },
          { t: 8, pos: { x: 46, y: 50 }, carrier: "o6" },
          { t: 9.2, pos: { x: 56, y: 60 }, carrier: "o8" },
          { t: 11, pos: { x: 60, y: 46 }, carrier: "o10" },
        ],
      },
      overlays: [
        { type: "pass", from: { x: 9, y: 50 }, to: { x: 18, y: 60 }, start: 1.5, end: 2.6 },
        { type: "run", from: { x: 38, y: 50 }, to: { x: 46, y: 50 }, start: 5.5, end: 7.5, label: "libera" },
        { type: "pass", from: { x: 30, y: 56 }, to: { x: 46, y: 50 }, start: 6, end: 7.6, label: "vertical" },
        { type: "press", from: { x: 30, y: 50 }, to: { x: 24, y: 56 }, start: 2.5, end: 5 },
        { type: "pass", from: { x: 46, y: 50 }, to: { x: 60, y: 46 }, start: 9, end: 10.6, label: "entre líneas" },
      ],
      zones: [
        { x: 40, y: 28, w: 24, h: 44, label: "zona objetivo", phases: ["execution", "outcome"] },
      ],
    },
  },
  {
    id: "rondo-4v2-cambio",
    title: "Rondo 4v2 a dos zonas con cambio vertical",
    phase: "transOff",
    phaseLabel: "Transición ofensiva",
    principle: "Atraer presión y cambiar de zona",
    level: "U17+",
    intensity: "high",
    rpe: 7,
    players: { min: 8, max: 8 },
    duration: 11,
    space: "2 zonas de 16×16 m",
    objective: { primary: "Conservar y cambiar rápido a la zona opuesta tras atraer la presión." },
    success: "5 cambios de zona en 3 minutos con primer control orientado.",
    coaching: ["Atraer antes de cambiar", "Apoyo destino perfilado antes del pase", "Reaccionar 5 m hacia la pérdida"],
    scene: {
      duration: 11,
      camera: "top",
      phases: [
        { id: "setup", name: "Setup", start: 0, end: 3 },
        { id: "execution", name: "Ejecución", start: 3, end: 8 },
        { id: "outcome", name: "Resultado", start: 8, end: 11 },
      ],
      actors: [
        A("a1", "own", 4, "AP", { x: 20, y: 30 }, [{ t: 5, pos: { x: 24, y: 30 } }]),
        A("a2", "own", 6, "AP", { x: 38, y: 22 }, [{ t: 4, pos: { x: 42, y: 26 } }]),
        A("a3", "own", 8, "AP", { x: 38, y: 50 }, [{ t: 7, pos: { x: 41, y: 52 } }]),
        A("a4", "own", 10, "AP", { x: 20, y: 60 }, [{ t: 8, pos: { x: 25, y: 60 } }]),
        A("d1", "rival", 2, "DEF", { x: 29, y: 40 }, [{ t: 4, pos: { x: 36, y: 30 } }, { t: 8, pos: { x: 46, y: 46 } }]),
        A("d2", "rival", 3, "DEF", { x: 32, y: 52 }, [{ t: 5, pos: { x: 37, y: 48 } }, { t: 9, pos: { x: 49, y: 52 } }]),
        A("t1", "own", 7, "DEST", { x: 72, y: 34 }, [{ t: 9, pos: { x: 77, y: 36 } }]),
        A("t2", "own", 11, "DEST", { x: 72, y: 60 }, [{ t: 10, pos: { x: 78, y: 56 } }]),
      ],
      ball: {
        start: { x: 20, y: 30 },
        path: [
          { t: 2, pos: { x: 38, y: 22 }, carrier: "a2" },
          { t: 4, pos: { x: 38, y: 50 }, carrier: "a3" },
          { t: 7, pos: { x: 72, y: 34 }, carrier: "t1" },
          { t: 10, pos: { x: 72, y: 60 }, carrier: "t2" },
        ],
      },
      overlays: [
        { type: "pass", from: { x: 20, y: 30 }, to: { x: 38, y: 22 }, start: 0.5, end: 2 },
        { type: "press", from: { x: 29, y: 40 }, to: { x: 38, y: 22 }, start: 2, end: 5 },
        { type: "pass", from: { x: 38, y: 50 }, to: { x: 72, y: 34 }, start: 5.5, end: 7.4, label: "cambio" },
        { type: "run", from: { x: 72, y: 60 }, to: { x: 78, y: 56 }, start: 8, end: 10 },
      ],
      zones: [
        { x: 8, y: 14, w: 32, h: 56, label: "zona A", phases: ["setup", "execution"] },
        { x: 60, y: 22, w: 32, h: 48, label: "zona B destino", phases: ["execution", "outcome"] },
      ],
    },
  },
];

/* ===========================================================
   SESIÓN + MICROCICLO
   =========================================================== */
const SESSION = {
  name: "MD-3 · Construcción vs presión",
  date: "Mié 28 May",
  blocks: [
    { id: "b1", title: "Activación + rondo 4v2", exerciseId: "rondo-4v2-cambio", min: 18, load: "med" },
    { id: "b2", title: "Salida 4-3-3 ante presión", exerciseId: "salida-433-vs-press", min: 24, load: "high" },
    { id: "b3", title: "Juego de posición 8v8+3", exerciseId: null, min: 22, load: "high" },
    { id: "b4", title: "Finalización + ABP ofensiva", exerciseId: null, min: 16, load: "med" },
  ],
};

const MICROCYCLE = [
  { day: "MD+1", focus: "Recuperación", load: 18, kind: "regen" },
  { day: "MD-4", focus: "Fuerza + posesión", load: 78, kind: "high" },
  { day: "MD-3", focus: "Construcción vs presión", load: 92, kind: "high", active: true },
  { day: "MD-2", focus: "Transiciones + ABP", load: 64, kind: "med" },
  { day: "MD-1", focus: "Activación + set pieces", load: 32, kind: "low" },
  { day: "MD", focus: "Partido · vs Atlético Norte", load: 100, kind: "match" },
];

const MICRO_ALERTS = [
  { level: "warn", text: "MD-3 acumula 92% de carga: pico semanal. Vigilar volumen del bloque 3." },
  { level: "info", text: "Iván Costa (5) en duda — preparar alternativa de central para el XI." },
  { level: "info", text: "Densidad de ABP baja esta semana. Sugerido sumar 8' en MD-2." },
];

/* ===========================================================
   ASISTENTE IA — contexto + conversación
   =========================================================== */
const AI_CONTEXT = [
  { k: "Equipo", v: "1er equipo · 4-3-3" },
  { k: "Shape actual", v: "Salida asimétrica, LI interior" },
  { k: "Memoria", v: "14 principios estables" },
  { k: "Reports", v: "3 post-partido recientes" },
  { k: "Disponibles", v: "12 / 14 jugadores" },
  { k: "Rival", v: "Atlético Norte · 4-4-2 presión" },
];

const AI_THREAD = [
  {
    role: "Cuerpo técnico",
    who: "user",
    text: "El rival nos presiona 4-4-2 con los dos delanteros sobre los centrales. ¿Cómo saco la pelota limpia desde el fondo?",
  },
  {
    role: "Asistente táctico",
    who: "coach",
    lectura: "Con un 4-4-2 que presiona a los centrales en 2v2 y deja al pivote vigilado por un volante, la superioridad la generás bajando un interior o saliendo con el lateral por dentro. Tu fortaleza es Vera (10) recibiendo entre líneas y Romero (8) con timing de tercer hombre.",
    advice: [
      "Bajá al 6 (Gómez) entre centrales para formar un 3 de salida y obligar a que un delantero rival elija. Eso libera a un central para conducir.",
      "Subí los laterales altos y meté al lateral izquierdo por dentro: rompés la línea de 4 del rival y generás un pasillo interior para Vera.",
      "Buscá el tercer hombre: central conduce → fija → pase al 6 de cara → descarga a interior. No forzar el vertical si no apareció la fijación.",
    ],
    riesgo: "Si perdés en zona de salida quedás 4v4 con campo a la espalda. Dejá a un interior como seguro de reacción los primeros 5 metros.",
  },
];

/* ===========================================================
   VIDEO — tags + tracking manual
   =========================================================== */
const VIDEO_TAGS = [
  { id: "vt1", t: 12, label: "Pérdida en salida", color: "#fb7185", cat: "error" },
  { id: "vt2", t: 38, label: "Cambio de orientación", color: "#5eead4", cat: "build" },
  { id: "vt3", t: 64, label: "Presión tras pérdida", color: "#fbbf24", cat: "press" },
  { id: "vt4", t: 91, label: "Llegada de interior", color: "#60a5fa", cat: "attack" },
  { id: "vt5", t: 118, label: "ABP a favor", color: "#a3e635", cat: "abp" },
];
const VIDEO_TAG_BUTTONS = [
  { label: "Salida", color: "#5eead4" },
  { label: "Presión", color: "#fbbf24" },
  { label: "Transición -", color: "#fb7185" },
  { label: "Transición +", color: "#60a5fa" },
  { label: "ABP", color: "#a3e635" },
  { label: "Duelo", color: "#c084fc" },
];
// trayectoria de tracking manual (puntos clickeados, 0..100)
const TRACK_PATH = [
  { x: 22, y: 60 }, { x: 31, y: 57 }, { x: 39, y: 58 }, { x: 47, y: 52 },
  { x: 55, y: 49 }, { x: 63, y: 53 }, { x: 70, y: 47 }, { x: 78, y: 44 },
];

/* ===========================================================
   POST-PARTIDO
   =========================================================== */
const POST_MATCH = {
  rival: "Atlético Norte",
  date: "Jornada 18 · 24 May",
  scoreUs: 2, scoreThem: 1,
  venue: "Local",
  formationUs: "4-3-3", formationThem: "4-4-2",
  control: "Control del juego en campo rival la mayor parte del 2T",
  control: "Control del juego en campo rival la mayor parte del 2T",
  summary: "Arrancamos incómodos ante su 4-4-2: los dos delanteros tapaban a los centrales y salíamos en largo, regalando la segunda pelota. El partido cambió cuando el 6 empezó a caer entre los centrales: ahí dejamos de jugar en largo y progresamos por dentro con criterio, de donde nacen el 1-0 y el 2-0. El gol en contra llega de una pérdida en zona de creación con los laterales muy altos y nadie cubriendo la espalda.",
  strengths: [
    "La salida cambió por completo cuando bajó el 6 entre centrales: el equipo dejó de patear en largo y empezó a construir por dentro.",
    "Vera entre líneas fue determinante: cada vez que el lateral izquierdo entró por dentro le abrió el pasillo para recibir de cara y girar.",
  ],
  issues: [
    "Los primeros 20' jugamos incómodos: ante su presión salíamos en largo sin disputar bien la segunda pelota.",
    "Con los laterales tan altos quedábamos expuestos a la espalda. Faltó un seguro de reacción tras pérdida — de ahí nace el gol rival.",
  ],
  proposals: [
    { title: "Automatizar la salida con el 6 que baja", detail: "Que el pivote caiga entre centrales por defecto ante presión 2v2, no como reacción tardía. Fijarlo como patrón de salida hasta que salga solo.", action: "Ver ejercicio: Salida 4-3-3 ante presión", to: "viewer" },
    { title: "Definir el seguro de reacción tras pérdida", detail: "Que un interior no salte al ataque y quede de tapón los primeros segundos. Trabajar la reacción inmediata de los 5 metros en transición defensiva.", action: "Crear ejercicio de transición −", to: "viewer" },
    { title: "Diseñar el pasillo interior para Vera", detail: "Estructurar la salida para que el LI entre por dentro y abra la línea de pase a Vera entre líneas. Ensayarlo en juego de posición esta semana.", action: "Agregar a la sesión de MD-2", to: "viewer" },
  ],
  memoryCandidates: [
    { id: "mc1", text: "Ante 4-4-2 con presión a los centrales, bajar al 6 entre centrales libera la salida de forma fiable.", confidence: "alta" },
    { id: "mc2", text: "Vera rinde como conector entre líneas cuando el LI entra por dentro y le abre el pasillo interior.", confidence: "alta" },
    { id: "mc3", text: "Con laterales altos necesitamos un interior como seguro de reacción los primeros 5 metros tras pérdida.", confidence: "media" },
  ],
};

const REPORT_HISTORY = [
  { id: "rh1", rival: "Atlético Norte", score: "2-1", result: "win", date: "24 May", saved: true },
  { id: "rh2", rival: "Defensores Sur", score: "1-1", result: "draw", date: "17 May", saved: true },
  { id: "rh3", rival: "Racing Este", score: "0-2", result: "loss", date: "10 May", saved: true },
];

const STABLE_MEMORY = [
  "Preferimos progresar por dentro antes que por fuera cuando hay superioridad central.",
  "El bloque defensivo arranca medio-bajo y salta a presión con el pase al lateral rival.",
  "En ABP defensiva mezclamos zona + 2 al hombre sobre sus referencias aéreas.",
];

Object.assign(window, {
  PLAYERS, STATUS_LABEL, SHAPES, LINEUP_433, LINEUP_4231,
  EXERCISES, SESSION, MICROCYCLE, MICRO_ALERTS,
  AI_CONTEXT, AI_THREAD, VIDEO_TAGS, VIDEO_TAG_BUTTONS, TRACK_PATH,
  POST_MATCH, REPORT_HISTORY, STABLE_MEMORY,
});
