/**
 * Grille tarifaire officielle GoBooking — Côte d'Ivoire
 * Prix Standard en FCFA par paire de villes (ville de départ → ville d'arrivée)
 * La grille est symétrique : A→B = B→A
 * Source : tarifs réels du transport interurbain ivoirien (bus Standard)
 */
export const PRICE_GRID: Record<string, Record<string, number>> = {
  Abidjan: {
    Yamoussoukro:        2000,
    Toumodi:             1500,
    Bouaké:              2500,
    Daloa:               3500,
    Korhogo:             7000,
    "San-Pédro":         3500,
    "San Pédro":         3500,
    "San Pedro":         3500,
    Man:                 5000,
    Gagnoa:              2000,
    Divo:                1000,
    Abengourou:          2000,
    Soubré:              4000,
    Bondoukou:           5000,
    Sassandra:           2500,
    Odienné:             7500,
    Ferkessédougou:      7500,
    Séguéla:             4500,
    Tiassalé:             500,
    Agboville:            800,
    Tabou:               4500,
    Touba:               6500,
    Lakota:              1800,
    Daoukro:             3000,
    Bongouanou:          2000,
    Aboisso:             1200,
    "Grand-Bassam":         500,
    Sikensi:              600,
    Issia:               4000,
    Vavoua:              5000,
    Mankono:             5500,
    Oumé:                2500,
    Sinfra:              3000,
    Méagui:              5000,
    Danané:              6000,
    Duékoué:             5500,
    Guiglo:              5500,
    Tengréla:            8500,
    Katiola:             3500,
    Niakaramandougou:    5000,
    Ferkessédougou:      7500,
    Tafiré:              5500,
    Sinématiali:         7000,
    Boundiali:           7500,
    Bouaflé:             2500,
    Zuénoula:            4000,
  },
  Yamoussoukro: {
    Abidjan:             2000,
    Toumodi:              500,
    Bouaké:              1500,
    Katiola:             2000,
    Niakaramandougou:    3000,
    Ferkessédougou:      5500,
    Korhogo:             5000,
    Daloa:               1500,
    Gagnoa:              1200,
    Man:                 3500,
    Divo:                1500,
    Séguéla:             2500,
    Sinfra:               700,
    Bouaflé:             1000,
    Tiassalé:            1500,
    Agboville:           3000,
    Soubré:              3000,
    Oumé:                1200,
  },
  Toumodi: {
    Abidjan:             1500,
    Yamoussoukro:         500,
    Divo:                 500,
    Tiassalé:            1000,
    Bouaké:              2000,
  },
  Bouaké: {
    Abidjan:             2500,
    Yamoussoukro:        1500,
    Korhogo:             3000,
    Daloa:               2000,
    Man:                 3500,
    Bondoukou:           2500,
    Abengourou:          2500,
    Ferkessédougou:      4000,
    Séguéla:             2000,
    Katiola:              700,
    Niakaramandougou:    1500,
    Tafiré:              1000,
    Dimbokro:             800,
    Bongouanou:          1000,
    Mbahiakro:            500,
  },
  Katiola: {
    Bouaké:               700,
    Yamoussoukro:        2000,
    Abidjan:             3500,
    Niakaramandougou:     500,
    Tafiré:               300,
    Ferkessédougou:      2500,
    Korhogo:             3500,
  },
  Tafiré: {
    Katiola:              300,
    Niakaramandougou:     200,
    Bouaké:              1000,
    Ferkessédougou:      2000,
  },
  Niakaramandougou: {
    Katiola:              500,
    Tafiré:               200,
    Bouaké:              1500,
    Yamoussoukro:        3000,
    Abidjan:             5000,
    Ferkessédougou:      1500,
    Korhogo:             3000,
  },
  Korhogo: {
    Abidjan:             7000,
    Bouaké:              3000,
    Yamoussoukro:        5000,
    Man:                 4000,
    Ferkessédougou:      1500,
    Odienné:             3500,
    Touba:               4000,
    Sinématiali:          500,
    Boundiali:           1500,
    Tengréla:            2000,
    Niakaramandougou:    3000,
    Katiola:             3500,
  },
  Ferkessédougou: {
    Abidjan:             7500,
    Bouaké:              4000,
    Korhogo:             1500,
    Sinématiali:         1000,
    Niakaramandougou:    1500,
    Katiola:             2500,
    Yamoussoukro:        5500,
    Kong:                 800,
  },
  Sinématiali: {
    Ferkessédougou:      1000,
    Korhogo:              500,
  },
  Kong: {
    Ferkessédougou:       800,
    Korhogo:             1200,
  },
  "San-Pédro": {
    Abidjan:             3500,
    Daloa:               3000,
    Gagnoa:              2500,
    Soubré:              1200,
    Sassandra:           1000,
    Tabou:               1500,
    Méagui:              1500,
  },
  "San Pédro": {
    Abidjan:             3500,
    Daloa:               3000,
    Gagnoa:              2500,
    Soubré:              1200,
    Sassandra:           1000,
    Tabou:               1500,
  },
  "San Pedro": {
    Abidjan:             3500,
    Daloa:               3000,
    Gagnoa:              2500,
    Soubré:              1200,
    Sassandra:           1000,
    Tabou:               1500,
  },
  Daloa: {
    Abidjan:             3500,
    Bouaké:              2000,
    Yamoussoukro:        1500,
    Man:                 1500,
    Gagnoa:              1200,
    Soubré:              2000,
    "San-Pédro":         3000,
    "San Pedro":         3000,
    Séguéla:             1500,
    Issia:                600,
    Vavoua:              1000,
    Sinfra:               800,
    Bouaflé:             1200,
    Zuénoula:            1200,
    Oumé:                1500,
    Korhogo:             5000,
    Ferkessédougou:      6000,
  },
  Issia: {
    Daloa:                600,
    Gagnoa:               800,
    Soubré:              1000,
  },
  Sinfra: {
    Yamoussoukro:         700,
    Daloa:                800,
    Bouaflé:              500,
  },
  Bouaflé: {
    Yamoussoukro:        1000,
    Daloa:               1200,
    Sinfra:               500,
    Zuénoula:             800,
  },
  Zuénoula: {
    Daloa:               1200,
    Bouaflé:              800,
  },
  Man: {
    Abidjan:             5000,
    Bouaké:              3500,
    Daloa:               1500,
    Korhogo:             4000,
    Yamoussoukro:        3500,
    Odienné:             3000,
    Touba:               2500,
    Séguéla:             2000,
    Danané:              1000,
    Biankouma:           1200,
    Duékoué:             1500,
    Guiglo:              2000,
    "Zouan-Hounien":       1500,
  },
  Danané: {
    Man:                 1000,
    "Zouan-Hounien":        700,
  },
  Biankouma: {
    Man:                 1200,
  },
  Duékoué: {
    Man:                 1500,
    Guiglo:              1000,
    Daloa:               2000,
  },
  Guiglo: {
    Duékoué:             1000,
    Man:                 2000,
    "Zouan-Hounien":        800,
    Toulepleu:           1000,
    Taï:                 1500,
  },
  "Zouan-Hounien": {
    Man:                 1500,
    Danané:               700,
    Guiglo:               800,
  },
  Toulepleu: {
    Guiglo:              1000,
  },
  Gagnoa: {
    Abidjan:             2000,
    Daloa:               1200,
    Yamoussoukro:        1200,
    "San-Pédro":         2500,
    "San Pedro":         2500,
    Soubré:              1200,
    Divo:                1000,
    Issia:                800,
    Lakota:               600,
    Oumé:                1000,
  },
  Oumé: {
    Gagnoa:              1000,
    Daloa:               1500,
    Divo:                 800,
  },
  Divo: {
    Abidjan:             1000,
    Gagnoa:              1000,
    Daloa:               2000,
    Yamoussoukro:        1500,
    Tiassalé:             500,
    Toumodi:              500,
    Lakota:               700,
    Oumé:                 800,
  },
  Lakota: {
    Divo:                 700,
    Gagnoa:               600,
    Soubré:              1000,
    Abidjan:             1800,
  },
  Abengourou: {
    Abidjan:             2000,
    Bouaké:              2500,
    Bondoukou:           2000,
    Agboville:           1500,
    Aboisso:             1000,
    Daoukro:             1000,
    Mbahiakro:           1200,
    Dimbokro:            1500,
    Bongouanou:          1200,
  },
  Daoukro: {
    Abengourou:          1000,
    Mbahiakro:            500,
    Bouaké:              1500,
    Bocanda:              700,
  },
  Bocanda: {
    Daoukro:              700,
    Dimbokro:             800,
  },
  Dimbokro: {
    Bouaké:               800,
    Bocanda:              800,
    Bongouanou:           700,
    Abengourou:          1500,
  },
  Bongouanou: {
    Dimbokro:             700,
    Abengourou:          1200,
    Bouaké:              1000,
  },
  Mbahiakro: {
    Abengourou:          1200,
    Daoukro:              500,
    Bouaké:               500,
  },
  Soubré: {
    "San-Pédro":         1200,
    "San Pedro":         1200,
    Daloa:               2000,
    Gagnoa:              1200,
    Abidjan:             4000,
    Sassandra:           1500,
    Tabou:               2500,
    Issia:               1000,
    Lakota:              1000,
    Taï:                 1500,
    Méagui:               800,
  },
  Méagui: {
    Soubré:               800,
    "San-Pédro":         1500,
  },
  Bondoukou: {
    Abidjan:             5000,
    Bouaké:              2500,
    Abengourou:          2000,
    Bouna:               2000,
  },
  Bouna: {
    Bondoukou:           2000,
  },
  Ferkessédougou: {
    Abidjan:             7500,
    Bouaké:              4000,
    Korhogo:             1500,
  },
  Odienné: {
    Abidjan:             7500,
    Korhogo:             3500,
    Man:                 3000,
    Touba:               1500,
    Boundiali:           2000,
  },
  Boundiali: {
    Korhogo:             1500,
    Odienné:             2000,
    Tengréla:             500,
  },
  Tengréla: {
    Korhogo:             2000,
    Boundiali:            500,
  },
  Sassandra: {
    Abidjan:             2500,
    "San-Pédro":         1000,
    "San Pedro":         1000,
    Soubré:              1500,
    Fresco:              1200,
  },
  Fresco: {
    Sassandra:           1200,
    "Grand-Lahou":       1000,
  },
  "Grand-Lahou": {
    Fresco:              1000,
    Sikensi:              800,
    Abidjan:             1500,
  },
  Sikensi: {
    Abidjan:              600,
    "Grand-Lahou":        800,
    Tiassalé:             600,
  },
  Séguéla: {
    Abidjan:             4500,
    Bouaké:              2000,
    Yamoussoukro:        2500,
    Man:                 2000,
    Daloa:               1500,
    Touba:               1500,
    Mankono:             1000,
    Vavoua:              1000,
  },
  Vavoua: {
    Séguéla:             1000,
    Daloa:               1000,
  },
  Mankono: {
    Séguéla:             1000,
    Touba:               1500,
  },
  Agboville: {
    Abidjan:              800,
    Divo:                1000,
    Tiassalé:             500,
    Abengourou:          1500,
  },
  Tiassalé: {
    Abidjan:              500,
    Divo:                 500,
    Agboville:            500,
    Yamoussoukro:        1500,
    Toumodi:             1000,
    Sikensi:              600,
  },
  Tabou: {
    Abidjan:             4500,
    "San-Pédro":         1500,
    "San Pedro":         1500,
    Soubré:              2500,
    "Grand-Béréby":       800,
  },
  "Grand-Béréby": {
    Tabou:                800,
  },
  Touba: {
    Abidjan:             6500,
    Korhogo:             4000,
    Man:                 2500,
    Odienné:             1500,
    Séguéla:             1500,
    Mankono:             1500,
  },
  Aboisso: {
    Abidjan:             1200,
    Abengourou:          1000,
    "Grand-Bassam":       700,
  },
  "Grand-Bassam": {
    Abidjan:              500,
    Aboisso:              700,
  },
  Taï: {
    Guiglo:              1500,
    Soubré:              1500,
  },
};

