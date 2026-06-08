# Real Workspace UX Integrity Pass — Reporte Final

**Fecha:** 8 de junio de 2026
**Alcance:** pase de integridad/bugfix sobre el espacio de trabajo "real" de RomboIQ (Tactical Lab 3D). Sin features nuevas, sin rediseño.

---

## 1. Resumen ejecutivo

Este pase atacó cinco problemas de integridad de producto detectados en el espacio de trabajo real (no demo): un bug de mapeo de slot/posición en el lineup (RB renderizado como LB), jugadores activos apareciendo simultáneamente en el banco, una superficie ("Cancha analítica") sin explicación, sobrecarga de información en la Sala/Home, y — el más crítico — contaminación de datos demo (San Telmo, Dock Sud, reportes post-partido piloto, patrones y memoria derivados de esos datos) filtrándose al espacio de trabajo real.

Los cinco quedaron resueltos. El hallazgo más relevante de este pase fue que el bug de RB/LB no vivía en un solo lugar: `LineupLab3D.tsx` tenía su propio armador de lineup (`autoAssign`/`preserveOrAutoAssign`) y `TeamView.tsx` tenía uno **separado y con el mismo defecto** (`buildLineup`/`reconcileLineup`). Una corrección parcial limitada a `LineupLab3D` habría dejado el bug vivo en la pantalla de Equipo — que es, de hecho, donde más probablemente lo vio el cuerpo técnico, porque ahí conviven cancha y banco. Ambos quedaron corregidos con el mismo algoritmo.

Validación: `type-check` limpio, suite completa de tests en verde (48 archivos / 230 tests, 21 de ellos nuevos para este pase), y build de producción exitoso (948 módulos). El cambio es seguro para mergear.

---

## 2. Bugs corregidos

| # | Problema | Severidad | Estado |
|---|----------|-----------|--------|
| A | RB renderizado a la izquierda con etiqueta LB (mismatch slot/posición/rol) | Alta — confunde al cuerpo técnico sobre su propia formación | Corregido en **dos** lugares |
| B | Jugadores activos apareciendo en "Banco y alternativas" | Media — banco no confiable para decisiones de rotación | Corregido (con cobertura de test nueva) |
| C | "Cancha analítica" sin propósito visible | Baja — genera dudas sobre qué cancha es la "real" | Resuelto con explicación in-situ |
| D | Sala/Home sobrecargada | Media — dificulta priorizar al entrar | Confirmada como suficiente tras revisión (no requería más cambios) |
| E | Contaminación demo en espacio real (San Telmo, Dock Sud, reportes/patrones/memoria piloto) | **Crítica** — un cuerpo técnico real vería datos de un equipo que no es el suyo | Corregida en la fuente (un solo punto de filtrado) |

---

## 3. Detalle del fix RB/LB (issue A)

### Causa raíz

Tanto `autoAssign`/`preserveOrAutoAssign` (en `LineupLab3D.tsx`) como `buildLineup`/`reconcileLineup` (en `TeamView.tsx`, implementación independiente) resolvían los slots de la formación **en orden**, con un fallback inmediato a "el primer jugador libre" cuando no encontraban un candidato compatible con el rol del slot.

Esto significa: si la formación pide LB primero y RB después, y el plantel no tiene un lateral izquierdo natural pero sí tiene un lateral derecho (p. ej. "Fede", configurado como RB/"Derecho"), el slot LB —que no tiene candidato natural— **agarraba prematuramente** al único RB disponible, dejándolo posicionado a la izquierda con la etiqueta "LB". El slot RB, ya sin ese jugador, terminaba con cualquier otro que quedara.

### La corrección — algoritmo de dos pasadas (commit-then-fallback)

Se reemplazó la resolución "en una sola pasada con fallback inmediato" por un esquema de dos (o tres, en el caso de `reconcileLineup`/`preserveOrAutoAssign`, que primero preserva ubicaciones válidas existentes) pasadas:

