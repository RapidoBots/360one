import type { StaffPosition } from "@/generated/prisma/client";

export const POSITION_LABELS: Record<StaffPosition, string> = {
  SERVER: "Server",
  HOST: "Host",
  CHEF: "Chef",
  BARTENDER: "Bartender",
  MANAGER: "Manager",
  OTHER: "Other",
};

export const POSITION_COLORS: Record<StaffPosition, string> = {
  SERVER: "#2855ee",
  HOST: "#8296bf",
  CHEF: "#222d47",
  BARTENDER: "#14b8a6",
  MANAGER: "#e11d48",
  OTHER: "#64748b",
};

export const SHIFT_STYLES: Record<StaffPosition, { border: string; bg: string; text: string }> = {
  SERVER:    { border: "#3763f3", bg: "#edf2ff", text: "#3655a4" },
  HOST:      { border: "#90a4c7", bg: "#f0f4fa", text: "#657da8" },
  CHEF:      { border: "#29354f", bg: "#eef0f4", text: "#303e59" },
  BARTENDER: { border: "#0d9488", bg: "#ecfdf5", text: "#115e59" },
  MANAGER:   { border: "#be123c", bg: "#fff1f2", text: "#9f1239" },
  OTHER:     { border: "#64748b", bg: "#f1f5f9", text: "#475569" },
};
