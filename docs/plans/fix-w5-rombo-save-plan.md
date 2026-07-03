# PLAN — W5: pagar el !important nuevo de .rombo-save

Branch: `fix/w5-rombo-save` desde `origin/main` @ `864f51a`. Deuda declarada de W4 (`docs/plans/fix-w4-ui-debt-plan.md`, item 2).

## Diagnostico (causa raiz)

`.rombo-save` (`src/app/theme.css:5275`) nunca tuvo `color` antes de W4 — el original (baseline, pre-W3) era solo `background`/`border-color` en `!important`. Contrastaba bien porque heredaba el `color: #e8f2ff` (blanco-azulado) de la regla base de boton, y ese blanco leia bien sobre el verde original.

Regla base que fija ese color, `src/app/theme.css:5186-5195`:

```css
.rombo-board-shell button,
.rombo-board-shell select,
.rombo-board-shell input,
.rombo-board-shell textarea {
  ...
  color: #e8f2ff;
}
```

Especificidad de `.rombo-board-shell button` = (0,1,1) — una clase + un tipo. Especificidad de `.rombo-save` sola = (0,1,0) — una clase. La regla base gana por especificidad, sin importar el orden en la hoja. En W4, al pasar el fondo a `--felt-gold`, ese blanco heredado quedo con mal contraste sobre dorado, asi que agregue `color: #1a1205 !important;` a `.rombo-save` para ganarle a la regla base -- eso fue la UNICA declaracion nueva con `!important` de la ola pasada (el gate lo marco como nota).

## Solucion (sin !important nuevo)

Subir la especificidad del selector propio en vez de pelear con `!important`: `.rombo-save` vive siempre dentro de `.rombo-board-shell` (confirmado, `TacticalBoardTopbar.tsx:58` se renderea dentro de `<section className="rombo-board-shell">`, `TacticalBoardView.tsx:178`, y es el unico uso de la clase en todo `src/`). Renombrar el selector a `.rombo-board-shell .rombo-save` da especificidad (0,2,0) -- dos clases -- que le gana a `.rombo-board-shell button` (0,1,1) sin `!important`.

Como la especificidad ya alcanza para las 3 propiedades de esa regla (no solo `color`), tambien se cae el `!important` de `background`/`border-color` (que eran preexistentes de la baseline, con la misma razon de ser: ganarle a la regla base). Resultado: la regla completa queda sin ningun `!important`, mismo resultado visual, cascada mas simple (se resta deuda en vez de solo no sumarla).

No se toca `.rombo-primary-cta` (sus 3 `!important` son preexistentes de antes de W3/W4, no es la deuda declarada de esta ola).

## Diff esperado

Solo `src/app/theme.css`, una regla (~4 lineas tocadas: rename de selector + 3 remociones de `!important`). Nada fuera del bloque felt.

## Verificacion

- `npm run type-check`, `npm run build`, `npm test -- --run`.
- Smoke vivo (Playwright): computed style de Guardar y Llevar al entrenamiento (`background-color`/`color`) siguen dorado/tinta oscura, desktop + viewport angosto, cero fuga en Home/Diagnostico/Biblioteca.

## Commit

1 commit: `fix(board): drop the !important on rombo-save color via scoped specificity`