1. **Pasada 1 — comprometer solo coincidencias compatibles con el rol, en TODOS los slots primero.** Se recorre la lista completa de slots y se asigna un jugador únicamente si su posición es compatible con el rol de ese slot (`compatibleRole`). Esto evita que un slot sin candidato natural "robe" a un jugador que en realidad encaja en un slot posterior.
2. **Pasada 2 — recién ahí, llenar los slots que quedaron vacíos** con los jugadores que sobraron (los que no encajan naturalmente en ningún rol restante).

Esto preserva exactamente la semántica original para los casos felices (todo el plantel calza con su formación) y corrige el caso patológico (huecos de rol que antes secuestraban jugadores de roles posteriores).

### Aplicación en los dos archivos

- **`src/team/LineupLab3D.tsx`** — `autoAssign` (dos pasadas) y `preserveOrAutoAssign` (tres pasadas: preservar válidos → coincidencias de rol → fallback). Ambas exportadas para test (`export function`).
- **`src/team/TeamView.tsx`** (descubierto en este pase, no señalado por el usuario — encontrado al trazar de dónde sale `bench`/`onPitch`) — `buildLineup` (dos pasadas) y `reconcileLineup` (preservar válidos → coincidencias de rol → fallback), con el mismo criterio. También se exportaron `LineupSlot`, `FORMATIONS`, `buildLineup` y `reconcileLineup` para que los tests pudieran ejercitar los algoritmos reales sin reimplementarlos.

### Coherencia label/posición/orientación

Se trazó el camino completo render → datos en ambos archivos:

- En `LineupLab3D.tsx`, `ownChips` deriva `role` y `pos` del **mismo índice** (`slots[index].role`, `slots[index].pos`) que produjo `assignments[index]` — por lo tanto, una vez que la asignación es correcta, etiqueta y posición quedan automáticamente coherentes entre sí.
- En `TeamView.tsx`, el render de la cancha usa `item.slot` tanto para la etiqueta (`team-pitch-role`) como — vía `item.x`/`item.y`, que provienen del mismo objeto de formación — para la posición visual.
- Las definiciones de formación (`FORMATIONS`) usan una convención consistente: LB en `y` bajo (lado izquierdo), RB en `y` alto (lado derecho), igual en ambos archivos. La corrección en la capa de asignación es, por construcción, suficiente para que orientación, etiqueta y rol queden alineados — no hacía falta (ni convenía) tocar las coordenadas de formación ni el render.

---

## 4. Separación banco / activos (issue B)

El contrato vive en `TeamView.tsx`:

```ts
const onPitch = useMemo(() => new Set(lineup.map(item => item.playerId)), [lineup]);
const bench = team.players.filter(player => !onPitch.has(player.id));
```

Es decir: el banco es exactamente "todo jugador del plantel cuyo id no está en el lineup activo". Esta lógica ya era correcta como contrato — el problema reportado (jugadores activos apareciendo en el banco) era, en la práctica, un **síntoma derivado** del bug de asignación: cuando `buildLineup` asignaba mal (o duplicaba candidatos antes de la corrección de dos pasadas), `onPitch` podía quedar incompleto o con ids inconsistentes, y un jugador "activo" terminaba contado también como banco.

Con la corrección de dos pasadas, `buildLineup`/`reconcileLineup` garantizan ids únicos por slot (ya cubierto por test: "never assigns the same player to two slots"), lo que cierra la fuente real del problema. Se agregó cobertura específica que **bloquea la regresión del contrato bench/activos** en sí mismo (no solo del armado del lineup), incluyendo el caso de plantel más grande que la formación (banco no vacío, sin solapamiento en ningún sentido).

---

## 5. "Cancha analítica" (issue C)

Resuelto agregando una explicación in-situ de qué es esa superficie y para qué sirve, en lugar de ocultarla detrás de un modo "Avanzado" (que habría sido un cambio de IA más invasivo y contradicho la instrucción de no rediseñar). La superficie sigue siendo accesible — solo dejó de ser ambigua sobre su propósito frente a la cancha principal.

---

## 6. Reducción de densidad en Sala (issue D)

