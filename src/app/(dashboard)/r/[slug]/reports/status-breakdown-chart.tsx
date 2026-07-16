"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartBucket } from "@/lib/report-metrics";

const STATUS_ORDER = ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"];

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

// Same fixed status colors used everywhere else in the app (reservation
// badges, Timeline card accents) -- kept consistent rather than inventing a
// separate palette just for this one chart.
const STATUS_COLORS: Record<string, string> = {
  PENDING: "var(--color-violet-500)",
  CONFIRMED: "var(--primary)",
  SEATED: "var(--color-emerald-500)",
  COMPLETED: "var(--muted-foreground)",
  CANCELLED: "var(--destructive)",
  NO_SHOW: "var(--color-amber-500)",
};

export function StatusBreakdownChart({ data }: { data: ChartBucket[] }) {
  const row: Record<string, number | string> = { name: "Reservations" };
  for (const bucket of data) row[bucket.label] = bucket.value;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={[row]} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 12 }}
          formatter={(value, name) => [value, STATUS_LABELS[String(name)] ?? String(name)]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
          formatter={(value: string) => STATUS_LABELS[value] ?? value}
        />
        {STATUS_ORDER.map((status, i) => (
          <Bar
            key={status}
            dataKey={status}
            stackId="status"
            name={status}
            fill={STATUS_COLORS[status]}
            stroke="var(--background)"
            strokeWidth={2}
            barSize={48}
            radius={
              i === 0
                ? [4, 0, 0, 4]
                : i === STATUS_ORDER.length - 1
                  ? [0, 4, 4, 0]
                  : [0, 0, 0, 0]
            }
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
