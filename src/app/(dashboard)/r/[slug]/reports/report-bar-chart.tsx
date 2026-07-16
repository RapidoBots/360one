"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartBucket } from "@/lib/report-metrics";

// Sequential color: one hue throughout, opacity scaled by value relative to
// the tallest bar -- "more is darker" instead of every bar looking identical.
const MIN_OPACITY = 0.35;

export function ReportBarChart({ data }: { data: ChartBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={24} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }}
        />
        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={24}>
          {data.map((d, i) => (
            <Cell key={i} fillOpacity={MIN_OPACITY + (1 - MIN_OPACITY) * (d.value / max)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
