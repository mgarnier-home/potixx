import { HttpClient } from "@angular/common/http";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

/** Coquille de l'application : la barre d'onglets, puis la page de l'onglet actif. */
@Component({
  selector: "app-root",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: "./app.html",
  styleUrl: "./app.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    inject(HttpClient)
      .get<{ version: string; commit: string; date: string }>("/version")
      .subscribe({
        next: ({ version, commit, date }) =>
          console.info(`Potixx v${version} (${commit.slice(0, 7)}, ${date})`),
        // Information de diagnostic : son absence ne doit jamais gêner le visiteur.
        error: () => undefined,
      });
  }
}
