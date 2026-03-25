/**
 * Grille tarifaire officielle GoBooking — Côte d'Ivoire
 * Prix Standard en FCFA par paire de villes (ville de départ → ville d'arrivée)
 * La grille est symétrique : A→B = B→A
 * Source : tarifs réels du transport interurbain ivoirien (bus Standard)
 */
export const PRICE_GRID: Record<string, Record<string, number>> = {
  Abidjan: {
    Yamoussoukro:   2000,
    Bouaké:         2500,
    Daloa:          3500,
    Korhogo:        7000,
    "San Pédro":    3500,
    "San Pedro":    3500,
    Man:            5000,
    Gagnoa:         2000,
    Divo:           1000,
    Abengourou:     2000,
    Soubré:         4000,
    Bondoukou:      5000,
    Sassandra:      2500,
    Odienné:        7500,
    Ferkessédougou: 7500,
    Séguéla:        4500,
    Tiassalé:        500,
    Agboville:       800,
    Tabou:          4500,
    Touba:          6500,
  },
  Yamoussoukro: {
    Abidjan:    2000,
    Bouaké:     1500,
    Korhogo:    5000,
    Daloa:      1500,
    Gagnoa:     1200,
    Man:        3500,
    Divo:       1500,
    Séguéla:    2500,
  },
  Bouaké: {
    Abidjan:        2500,
    Yamoussoukro:   1500,
    Korhogo:        3000,
    Daloa:          2000,
    Man:            3500,
    Bondoukou:      2500,
    Abengourou:     2500,
    Ferkessédougou: 4000,
    Séguéla:        2000,
  },
  Korhogo: {
    Abidjan:        7000,
    Bouaké:         3000,
    Yamoussoukro:   5000,
    Man:            4000,
    Ferkessédougou: 1500,
    Odienné:        3500,
    Touba:          4000,
  },
  "San Pédro": {
    Abidjan:   3500,
    Daloa:     3000,
    Gagnoa:    2500,
    Soubré:    1200,
    Sassandra: 1000,
    Tabou:     1500,
  },
  "San Pedro": {
    Abidjan:   3500,
    Daloa:     3000,
    Gagnoa:    2500,
    Soubré:    1200,
    Sassandra: 1000,
    Tabou:     1500,
  },
  Daloa: {
    Abidjan:        3500,
    Bouaké:         2000,
    Yamoussoukro:   1500,
    Man:            1500,
    Gagnoa:         1200,
    Soubré:         2000,
    "San Pédro":    3000,
    "San Pedro":    3000,
    Séguéla:        1500,
  },
  Man: {
    Abidjan:      5000,
    Bouaké:       3500,
    Daloa:        1500,
    Korhogo:      4000,
    Yamoussoukro: 3500,
    Odienné:      3000,
    Touba:        2500,
    Séguéla:      2000,
  },
  Gagnoa: {
    Abidjan:     2000,
    Daloa:       1200,
    Yamoussoukro: 1200,
    "San Pédro": 2500,
    "San Pedro": 2500,
    Soubré:      1200,
    Divo:        1000,
  },
  Divo: {
    Abidjan:      1000,
    Gagnoa:       1000,
    Daloa:        2000,
    Yamoussoukro: 1500,
    Tiassalé:      500,
  },
  Abengourou: {
    Abidjan:   2000,
    Bouaké:    2500,
    Bondoukou: 2000,
  },
  Soubré: {
    "San Pédro": 1200,
    "San Pedro": 1200,
    Daloa:       2000,
    Gagnoa:      1200,
    Abidjan:     4000,
    Sassandra:   1500,
    Tabou:       2500,
  },
  Bondoukou: {
    Abidjan:    5000,
    Bouaké:     2500,
    Abengourou: 2000,
  },
  Ferkessédougou: {
    Abidjan: 7500,
    Bouaké:  4000,
    Korhogo: 1500,
  },
  Odienné: {
    Abidjan: 7500,
    Korhogo: 3500,
    Man:     3000,
    Touba:   1500,
  },
  Sassandra: {
    Abidjan:     2500,
    "San Pédro": 1000,
    "San Pedro": 1000,
    Soubré:      1500,
  },
  Séguéla: {
    Abidjan:      4500,
    Bouaké:       2000,
    Yamoussoukro: 2500,
    Man:          2000,
    Daloa:        1500,
  },
  Agboville: {
    Abidjan: 800,
    Divo:    1000,
  },
  Tiassalé: {
    Abidjan: 500,
    Divo:    500,
  },
  Tabou: {
    Abidjan:     4500,
    "San Pédro": 1500,
    "San Pedro": 1500,
    Soubré:      2500,
  },
  Touba: {
    Abidjan: 6500,
    Korhogo: 4000,
    Man:     2500,
    Odienné: 1500,
  },
};

/**
 * Retourne le prix fixe Standard pour un trajet ville→ville.
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
