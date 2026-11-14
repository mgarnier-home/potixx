import type { Routes } from "@angular/router";
import { Hunt } from "./hunt/hunt";

export const routes: Routes = [
  { path: "", component: Hunt, title: "La chasse au trésor" },
  {
    path: "pronostics",
    loadComponent: () =>
      import("./predictions/prediction-form/prediction-form").then((m) => m.PredictionForm),
    title: "Pronostics",
  },
  {
    path: "admin",
    loadComponent: () => import("./predictions/admin/admin").then((m) => m.Admin),
    title: "Administration",
  },
  { path: "**", redirectTo: "" },
];