/**
 * Multiplicateur de prix selon le type de départ
 */
export const TRIP_TYPE_MULTIPLIER: Record<string, number> = {
  standard:  1.0,
  vip:       1.3,
  vip_plus:  1.6,
};

/**
 * Retourne le prix fixe Standard pour un trajet ville→ville.
 * Cherche d'abord en direct, puis en sens inverse (symétrique).
 * Retourne null si le trajet n'est pas dans la grille.
 */
export function getTicketPrice(from: string, to: string, tripType: string = "standard"): number | null {
  const basePrice = _lookupBase(from, to);
  if (basePrice === null) return null;
  const mult = TRIP_TYPE_MULTIPLIER[tripType] ?? 1.0;
  return Math.round(basePrice * mult / 100) * 100;
}

function _lookupBase(from: string, to: string): number | null {
  if (PRICE_GRID[from]?.[to] != null) return PRICE_GRID[from][to];
  if (PRICE_GRID[to]?.[from] != null) return PRICE_GRID[to][from];
  // Try normalized names
  const fromNorm = from.replace(/-/g, " ").toLowerCase();
  const toNorm   = to.replace(/-/g, " ").toLowerCase();
  for (const [city, targets] of Object.entries(PRICE_GRID)) {
    if (city.replace(/-/g, " ").toLowerCase() === fromNorm) {
      for (const [target, price] of Object.entries(targets)) {
        if (target.replace(/-/g, " ").toLowerCase() === toNorm) return price;
      }
    }
    if (city.replace(/-/g, " ").toLowerCase() === toNorm) {
      for (const [target, price] of Object.entries(targets)) {
        if (target.replace(/-/g, " ").toLowerCase() === fromNorm) return price;
      }
    }
  }
  return null;
}

/** Liste de toutes les villes couvertes par la grille */
export const ALL_CITIES: string[] = Array.from(
  new Set([
    ...Object.keys(PRICE_GRID),
    ...Object.values(PRICE_GRID).flatMap(Object.keys),
  ])
)
  .filter((c) => c !== "San Pedro" && c !== "San Pédro")
  .sort();
