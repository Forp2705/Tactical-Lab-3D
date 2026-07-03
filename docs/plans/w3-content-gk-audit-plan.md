# PLAN — W3 mc-22: data del arquero + auditoría técnica de generados

Branch: `fix/w3-content-gk-audit` desde `origin/main` = `4ec67c4` (pin del brief, verificado).

## T1 — Coordenadas de `pressing-portero-recibe`

**Problema:** la escena entera vive en x∈[10,52] (lado −x) y en `pitchMode: "half"` Pitch3D dibuja el arco SOLO en +x → el arquero defiende un fondo sin arco.

**Fix (solo data, un bloque):** espejar TODAS las X del bloque del ejercicio (`x → 100 − x`), dejando Y intactas. El espejo preserva exactamente la geometría relativa y la intención táctica (tridente presiona al GK que recibe, salida forzada a banda); solo cambia el lado, que pasa a ser el que tiene arco dibujado. Elementos espejados: 8 actores (pos inicial + keyframes), pelota (start + 3 waypoints), zona "trampa" (`rect.x' = 100 − (x + w)`), nada más (overlays y trigger referencian actores por id; el trigger no tiene visualMarker).

**Coordinación con mc-19:** el id duplicado (`defensa-centro-lateral`) vive en `compactCuratedSpecs` (~línea 2421+), mi diff toca SOLO el bloque de `pressing-portero-recibe` (~1078-1167). Cero solapamiento.

**Validación:** `tests/validateExercise.test.ts` (asserts existentes sobre este ejercicio: GK detectado, no crítico) + suite completa + **en vivo** top e iso: arco en cuadro detrás del GK, presión coherente hacia +x, sin regresión de encuadre (el encuadre W3 de topFraming incluye el fondo del lado del GK — ahora ese fondo tiene arco de verdad). Screenshots en worktree: `w3-gk-top.jpeg`, `w3-gk-iso.jpeg`.

## T2 — Auditoría técnica de los 20 generados (SOLO auditoría)

**Criterio de prioridad (medido, no intuido):** el pool curado de 15 queda attackOrg **8**, transOff 2, defenseOrg 2, abpOff 2, transDef **1**, abpDef **0**. La variedad perdida manda: abpDef está VACÍO (la alerta del microciclo "la sesión no incluye ABP" es estructuralmente imposible de satisfacer hoy), transDef casi vacío, defenseOrg flaco. attackOrg está saturado → todo generado attackOrg redundante con un curado va a DELETE.

**Contexto técnico común:** los 20 comparten UNA escena estampada (5 propios avanzando + 2 rivales estáticos, sin GK, pelota propia, cadena o1→o2→o4; ABP solo cambia a `third`). "Salvage" = título/objetivo/metadata ya utilizables; el costo es re-autorar la ESCENA (actores/keyframes/overlays/zonas/trigger), que para escenas chicas (rondo/ABP/área) es acotado.

