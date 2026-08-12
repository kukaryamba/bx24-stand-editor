import type { ExhibitionProject } from "./types";

export function createEmptyProject(): ExhibitionProject {
  return {
    id: "project-local",
    title: "Выставочный проект",
    exhibitions: [],
    floorPlans: [],
    layers: [],
    objects: [],
    settings: {
      autosave: true,
    },
  };
}
