"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
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
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="outline"
        className="h-11 gap-2 rounded-xl border-[#D5DAEA] px-4.5 text-sm font-semibold text-ink"
        onClick={handleExport}
        disabled={exporting}
      >
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={1.8} />}
        {exporting ? "Exporting..." : "Export CSV"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
