import {
  type GameModel,
  isGameModelConfigured,
  summarizeGameModel,
} from "../data/gameModel.js";
import {
  type TeamIdentitySetup,
  isTeamIdentityConfigured,
  summarizeTeamIdentity,
} from "../data/teamIdentitySetup.js";

export type CoachTeamIdentityContext = {
  configured: boolean;
  missingMessage: string;
  summary: string;
  structuredGameModel: string;
  setupRequest: string;
};

export const MISSING_TEAM_IDENTITY_MESSAGE =
  "No tengo modelo de juego definido para este equipo.";

export function buildCoachTeamIdentityContext({
  teamIdentity,
  gameModel,
}: {
  teamIdentity?: TeamIdentitySetup | null;
  gameModel?: GameModel | null;
}): CoachTeamIdentityContext {
  const configuredIdentity = teamIdentity
    ? isTeamIdentityConfigured(teamIdentity)
    : false;
  const configuredModel = gameModel ? isGameModelConfigured(gameModel) : false;

  if (!configuredIdentity && !configuredModel) {
    return {
      configured: false,
      missingMessage: MISSING_TEAM_IDENTITY_MESSAGE,
      summary: MISSING_TEAM_IDENTITY_MESSAGE,
      structuredGameModel: MISSING_TEAM_IDENTITY_MESSAGE,
      setupRequest:
        "Pide al staff formacion base, altura defensiva, preferencia de presion, salida, dias de entrenamiento y nivel del plantel antes de usar identidad como contexto.",
    };
  }

  return {
    configured: true,
    missingMessage: MISSING_TEAM_IDENTITY_MESSAGE,
    summary:
      configuredIdentity && teamIdentity
        ? summarizeTeamIdentity(teamIdentity)
        : configuredModel && gameModel
          ? gameModel.identity.trim() || "Game Model editable configurado."
          : "",
    structuredGameModel:
      configuredModel && gameModel
        ? summarizeGameModel(gameModel)
        : MISSING_TEAM_IDENTITY_MESSAGE,
    setupRequest:
      "Usa identidad solo si viene del setup del equipo, memoria aceptada o evidencia actual. No inventes rasgos de modelo de juego.",
  };
}
 };
}
  };
}
