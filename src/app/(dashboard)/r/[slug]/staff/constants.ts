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
  SERVER: "#3b82f6",
  HOST: "#8b5cf6",
  CHEF: "#f97316",
  BARTENDER: "#14b8a6",
  MANAGER: "#e11d48",
  OTHER: "#64748b",
};
