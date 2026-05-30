import { type CoachMatchAdvice, CoachMatchAdviceSchema } from "./CoachSchemas.js";

/**
 * Utilidades puras para volver robusto el parseo de la respuesta del coach.
 *
 * Por qué existe este módulo:
 * - Los modelos a veces envuelven el JSON en ```json ... ``` o agregan prosa
 *   antes/después. Un JSON.parse directo falla en seco.
 * - Queremos poder reintentar y escalar a otro modelo cuando el texto no es un
 *   JSON válido, no solo cuando la red falla.
 *
 * Son funciones puras (sin imports de node, sin red) para respetar el boundary
 * server/client y poder testearlas sin mocks.
 */

/**
 * Aísla el objeto JSON dentro de un texto crudo del modelo.
 * - Quita fences markdown (```json / ```).
 * - Si todavía hay prosa alrededor, recorta desde la primera "{" hasta la
 *   última "}" balanceando llaves.
 * Devuelve el string del objeto JSON (sin parsear) o lanza si no encuentra uno.
 */
export function extractJsonObject(rawText: string): string {
  if (typeof rawText !== "string") {
    throw new Error("Coach response is not a string");
  }

  const withoutFences = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!withoutFences) {
    throw new Error("Coach response is empty");
  }

  // Caso feliz: ya es un objeto JSON.
  if (withoutFences.startsWith("{") && withoutFences.endsWith("}")) {
    return withoutFences;
  }

  // Caso con prosa alrededor: buscamos el objeto balanceando llaves para no
  // cortar en una "}" que estaba dentro de un string anidado.
  const start = withoutFences.indexOf("{");
  if (start === -1) {
    throw new Error("No JSON object found in coach response");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i++) {
    const char = withoutFences[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        return withoutFences.slice(start, i + 1);
      }
    }
  }

  throw new Error("Unbalanced JSON object in coach response");
}

/**
 * Extrae + parsea + valida la respuesta del coach contra el schema.
 * Lanza si el texto no contiene un JSON válido o no cumple el contrato.
 */
export function parseCoachAdvice(rawText: string): CoachMatchAdvice {
  const json = extractJsonObject(rawText);
  const parsed = JSON.parse(json);
  return CoachMatchAdviceSchema.parse(parsed);
}

/**
 * Arma la escalera de modelos a probar en orden.
 * - primaryModel: el modelo principal (de OPENROUTER_MODEL o un default).
 * - fallbackList: cadena separada por comas (de OPENROUTER_FALLBACK_MODELS).
 * Devuelve la lista sin duplicados, recortada y sin vacíos, manteniendo orden.
 */
export function resolveModelLadder(
  primaryModel: string,
  fallbackList?: string,
): string[] {
  const fromFallback = (fallbackList ?? "")
    .split(",")
    .map((entry) => entry.trim());

  const ordered = [primaryModel?.trim() ?? "", ...fromFallback].filter(
    (entry): entry is string => Boolean(entry),
  );

  return [...new Set(ordered)];
}

/**
 * Algunos modelos/proveedores compatibles con OpenAI no soportan
 * response_format: { type: "json_object" }. Si ese es el fallo, conviene
 * reintentar el mismo modelo sin JSON mode antes de saltar de modelo.
 */
export function isJsonModeUnsupportedError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");

  return (
    /response_format|json_object|json mode|json schema/i.test(text) &&
    /unsupported|not supported|invalid|bad request|400/i.test(text)
  );
}