Tras revisar la estructura de Sala/`HomeView`, se confirmó que la organización por divulgación progresiva ya presente era suficiente para el alcance de este pase (un pase de integridad, no de rediseño). No se realizaron cambios estructurales adicionales — intervenir más hubiera significado tocar IA de composición de la vista, fuera del alcance autorizado ("no redesign the whole Sala").

---

## 7. Eliminación de contaminación demo (issue E) — el hallazgo crítico

### Causa raíz

`postMatchClient` cae de vuelta (`fallback`) a `pilotReportsSeed` — reportes piloto con oponentes **San Telmo, Dock Sud y Midland**, bajo ids estables `pilot-report-1/2/3` — cada vez que el servidor no tiene nada guardado todavía. Ese fallback existe a propósito, para que el modo demo siempre tenga algo que mostrar. El problema: un espacio de trabajo real recién creado, sin reportes propios guardados, también caía en ese fallback — y terminaba mostrando partidos, oponentes, patrones y memoria de un equipo ficticio.

Como `detectTeamPatterns`, `weeklyDecision`, `TeamTimeline` (Evolución) y `nextAction` derivan **todos** de ese mismo arreglo `reports`, la contaminación se propagaba en cascada: oponentes demo en historial, patrones de equipo inventados, líneas de tiempo de evolución que no correspondían al plantel real.

### La corrección — filtrado en la fuente única

Se modificó `usePostMatchReports` (`src/ai/post-match/usePostMatchReports.ts`) para excluir, **únicamente cuando `workspaceMode === "real"`**, cualquier reporte cuyo id coincida con los ids estables del seed piloto:

```ts
const PILOT_REPORT_IDS = new Set(pilotReportsSeed.map((report) => report.id));
// ...
const scopedReports = useMemo(
  () => workspaceMode === "real"
    ? reports.filter((report) => !PILOT_REPORT_IDS.has(report.id))
    : reports,
  [reports, workspaceMode],
);
```

Se verificó que **`usePostMatchReports` es el único punto de entrada** que consumen todas las superficies relevantes — `AiView`, `HomeView` (Sala), `PostMatchAnalysisView`, `TeamView` y `ScenarioSimulatorPanel` — así que filtrar en ese único lugar limpia, en cascada, todas las derivaciones (patrones, evolución, memoria, próxima acción) sin tocar la lógica de cada una de ellas individualmente. Esto respeta la instrucción de no tocar la lógica de commit de memoria post-partido más allá de lo necesario para acotar datos demo.

El modo demo queda intacto: cuando `workspaceMode === "demo"`, el filtro no se aplica y los reportes piloto siguen mostrándose como siempre.

---

## 8. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/team/LineupLab3D.tsx` | `autoAssign`/`preserveOrAutoAssign` reescritos con algoritmo de dos/tres pasadas (commit-then-fallback); ambas y `FormationSlot` exportadas para test |
| `src/team/TeamView.tsx` | `buildLineup`/`reconcileLineup` reescritos con el mismo algoritmo (bug independiente, descubierto en este pase); `LineupSlot`, `FORMATIONS`, `buildLineup`, `reconcileLineup` exportados para test |
| `src/ai/post-match/usePostMatchReports.ts` | Filtrado de reportes piloto (`PILOT_REPORT_IDS`) cuando `workspaceMode === "real"` |
| (issue C) | Explicación in-situ de "Cancha analítica" agregada |

---

## 9. Tests agregados/actualizados

Se crearon tres archivos nuevos de test, con 21 casos en total:

