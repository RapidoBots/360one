import { POSITION_LABELS } from "./constants";
import type { StaffPosition } from "@/generated/prisma/client";

export function positionLabel(position: StaffPosition, customPosition: string | null): string {
  if (position === "OTHER" && customPosition) return customPosition;
  return POSITION_LABELS[position];
}
