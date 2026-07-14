"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportReservationsCsvAction } from "./actions";

export function ExportCsvButton({ slug, start, end }: { slug: string; start: string; end: string }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    const result = await exportReservationsCsvAction(slug, { start, end });
    setExporting(false);
    if (!result.ok) return;

    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservations-${start}-to-${end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" className="h-11 px-5 text-base" onClick={handleExport} disabled={exporting}>
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
