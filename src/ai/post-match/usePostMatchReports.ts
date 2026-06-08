import { useEffect, useMemo, useState } from "react";
import {
  getCachedPostMatchReports,
  listPostMatchReports,
  subscribePostMatchReports,
} from "./postMatchClient";
import type { SavedPostMatchReport } from "./schemas";
import { pilotReportsSeed } from "@/demo/pilotReports";
import { useAppStore } from "@/state/useAppStore";

// `postMatchClient` seeds/falls back to these pilot reports (San Telmo, Dock
// Sud, Midland) whenever the server has nothing saved yet — that fallback
// exists so demo mode always has something to show. A real workspace must
// never display them, so we scope them out by their stable seed ids.
const PILOT_REPORT_IDS = new Set(pilotReportsSeed.map((report) => report.id));

export function usePostMatchReports() {
  const workspaceMode = useAppStore((state) => state.workspaceMode);
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

  const scopedReports = useMemo(
    () =>
      workspaceMode === "real"
        ? reports.filter((report) => !PILOT_REPORT_IDS.has(report.id))
        : reports,
    [reports, workspaceMode],
  );

  return {
    reports: scopedReports,
    reportsError,
  };
}
