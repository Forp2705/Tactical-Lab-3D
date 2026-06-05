import { useEffect, useState } from "react";
import {
  getCachedPostMatchReports,
  listPostMatchReports,
  subscribePostMatchReports,
} from "./postMatchClient";
import type { SavedPostMatchReport } from "./schemas";

export function usePostMatchReports() {
  const [reports, setReports] = useState<SavedPostMatchReport[]>(
    () => getCachedPostMatchReports() ?? [],
  );
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePostMatchReports((nextReports) => {
      setReports(nextReports);
      setReportsError(null);
    });

    void listPostMatchReports().catch((error) => {
      setReportsError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el historial de reportes.",
      );
    });

    return unsubscribe;
  }, []);

  return {
    reports,
    reportsError,
  };
}
