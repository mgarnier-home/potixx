import { ChangeDetectionStrategy, Component } from "@angular/core";

/** Animation du trésor : une mouette-cigogne transporte le bébé dans un baluchon au-dessus de la mer. */
@Component({
  selector: "app-baby-gull",
  templateUrl: "./baby-gull.html",
  styleUrl: "./baby-gull.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BabyGull {}
