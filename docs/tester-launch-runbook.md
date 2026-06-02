# Tester launch runbook

Objetivo: entregar una URL estable para que un tester externo recorra el loop
sin ayuda: observar -> diagnosticar -> entrenar -> revisar -> evolucionar.

## 1. Gate local

Ejecutar:

```bash
npm run tester:check
```

Debe pasar:

- type-check
- build
- tests

Warnings aceptados por ahora:

- chunks grandes de Three/PDF;
- tsconfig padre con `astro/tsconfigs/strict` ausente, si no bloquea build.

## 2. Variables server-side

Configurar en Vercel o entorno server-side:

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_FALLBACK_MODELS=
```

El modelo puede cambiarse por costo/disponibilidad, pero para testing evitar
un modelo `:free` como default porque aumenta latencia y fallos intermitentes.
Si se cargan fallbacks, usar IDs confirmados en la cuenta de OpenRouter.

## 3. Deploy

1. Confirmar que `npm run tester:check` paso.
2. Commit en una rama estable.
3. Push al remoto.
4. Crear deploy en Vercel.
5. Abrir `/api/agent-status` en la URL deployada.
6. Confirmar:
   - `openRouterConfigured: true`
   - `runtime: "vercel"`
   - modelo esperado.

## 4. QA end-to-end

Probar como alguien que no conoce la app:

1. Abrir Home.
2. Leer el recorrido de 5 minutos.
3. Ir a Diagnosticar.
4. Consultar: `Nos cuesta salir limpio`.
5. Responder entrevista si aparece.
6. Confirmar que el Coach devuelve:
   - desglose del problema;
   - ajuste principal;
   - 2-3 alternativas con trade-off;
   - confianza;
   - evidencia;
   - CTA para crear sesion.
7. Crear sesion desde diagnostico.
8. Ir a Entrenar y confirmar bloques/carga.
9. Ir a Revisar y cargar post-match simple.
10. Volver a Sala y revisar patrones/timeline.

Casos adicionales:

- `El 9 queda aislado`
- `Queremos subir el bloque`
- `El rival presiona alto`
- `Nos ganan por banda`
- `No generamos situaciones`

## 5. Gate binario

Ship a testers solo si:

- 0 pantallas rotas;
- 0 errores cripticos del Coach;
- latencia percibida razonable;
- cada diagnostico tiene al menos 2 alternativas;
- la Home se entiende en 5 segundos;
- el tester puede crear una sesion sin asistencia.
