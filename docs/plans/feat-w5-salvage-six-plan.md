# PLAN — W5 mc-22: salvage de los 6 SALVAGE + veredicto del REWRITE-CARO

Branch: `feat/w5-salvage-six` desde `origin/main` = `864f51a` (verificado). Mismo estandar y
metodo que el re-autorado W3 (SHIP, firma semantica 3/3). Ola 5 = seguir depurando contenido
SIN abrir features.

## Contexto medido (arbol actual)
Post-delete W4 la cuarentena (`compactCuratedSpecs` / `generatedLibraryExerciseIds`) quedo en 7:
6 SALVAGE + 1 REWRITE-CARO. Pool visible = 19. Dato clave: los 7 stamped YA puntuan alto en
`validateExercise` (100, salvo los 2 ABP en 86 por warning missing-gk) — porque el validador es
un check LOGICO, no semantico. El problema real es el que marco mi auditoria S/R/D: la escena
estampada NO cuenta la historia del titulo. Salvar = re-autorar la ESCENA (misma id), como W3.

## Los 6 SALVAGE (id CONSERVADO) + fase que aportan
| # | id | fase | historia que debe contar la escena |
|---|----|------|-----------------------------------|
| 1 | `presion-salto-lateral` | defenseOrg | bloque compacto por dentro; el pase al lateral rival dispara el SALTO del extremo propio + bascula; pelota forzada atras |
| 2 | `transicion-primer-pase-seguro` | transOff | robo + PAUSA medio segundo + primer pase de cara al apoyo (asegurar), no correr a lo loco |
| 3 | `abp-falta-bloqueo-frontal` | abpOff | falta lateral (no corner): bloqueo legal sin chocar libera zona frontal para el segundo movimiento y remate |
| 4 | `defensa-centro-lateral-juego-abierto` | defenseOrg | centro lateral rival: central ataca el centro, lateral cierra segundo palo, pivote vive el rechace |
| 5 | `abp-defensa-bloqueo-segundo-palo` | abpDef | corner rival con bloqueo al segundo palo: comunicar el bloqueo y proteger el segundo palo con ventaja |
| 6 | `defensa-linea-pase-bloqueada` | defenseOrg | central NO persigue: perfila el cuerpo y niega la linea de recepcion del 9 (defensa posicional) |

Aporte al pool por fase (ANTES→DESPUES): defenseOrg 2→5 (+3), transOff 2→3 (+1), abpOff 2→3 (+1),
abpDef 2→3 (+1). attackOrg 8 y transDef 3 sin cambio. Pool total 19→25.

## Estandar por ejercicio (bar W3 = B1-B3)
- `validateExercise` → `critical=false`, `score ≥ 80` (apunto 100): objective.primary no vacio,
  rango players valido, ≥2 coaching utiles, `success` no vacio, oposicion real (own+rival).
- Escena a mano: actores/keyframes/overlays/zonas/trigger que cuentan la historia del titulo en
  UNA reproduccion; duracion/espacio/material realistas.
- OJO validador (leccion W3): NO mencionar arquero/portero/guardameta en title/principle/objective
  de ejercicios NO-GK — dispara `checkKeeperPressing` (exige presion dirigida al GK = ERROR de otro
  dominio). Los 2 ABP satisfacen `checkSetPieces` con un actor rol `GK` en escena SIN nombrarlo en
  el texto (elimina el warning missing-gk: 86→100).
- Mecanica igual que W3: quitar los 6 specs de `compactCuratedSpecs` (salen de la cuarentena,
  `generatedLibraryExerciseIds` 7→1) y agregar el `Exercise` curado completo al final de
  `extraExercises` con la MISMA id (sesiones guardadas resuelven al contenido nuevo = upgrade).
- Firma semantica B4 la dan coordinador + usuario en el gate; mc-10 adjudica criterio de producto.

## Veredicto REWRITE-CARO (NO se implementa esta ola)
`ataque-cambio-orientacion-extremo` (attackOrg, "Cambio de orientacion para extremo aislado").
- **Recomendacion: RE-AUTORAR EN OLA FUTURA, prioridad BAJA. NO degradar a DELETE.**
- Fundamento: el switch de juego (atraer por dentro, cambiar al extremo aislado) es un concepto
  genuinamente NO cubierto por el curado — el titulo es honesto, no es un casi-duplicado (a
  diferencia de los 10 DELETE de W4). Borrarlo perderia el unico contenido de cambio de
  orientacion. PERO attackOrg ya es la fase MAS saturada del pool (8/25), asi que no urge.
- Costo (por eso REWRITE-CARO, no SALVAGE): necesita cancha completa y 10-12 actores en ambas
  bandas para que el switch sea legible (sobrecarga interior real → cambio largo → 1v1 exterior).
  Es la escena mas cara del set (≈1.5x un salvage de esta ola). Estimacion: 1 unidad de autoria
  "grande" (comparable a un curado full-pitch tipo `contraataque-4v3` pero con las dos bandas).
- Fallback si producto quiere cuarentena en 0: DELETE con tombstone → `salida-lateral-tercer-hombre`
  o `banda-centro-atras` (ambos tocan juego por banda), asumiendo la perdida del concepto switch.
- Mientras tanto: queda en cuarentena (inocuo — excluido del pool, invisible en Biblioteca).

## Tests
- `tests/reauthoredExercises.test.ts`: extender (o espejo) para los 6 — critical=false, score≥80,
  fuera de `generatedLibraryExerciseIds`, dentro del pool; el set de fases del pool sigue en 6.
- Literales de conteo: pool 19→25; `generatedLibraryExerciseIds` 7→1; catalog total 26 sin cambio
  (los 6 se mueven de specs a extraExercises, no se agregan/borran ids). Verificar contra
  origin/main FRESCO antes del done (leccion W3 — soy el unico branch de catalogo esta ola).
- Suite COMPLETA + type-check + build.

## Validacion en vivo
≥2 de los 6 abiertos en el visor 3D (top+iso): la escena cuenta el titulo sin leer texto (metodo
W2/W3). Quick Start: el pool mas grande (25) mantiene o mejora variedad (defenseOrg 2→5 es la
mejora principal de variedad de fase real).

## Guard EOL
`git diff --stat` antes de cada commit; whole-file diff inesperado → parar + escalation.
Commits granulares (por ejercicio o pares). NUNCA push.
