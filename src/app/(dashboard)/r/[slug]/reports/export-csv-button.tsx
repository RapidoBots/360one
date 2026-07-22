"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportReservationsCsvAction } from "./actions";

export function ExportCsvButton({ slug, start, end }: { slug: string; start: string; end: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const result = await exportReservationsCsvAction(slug, { start, end });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reservations-${start}-to-${end}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" className="h-11 px-5 text-base" onClick={handleExport} disabled={exporting}>
        {exporting ? "Exporting..." : "Export CSV"}
      </Button>
      {error && <p className="text-base text-destructive">{error}</p>}
    </div>
  );
}
