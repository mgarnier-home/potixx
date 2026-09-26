/** Case d'une grille, repérée depuis le coin supérieur gauche (à partir de 0). */
export interface Cell {
  row: number;
  col: number;
}

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}
