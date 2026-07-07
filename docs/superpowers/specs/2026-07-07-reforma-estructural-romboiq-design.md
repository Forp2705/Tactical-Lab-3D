# Reforma estructural RomboIQ — diseño del programa

**Fecha:** 2026-07-07 · **Aprobado por:** Facundo (enfoque A; secciones 1-2 explícitas; resto delegado: "hacé lo que quieras") · **Base:** main `dce0f92`

## Decisiones del usuario

1. **Profundidad:** repensar cada vista (recorte de producto + composición + look), no solo recolor. La consolidación de las 3 hojas CSS NO es objetivo (queda como deuda declarada).
2. **Orden:** Pizarra → Diagnóstico → Sesión → Evolución → Post-Partido → herramientas (Cancha 3D, Video, Biblioteca, Briefing; livianas de a dos).
3. **Modo:** híbrido por ola — recorte de producto con el usuario cuando esté disponible (o por doctrina acumulada bajo delegación), implementa el coordinador solo (patrón W14), flota+gate mc-99 solo en olas sensibles (Pizarra sí: historial de crashes de interacción W1 + render tests), usuario = gate visual del después + autorización de merge.

## Paso 0 — `docs/design/LENGUAJE-ROMBOIQ.md`

Doc corto que congela las reglas validadas en Sala (W9-W14) como contrato de cada ola: felt vivo de fondo (clase compartida `.felt-stage` extraída del stack W14), eyebrow mono + título display por vista, UN slab dorado por vista, secundarias como links mono, prohibido píldoras-dashboard y doble branding, presupuesto 1366×768 autocontenido, AA sobre felt, papeles = firma exclusiva de Sala, tokens `--felt-*` (cero hex nuevos), ediciones CSS in situ, `[data-theme=cockpit]` reversible.

## W15 — Pizarra ola 1 (estructura)

Estado actual (recon 2026-07-07, `reforma-recon-pizarra-1366.png`): doble header (view header + topbar interno con marca/título/proyecto duplicados) come ~250px; fila de chips de estado dashboard-y; DOS selects de formación sobre el canvas + panel DISTRIBUCION con 6 botones que llaman la MISMA acción (`applyOwnFormation`) = triplicado; columna derecha (Distribucion + Mi equipo + Inspector + Problema + IA) desborda horizontal a 1366 («MI EQU…» cortado); pitch verde plano `rgba(11,78,34,.88)` ajeno al felt; panel «Instrucciones clave» flotando sobre el pitch; canvas recortado por el fold.

### Cortes (verificados contra código; cero tests los referencian)

1. **Topbar interno** (`TacticalBoardTopbar`): fuera `.rombo-brand` + `.rombo-title-block` (duplican sidebar y view header). Queda UNA barra compacta: Nueva escena · Undo · Redo · Vista · Guardar. De paso muere el overflow 188px conocido.
2. **DISTRIBUCION** (`TacticalBoardRosterPanel` sección 1): se ELIMINA (redundante byte-a-byte con el select del canvas). La formación queda con una sola fuente visible (select propio + select rival en el canvas).
3. **Mi equipo / Plantel**: pasa a `<details>` colapsado por defecto (summary «MI EQUIPO · N»); el form CRUD y la lista quedan intactos adentro.
4. **Instrucciones clave** (`TacticalBoardCanvas`): pasa a `<details>` colapsado por defecto en la esquina — el pitch queda limpio; el contenido no cambia.
5. **Chips de estado** (`.rombo-board-health`): se aquietan (mono chico, sin caja) — filtrar su contenido tocaría `useBoardActions` (lógica) y queda fuera de esta ola.
6. **Pitch felt**: `.pitch-bg` → mix oscuro de tokens (`color-mix` bg-2/bg-3, look del panel de Sala / Pizarra.html); líneas felt-line quedan.
7. **Felt stage**: la vista Pizarra respira felt alrededor del shell (clase `.felt-stage` nueva compartida).
8. **Fold**: canvas completo visible a 1366×768 (ajustar `max-height` del svg tras recuperar el alto del header colapsado).

**No se toca:** `useBoardActions` / `boardEditorReducer` / `boardModel` / motores de edición; endpoints/IA; schemas; el view header compartido de AppShell (patrón de todas las vistas — se evalúa en olas posteriores si hace falta).

### Validación W15

tsc + build + **suite completa** (board tiene render tests) · smoke vivo: crear pizarra desde demo, dibujar (drag zona + flecha), undo/redo, guardar, cambiar formación con ficha seleccionada (el canario W1), reload persiste · 1366×768 fold + 1920 + consola limpia · capturas antes/después · **gate corto mc-99** (SHA pinneado) · PR + merge con autorización explícita.

## Olas siguientes (esqueleto)

W16 Pizarra ola 2 (pulido post-feedback + catálogo del gate) → W17 Diagnóstico → W18 Sesión → W19 Evolución → W20 Post-Partido → W21+ herramientas. Cada una abre con recorte contra LENGUAJE-ROMBOIQ.md y cierra con capturas + merge autorizado.