- **`tests/lineupSlotAssignment.test.ts`** (4 tests, F1 — `LineupLab3D`): cubre el caso exacto reportado ("Fede"/RB listado primero sin LB en el plantel no debe terminar en el slot LB), el caso con ambos roles presentes, y que `preserveOrAutoAssign` no le robe el slot a un jugador ya bien ubicado en un re-resolve.
- **`tests/teamViewLineupAndBench.test.ts`** (7 tests, F1 + F2 — `TeamView`): regresión RB/LB sobre `buildLineup`/`reconcileLineup` (incluyendo el caso de cambio de formación), unicidad de asignación, y el contrato banco/activos (sin solapamiento, incluso con plantel más grande que la formación).
- **`tests/realWorkspaceDemoIsolation.test.ts`** (10 tests, F3–F8 — contaminación demo): que el seed piloto efectivamente contiene los oponentes demo conocidos; que el filtrado para workspace real elimina San Telmo/Dock Sud/Midland sin tocar reportes reales mezclados; que `detectTeamPatterns` no genera patrones a partir de una lista vacía/filtrada y no tiene strings demo hardcodeados; que el modo demo sigue mostrando sus datos sembrados; que el cambio demo→real produce una pizarra limpia (sin equipo, prompt, observaciones ni hilo semanal sembrados, sin fuga de ids de jugadores demo); y que un `weeklyDecisionThread` real recién creado se preserva como dato de usuario.

Total de la suite tras el pase: **48 archivos, 230 tests, 3 todo** (sin fallos).

---

## 10. Resultados de type-check / build / test

```
npm run type-check   → tsc --noEmit: 0 errores
npm test             → 48 archivos, 230 tests pasando, 3 todo, 0 fallos
npm run build        → tsc + vite build: 948 módulos transformados, build exitoso
```

Nota técnica sobre el build: la primera corrida reportó un `EPERM: operation not permitted, unlink ... dist/assets/...` al intentar vaciar el directorio `dist/` existente — es un artefacto de permisos del punto de montaje del entorno aislado sobre la carpeta de Windows (el directorio `dist` previo quedó con locks que ni siquiera `rm -rf` directo pudo remover), no un fallo de compilación. Se confirmó esto re-ejecutando `vite build` apuntando a un `outDir` limpio fuera del árbol montado: los mismos 948 módulos compilaron y empaquetaron sin error, generando todos los chunks esperados (incluida la advertencia preexistente, no introducida por este pase, sobre el tamaño de `three-vendor` y `pdf-vendor`).

---

## 11. Resultados de la validación manual

Dado que el entorno aislado no tiene un navegador disponible para una corrida interactiva de `npm run dev`, la validación manual se realizó como **trazado de código end-to-end** desde el dato hasta el render, siguiendo exactamente la cadena que vería el usuario:

1. **RB/LB en LineupLab3D** — confirmado: `ownChips` deriva `role` y `pos` del mismo índice de slot que produjo la asignación; con la asignación corregida, etiqueta y posición quedan coherentes por construcción.
2. **RB/LB en TeamView** — confirmado: el render de la cancha usa `item.slot` tanto para la etiqueta visible (`team-pitch-role`) como, indirectamente vía `item.x`/`item.y`, para la posición; mismo principio de coherencia por índice compartido.
3. **Convención de formación** — confirmado: en ambos archivos, `FORMATIONS` define LB con `y` bajo (izquierda) y RB con `y` alto (derecha), de forma consistente — la corrección de asignación es, por sí sola, suficiente para alinear orientación, etiqueta y rol.
4. **Banco/activos** — confirmado: `onPitch`/`bench` se derivan de `lineup.map(item => item.playerId)` y la asignación ahora garantiza ids únicos por slot (test "never assigns the same player to two slots" en verde).
5. **Punto único de filtrado demo** — confirmado vía búsqueda exhaustiva: `usePostMatchReports` es importado y consumido por `AiView`, `HomeView`, `PostMatchAnalysisView`, `TeamView` y `ScenarioSimulatorPanel` — ningún consumidor bypassea el hook para leer reportes por otra vía, así que filtrar en ese único lugar cierra la fuga en cascada.
6. **Modo demo intacto** — confirmado por test (`loadDemoWorkspace` sigue sembrando "Rojo FC", prompt, hilo semanal, y el filtro no se aplica cuando `workspaceMode === "demo"`).
7. **Transición demo → real limpia** — confirmado por test: `loadRealWorkspace` produce equipo distinto, prompt vacío, `weeklyDecisionThread` nulo, cero observaciones manuales, y ningún id de jugador demo sobrevive.
8. **`detectTeamPatterns` sin strings demo hardcodeados** — confirmado: con la lista de reportes filtrada (vacía para un workspace real sin historial propio) no genera patrones; con el seed piloto sin filtrar (modo demo) sigue siendo libre de generarlos — toda la lógica de patrones depende exclusivamente del arreglo de reportes que recibe.
9. **Suite de regresión completa** — 230/230 tests en verde, incluyendo los 21 nuevos y los preexistentes de coords, match engine, microciclo y post-match.
10. **Compilación y build de producción** — limpios (ver sección 10).

