import type { StandStatus } from "./types";

export const statusLabels: Record<StandStatus, string> = {
  available: "Свободен",
  reserved: "Резерв",
  sold: "Продан",
  construction: "Застройка",
  unavailable: "Недоступен",
};

export const statusColors: Record<StandStatus, string> = {
  available: "#34a853",
  reserved: "#fbbc04",
  sold: "#ea4335",
  construction: "#9aa0a6",
  unavailable: "#5f6368",
};

export const currentDealColor = "#1a73e8";
