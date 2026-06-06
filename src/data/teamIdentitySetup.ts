import { z } from "zod";

export const FormationPreferenceSchema = z.string().default("");
export const DefensiveHeightPreferenceSchema = z.enum(["", "low", "mid", "high"]).default("");
export const SquadLevelSchema = z.string().default("");

export const TeamIdentitySetupSchema = z.object({
  teamName: z.string().default(""),
  baseFormation: FormationPreferenceSchema,
  preferredDefensiveHeight: DefensiveHeightPreferenceSchema,
  pressingPreference: z.string().default(""),
  buildUpPreference: z.string().default(""),
  trainingDays: z.number().int().min(0).max(7).default(0),
  squadLevel: SquadLevelSchema,
  notes: z.string().default(""),
});

export type TeamIdentitySetup = z.infer<typeof TeamIdentitySetupSchema>;

export function createEmptyTeamIdentitySetup(): TeamIdentitySetup {
  return TeamIdentitySetupSchema.parse({});
}

export function createDemoTeamIdentitySetup(): TeamIdentitySetup {
  return TeamIdentitySetupSchema.parse({
    teamName: "Rojo FC",
    baseFormation: "4-3-3",
    preferredDefensiveHeight: "high",
    pressingPreference: "Presion tras perdida y saltos agresivos sobre pase atras.",
    buildUpPreference:
      "Salida corta con pivote visible y extremos altos para fijar amplitud.",
    trainingDays: 3,
    squadLevel: "semiprofesional",
    notes:
      "Semana piloto enfocada en compactar tras perdida y sostener mejor al pivote.",
  });
}

export function isTeamIdentityConfigured(identity: TeamIdentitySetup) {
  return Boolean(
    identity.teamName.trim() &&
      identity.baseFormation.trim() &&
      identity.preferredDefensiveHeight &&
      identity.pressingPreference.trim() &&
      identity.buildUpPreference.trim() &&
      identity.trainingDays > 0 &&
      identity.squadLevel.trim(),
  );
}

export function summarizeTeamIdentity(identity: TeamIdentitySetup) {
  if (!isTeamIdentityConfigured(identity)) return "";

  const lines = [
    `${identity.baseFormation} base`,
    identity.preferredDefensiveHeight
      ? `altura defensiva ${heightLabel(identity.preferredDefensiveHeight)}`
      : "",
    identity.pressingPreference.trim(),
    identity.buildUpPreference.trim(),
  ].filter(Boolean);

  return lines.join(", ");
}

function heightLabel(value: Exclude<TeamIdentitySetup["preferredDefensiveHeight"], "">) {
  if (value === "high") return "alta";
  if (value === "mid") return "media";
  return "baja";
}
