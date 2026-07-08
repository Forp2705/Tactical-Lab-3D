# PLAN — fix/w17-nav-transitions (mc-19)

## Objetivo

Asegurar las transiciones del cockpit: Sala → Diagnostico → Sesion / Pizarra.
Diagnostico debe tener salida clara hacia Sesion o Pizarra, con y sin respuesta
del coach.

## Diagnostico previo (lectura del combinado e8e9c05)

1. **Sala → Diagnostico**: ya existe (`HomeProblemPaper` "Abrir diagnostico" →
   `openDiagnostico()` = `setAiMode("coach")` + `setView("ai")`). Solo se
   verifica en vivo, no se toca.
2. **Diagnostico → Sesion (con respuesta)**: "Convertir en sesion" ya existe en
   el card "Accion recomendada" del `AdviceResult` y navega de verdad:
   `createSessionFromCoachAdvice` setea `view: "sessions"` en el mismo `set()`
   cuando materializa bloques. Se verifica en vivo con fixture.
3. **Diagnostico → Pizarra (con respuesta)**: NO existe salida → se agrega
   link mono (`.home-paper-link-cta`, patron LENGUAJE-ROMBOIQ: un solo slab
   dorado por vista = "Consultar Coach") en el toolbar del card "Accion
   recomendada": `setView("board")`. Sin acciones de store nuevas.
4. **Salidas sin respuesta (EmptyState)**: NO existen → se agrega una fila de
   links discretos "Armar sesion" (`setView("sessions")`) y "Abrir pizarra"
   (`setView("board")`) con el mismo patron link mono, sin CSS nuevo
   (contenedor `toolbar compact` existente).
5. **Vuelta**: por nav lateral (ya existe). Ninguna salida toca `aiMode`
   (`setView` no lo modifica → postMatch intacto).

## Archivos

- `src/ai/AiView.tsx` — SOLO region de acciones del AdviceResult + EmptyState.
- Sin CSS nuevo. PROHIBIDO tocar CoachAgent/client/schemas/api/store.

## Verificacion

- `npm run type-check`, `npm run build`, suite completa (esperada 700/700 en el
  combinado, segun coordinador; el brief decia 698 pero la suite real es 700).
- Viva (click real + vista destino renderiza + consola limpia):
  - Sala → Diagnostico ("Abrir diagnostico").
  - Diagnostico (empty) → Sesion y → Pizarra (links nuevos), en demo y real vacio.
  - Diagnostico (respuesta fixture via intercept de fetch en dev: /api/agent-status
    configurado + /api/coach-agent devuelve DiagnosisResponse valida) →
    "Convertir en sesion" navega a Sesion; "Llevar a la pizarra" navega a Pizarra.
  - postMatch: cambiar a Post-Partido y confirmar que sigue renderizando.
