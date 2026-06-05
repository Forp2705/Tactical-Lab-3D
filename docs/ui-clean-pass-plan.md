# RomboIQ - Clean UI pass plan v3

> v3: plan corregido contra el codigo real y listo para ejecutar.
> Norte: **RomboIQ debe verse como una herramienta tactica profesional: oscura, precisa, futbolera, con la cancha como unico foco visual rico y sin decoracion de dashboard IA.**
> Limite: sin cambiar logica de negocio, store, schemas ni flujos. Se permiten ajustes menores de markup/composicion en `HomeView` y `AiView` cuando hagan falta para jerarquia visual.
> Base real:
> - `src/app/theme.css` define muchas superficies legacy y reglas globales.
> - `src/app/tactical-ui.css` entra despues y hoy actua como capa de identidad / overrides.
> - `src/ui/tacticalPrimitives.css` ya es token-only.

---

## 0. Identidad cerrada

**Dark tactical product · alto contraste · verde cancha como acento · UI sobria · pitch protagonista.**

- Base negro-verdosa, no slate/azul IA.
- Verde como acento principal de accion, activo y foco.
- Superficies planas o casi planas, borde fino, sombras cortas, radio 12px.
- Nada de glass, glow, radiales decorativas ni flotacion de cards.
- `PitchViz` y el visor mantienen riqueza visual porque ahi la textura si cumple una funcion.

---

## 1. Alcance real del pass

### Si entra
- Tokens, colores, sombras, radios y estados compartidos.
- Limpieza de `theme.css` por override en `tactical-ui.css` cuando sea mas seguro.
- Ajustes de markup en `HomeView` y `AiView` para definir mejor jerarquia.
- Ajustes puntuales de copy visible si ayudan a la claridad del producto.

### No entra
- Logica de negocio.
- Reglas del coach.
- Cambios de store.
- Cambios de schema o endpoints.
- Redisenos de flujo.

---

## 2. Decisiones cerradas

1. **`--accent`** queda verde cancha.
2. **`--accent-2`** deja de ser azul y pasa a un acero desaturado: `#7c8a85`.
3. **Marca UI:** ya queda unificada como **RomboIQ**. No hace falta otro pase de branding.
4. **Temas:** la identidad canonica vive en `cockpit`, pero el pass tambien limpia superficies compartidas para que `broadcast` y `pizarra` no rompan consistencia aunque no se redisenen como sistemas separados.
5. **Semantica verde:** `--accent` y `--good` se mantienen distintos.
   - `--accent`: accion / activo / foco.
   - `--good`: exito / estado positivo.

---

## 3. Tokens base

### Regla de implementacion
**Se cambian valores, no nombres de token existentes.** Solo se agregan tokens chicos de soporte si simplifican estados compartidos.

### Canon para `cockpit`

| Token | Valor nuevo |
|---|---|
| `--bg` | `#070907` |
| `--panel` | `#0d1110` |
| `--panel-2` | `#121816` |
| `--panel-solid` | `#18201d` |
| `--text` | `#f4f7f5` |
| `--muted` | `#9ca8a2` |
| `--muted-2` | `#68736d` |
| `--line` | `rgba(255,255,255,.10)` |
| `--line-strong` | `rgba(255,255,255,.18)` |
| `--accent` | `#4ade80` |
| `--accent-2` | `#7c8a85` |
| `--warn` | `#facc15` |
| `--danger` | `#ef4444` |
| `--good` | `#22c55e` |
| `--shadow` | `0 8px 24px rgba(0,0,0,.18)` |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.24)` |
| `--radius` | `12px` |

### Tokens extra permitidos
- `--accent-strong: #22c55e`
- `--accent-soft: rgba(74, 222, 128, .12)`
- `--focus-ring: 0 0 0 2px rgba(74, 222, 128, .85)`

---

## 4. Matar el look IA

Aplicar sobre capas compartidas:

- fondos planos o casi planos;
- `--bg-grad-1`, `--bg-grad-2`, `--card-extra`, `--hero-extra`, `--glow` neutralizados;
- paneles solidos en vez de vidrio;
- sombras cortas;
- bordes nitidos;
- sin `translateY` decorativo en hover;
- sin halo en botones, nav, chips, loop progress, badges ni metricas.

**Excepcion:** la cancha conserva gradiente y contraste de cesped.

---

## 5. Jerarquia de producto

### Home

Tres niveles explicitos:

1. **Ahora**
   - lectura del momento;
   - siguiente decision;
   - resumen operativo.
2. **Acciones**
   - diagnosticar;
   - revisar post partido;
   - armar sesion;
   - preparar XI.
3. **Contexto**
   - rival;
   - microciclo;
   - reportes;
   - patrones;
   - biblioteca.

### AiView

Debe leerse como **informe tecnico de trabajo**, no como chatbot:

1. comando / pregunta;
2. resumen ejecutivo;
3. desglose del problema;
4. contraste y evidencia;
5. ajustes posibles;
6. plan de entrenamiento / acciones;
7. riesgos, dudas y reflexion.

La rail lateral sigue existiendo, pero mas callada y orientada a contexto.

---

## 6. Primitivos y estados

- chips y badges con look de metadata tecnica;
- estados activos por color + peso + borde, nunca por glow;
- `ConfidenceMeter` plano;
- `PatternCard` plana con borde lateral;
- `LoopProgress` sin halo;
- `:focus-visible` unico y global;
- targets de 44px donde aplique;
- hover sutil, sin salto visual.

---

## 7. QA y aceptacion

### Aceptacion minima
- contraste legible en Home, AiView, sidebar y cards;
- focus visible consistente;
- hover / active / disabled / selected coherentes;
- Home con 3 niveles claros;
- AiView leible como informe y no como chat;
- la cancha sigue siendo el foco visual mas rico;
- sin cambios de flujo ni logica.

### Validacion tecnica
- `npm run type-check`
- `npm run build`
- revision visual en desktop y mobile de:
  - Home
  - AiView
  - viewer / PitchViz

---

## 8. Secuencia de ejecucion

1. Ajustar tokens y reglas globales.
2. Limpiar look IA de superficies compartidas.
3. Ordenar Home.
4. Ordenar AiView.
5. Ajustar primitivos.
6. Cerrar con QA visual y validacion tecnica.

---

## 9. Riesgos

- `theme.css` sigue teniendo hardcodes legacy; conviene override quirurgico, no reescritura total.
- Home y AiView necesitan pequenos cambios de estructura para expresar jerarquia real.
- El clean pass puede destapar excepciones locales; se corrigen con clases puntuales, no con nuevo sistema visual paralelo.

---

## Resumen

El pass correcto no es solo cambiar verdes: es **bajar ruido, fijar una identidad verde-negra sobria, limpiar superficies compartidas y hacer que Home y AiView comuniquen prioridad tactica real** sin tocar negocio.
