/**
 * Grille tarifaire officielle GoBooking — Côte d'Ivoire
 * Prix fixes en FCFA par paire de villes (ville de départ → ville d'arrivée)
 * La grille est symétrique : A→B = B→A
 */
export const PRICE_GRID: Record<string, Record<string, number>> = {
  Abidjan: {
    Yamoussoukro:   2500,
    Bouaké:         3500,
    Korhogo:        7000,
    "San Pédro":    3500,
    "San Pedro":    3500,
    Daloa:          4000,
    Man:            5500,
    Gagnoa:         2500,
    Divo:           1500,
    Abengourou:     2500,
    Soubré:         4500,
    Bondoukou:      5500,
    Sassandra:      3000,
    Odienné:        8000,
    Ferkessédougou: 8000,
    Séguéla:        5000,
    Tiassalé:        500,
    Agboville:      1000,
    Tabou:          5000,
    Touba:          7000,
  },
  Yamoussoukro: {
    Abidjan:    2500,
    Bouaké:     1500,
    Korhogo:    5000,
    Daloa:      1500,
    Gagnoa:     1500,
    Man:        4000,
    Divo:       2000,
    Séguéla:    3000,
  },
  Bouaké: {
    Abidjan:        3500,
    Yamoussoukro:   1500,
    Korhogo:        3500,
    Daloa:          2500,
    Man:            4000,
    Bondoukou:      3000,
    Abengourou:     3000,
    Ferkessédougou: 4500,
    Séguéla:        2500,
  },
  Korhogo: {
    Abidjan:        7000,
    Bouaké:         3500,
    Yamoussoukro:   5000,
    Man:            4500,
    Ferkessédougou: 2000,
    Odienné:        4000,
    Touba:          4500,
  },
  "San Pédro": {
    Abidjan:  3500,
    Daloa:    3500,
    Gagnoa:   3000,
    Soubré:   1500,
    Sassandra: 1500,
    Tabou:    2000,
  },
  "San Pedro": {
    Abidjan:  3500,
    Daloa:    3500,
    Gagnoa:   3000,
    Soubré:   1500,
    Sassandra: 1500,
    Tabou:    2000,
  },
  Daloa: {
    Abidjan:        4000,
    Bouaké:         2500,
    Yamoussoukro:   1500,
    Man:            2000,
    Gagnoa:         1500,
    Soubré:         2500,
    "San Pédro":    3500,
    "San Pedro":    3500,
    Séguéla:        2000,
  },
  Man: {
    Abidjan:      5500,
    Bouaké:       4000,
    Daloa:        2000,
    Korhogo:      4500,
    Yamoussoukro: 4000,
    Odienné:      3500,
    Touba:        3000,
    Séguéla:      2500,
  },
  Gagnoa: {
    Abidjan:     2500,
    Daloa:       1500,
    Yamoussoukro: 1500,
    "San Pédro": 3000,
    "San Pedro": 3000,
    Soubré:      1500,
    Divo:        1500,
  },
  Divo: {
    Abidjan:      1500,
    Gagnoa:       1500,
    Daloa:        2500,
    Yamoussoukro: 2000,
    Tiassalé:      800,
  },
  Abengourou: {
    Abidjan:   2500,
    Bouaké:    3000,
    Bondoukou: 2500,
  },
  Soubré: {
    "San Pédro": 1500,
    "San Pedro": 1500,
    Daloa:       2500,
    Gagnoa:      1500,
    Abidjan:     4500,
    Sassandra:   2000,
    Tabou:       3000,
  },
  Bondoukou: {
    Abidjan:    5500,
    Bouaké:     3000,
    Abengourou: 2500,
  },
  Ferkessédougou: {
    Abidjan: 8000,
    Bouaké:  4500,
    Korhogo: 2000,
  },
  Odienné: {
    Abidjan: 8000,
    Korhogo: 4000,
    Man:     3500,
    Touba:   2000,
  },
  Sassandra: {
    Abidjan:     3000,
    "San Pédro": 1500,
    "San Pedro": 1500,
    Soubré:      2000,
  },
  Séguéla: {
    Abidjan:      5000,
    Bouaké:       2500,
    Yamoussoukro: 3000,
    Man:          2500,
    Daloa:        2000,
  },
  Agboville: {
    Abidjan: 1000,
    Divo:    1500,
  },
  Tiassalé: {
    Abidjan: 500,
    Divo:    800,
  },
  Tabou: {
    Abidjan:     5000,
    "San Pédro": 2000,
    "San Pedro": 2000,
    Soubré:      3000,
  },
  Touba: {
    Abidjan: 7000,
    Korhogo: 4500,
    Man:     3000,
    Odienné: 2000,
  },
};

/**
 * Retourne le prix fixe pour un trajet ville→ville.
 * Cherche d'abord en direct, puis en sens inverse (symétrique).
 * Retourne null si le trajet n'est pas dans la grille.
 */
export function getTicketPrice(from: string, to: string): number | null {
  if (PRICE_GRID[from]?.[to] != null) return PRICE_GRID[from][to];
  if (PRICE_GRID[to]?.[from] != null) return PRICE_GRID[to][from];
  return null;
}

/** Liste de toutes les villes couvertes par la grille */
export const ALL_CITIES: string[] = Array.from(
  new Set([
    ...Object.keys(PRICE_GRID),
    ...Object.values(PRICE_GRID).flatMap(Object.keys),
  ])
)
  .filter((c) => c !== "San Pedro")
  .sort();