| # | id | título | fase | veredicto | esfuerzo escena | dominio que aporta al pool | prioridad |
|---|----|--------|------|-----------|-----------------|---------------------------|-----------|
| 1 | abp-defensa-zona-rechace | ABP defensiva protegiendo rechace | abpDef | **SALVAGE** | medio (área, GK + marcas + rechace, pitch third) | **abpDef hoy = 0** | **1** |
| 2 | transicion-perdida-cinco-segundos | Perdida y presion de cinco segundos | transDef | **SALVAGE** | medio (necesita momento de pérdida + contrapresión 5s) | transDef (contrapresión; Quick Start "Nos contragolpean" hoy rota 1 solo curado transDef) | **2** |
| 3 | repliegue-temporizar-banda | Repliegue temporizando en banda | transDef | **SALVAGE** | medio (repliegue orientando fuera, timing de ayuda) | transDef (repliegue ≠ contrapresión, sin equivalente curado) | **3** |
| 4 | abp-defensa-bloqueo-segundo-palo | ABP defensiva contra bloqueo al segundo palo | abpDef | **SALVAGE** | medio (área, comunicación de bloqueo) | abpDef (2º de la fase vacía) | 4 |
| 5 | defensa-centro-lateral | Defensa de centro lateral y segunda jugada | defenseOrg | **SALVAGE** | medio (centro + cuerpos en área + segunda jugada) | defensa de centros (cero cobertura curada; dolor amateur clásico) — NOTA: es el id duplicado que arregla mc-19; este veredicto aplica a la entrada única resultante | 5 |
| 6 | presion-salto-lateral | Presion coordinada con salto del lateral | defenseOrg | **SALVAGE** | medio (bloque que bascula + salto al lateral como trigger) | pressing con trigger de banda (≠ trigger GK, ≠ bloque medio) | 6 |
| 7 | defensa-linea-pase-bloqueada | Bloquear linea de pase al 9 | defenseOrg | **SALVAGE** | bajo (pocos actores, overlay lineBlocked ya existe en el modelo) | defensa posicional de línea de pase | 7 |
| 8 | abp-falta-bloqueo-frontal | ABP falta lateral con bloqueo frontal | abpOff | **SALVAGE** | medio (falta lateral ≠ corner; bloqueo + segundo movimiento) | abpOff variedad (hoy 2 corners, cero faltas) | 8 |
| 9 | transicion-primer-pase-seguro | Transicion ofensiva con primer pase seguro | transOff | **SALVAGE** | bajo (robo + pausa + apoyo de cara; escena corta) | transOff decisión "asegurar" (el curado enseña lo contrario: correr; par pedagógico) | 9 |
| 10 | ataque-cambio-orientacion-extremo | Cambio de orientacion para extremo aislado | attackOrg | **REWRITE-CARO** | alto (cancha completa, 8+ actores para que el switch tenga sentido) | switch de juego (no cubierto, pero attackOrg ya tiene 8) | 10 |
| 11 | presion-arquero-pase-atras | Presion cuando el rival juega atras al arquero | defenseOrg | **DELETE** | — | duplicado exacto del curado `pressing-portero-recibe` (además es el único CRITICAL en cuarentena) | — |
| 12 | posesion-6v3-hombre-libre | Posesion 6v3 detectando hombre libre | attackOrg | **DELETE** | — | casi-duplicado de "Posesion 6v3 encontrando al pivote" | — |
| 13 | salida-3-1-pivote-sombra | Salida 3+1 encontrando pivote a la espalda | attackOrg | **DELETE** | — | misma familia que "Salida 3+1 contra dos puntas" (variación menor) | — |
| 14 | salida-vs-doble-punta | Salida contra doble punta | attackOrg | **DELETE** | — | el curado "Salida 3+1 contra dos puntas" ES salida vs doble punta | — |
| 15 | contraataque-carril-central | Contraataque por carril central con apoyos | transOff | **DELETE** | — | casi-duplicado de "Contraataque 4v3 tras robo central" | — |
| 16 | rondo-5v2-pared-interior | Rondo 5v2 con pared interior | attackOrg | **DELETE** | — | tercer rondo (ya hay 2 curados); pared interior no justifica otro | — |
| 17 | bloque-medio-trampa-pivote | Bloque medio cerrando pase al pivote | defenseOrg | **DELETE** | — | familia de "Bloque medio: bascular" + concepto cubierto mejor por #7 (línea de pase al 9) | — |
| 18 | abp-corner-corto-tercer-hombre | Corner corto y tercer hombre frontal | abpOff | **DELETE** | — | casi-duplicado de "ABP corner corto con 2v1 y centro tenso" | — |
| 19 | finalizacion-centro-raso | Finalizacion con centro raso atras | attackOrg | **DELETE** | — | casi-duplicado de "Ataque por banda y centro atrás" (cutback) | — |
| 20 | tercer-hombre-banda-derecha | Tercer hombre en banda derecha | attackOrg | **DELETE** | — | casi-duplicado de "Salida por lateral con tercer hombre interior" | — |

**Conteos: SALVAGE 9 · REWRITE-CARO 1 · DELETE 10.**

**Top-3 salvage (por variedad perdida):** (1) `abp-defensa-zona-rechace` — única vía de llenar abpDef=0; (2) `transicion-perdida-cinco-segundos` — contrapresión, el problema #1 del Quick Start "Nos contragolpean"; (3) `repliegue-temporizar-banda` — el otro comportamiento transDef, complementario del anterior. Con esos 3 + los abpOff/defenseOrg siguientes, el pool queda 15→18-20 con las 6 fases pobladas.

**Nota para mc-10:** los 10 DELETE son borrables sin pérdida (todo lo que aportan ya existe curado o es redundante interno); si producto prefiere conservar títulos para SEO/catálogo, convertirlos en "variantes" del curado equivalente es la alternativa, pero como ejercicios independientes no pagan su escena.

## Guard EOL
`git diff --stat` antes de cada commit; whole-file diff → parar + escalation.