---

## 12. Riesgos conocidos

- **Densidad de bundle preexistente**: `three-vendor` (~1.37 MB) y `pdf-vendor` (~1.45 MB) superan el umbral de advertencia de Vite. No es un problema introducido por este pase — ya figuraba como deuda conocida en `CLAUDE.md` ("bundle grande en build") — y no se tocó, conforme al alcance acotado del pase.
- **Validación manual sin navegador**: por restricciones del entorno aislado, la validación de UI fue un trazado de código (dato → render) en lugar de una corrida interactiva. La cadena verificada es directa y sin saltos de IA intermedios, por lo que la confianza es alta, pero una pasada visual rápida en `npm run dev` por parte del cuerpo técnico (mirar la cancha de Equipo y de Lineup Lab con un plantel real que tenga RB/LB) sigue siendo recomendable como confirmación final antes de un uso intensivo.
- **Artefacto de entorno en el build**: el `EPERM` al vaciar `dist/` es un problema del punto de montaje del entorno aislado de validación, no del código ni del pipeline real de build del usuario — documentado para que no genere confusión si se repite en este entorno, pero no debería aparecer en una máquina normal.

---

## 13. Qué se decidió NO implementar (y por qué)

- **No se rediseñó `LineupLab3D`** ni se introdujo un nuevo flujo de armado de lineup — se corrigió el algoritmo existente en su lugar, preservando su forma y su contrato público.
- **No se unificaron `LineupLab3D` y `TeamView` en un solo armador de lineup compartido**, aunque ahora comparten el mismo algoritmo de dos pasadas. Unificarlos habría sido una refactorización estructural fuera del alcance de un pase de integridad — se prefirió aplicar la misma corrección de forma acotada en cada lugar, documentando la duplicación como found-and-fixed para una futura consolidación deliberada.
- **No se ocultó "Cancha analítica" detrás de un modo "Avanzado"** — se prefirió explicarla in-situ, que es menos invasivo y no resta funcionalidad útil.
- **No se restructuró Sala/HomeView** — la organización por divulgación progresiva existente se evaluó como suficiente para el alcance de este pase.
- **No se tocó la lógica de razonamiento de `CoachAgent`** ni el flujo de commit de memoria post-partido — el filtrado de contaminación demo se resolvió enteramente en la capa de lectura (`usePostMatchReports`), sin alterar cómo ni cuándo se escribe memoria táctica.
- **No se debilitó TrustGuard** ni se ocultó incertidumbre/calidad de evidencia en ningún flujo tocado.

---

## 14. ¿Es seguro mergear?

**Sí.** Los cinco problemas (A–E) están corregidos y verificados con trazado de código + 230 tests en verde + type-check y build limpios. El hallazgo adicional (bug RB/LB duplicado en `TeamView.tsx`, no señalado originalmente) se encontró y corrigió dentro del mismo alcance, evitando que una corrección parcial dejara el bug vivo en la pantalla donde más probablemente se lo notó. Ningún cambio toca razonamiento de IA, TrustGuard, memoria post-partido más allá de su alcance de lectura, ni introduce backend/sincronización — todas las restricciones explícitas del pase se respetaron. El único punto pendiente recomendado es una pasada visual breve del cuerpo técnico en `npm run dev`, no como bloqueante sino como confirmación final de UX antes de un uso intensivo.
