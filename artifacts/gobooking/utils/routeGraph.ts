/**
 * Graphe des routes routières de Côte d'Ivoire
 * Permet de reconstruire automatiquement le trajet complet (villes intermédiaires)
 * entre deux villes quelconques.
 */

const ROAD_NETWORK: Record<string, string[]> = {
  "Abidjan":            ["Agboville", "Tiassalé", "Yamoussoukro", "Anyama"],
  "Agboville":          ["Abidjan", "Tiassalé", "Abengourou", "Adzopé"],
  "Anyama":             ["Abidjan"],
  "Adzopé":             ["Agboville", "Aboisso"],
  "Aboisso":            ["Adzopé", "Abengourou", "Grand-Bassam"],
  "Grand-Bassam":       ["Abidjan", "Aboisso"],
  "Tiassalé":           ["Abidjan", "Agboville", "Divo", "Toumodi"],
  "Toumodi":            ["Tiassalé", "Yamoussoukro", "Divo"],
  "Divo":               ["Tiassalé", "Toumodi", "Yamoussoukro", "Gagnoa", "Lakota"],
  "Lakota":             ["Divo", "Gagnoa", "Soubré"],
  "Yamoussoukro":       ["Abidjan", "Toumodi", "Divo", "Bouaké", "Daloa", "Gagnoa", "Bouaflé", "Sinfra"],
  "Bouaflé":            ["Yamoussoukro", "Daloa"],
  "Sinfra":             ["Yamoussoukro", "Daloa"],
  "Bouaké":             ["Yamoussoukro", "Katiola", "Daloa", "Séguéla", "Abengourou", "Dimbokro", "Bongouanou"],
  "Dimbokro":           ["Bouaké", "Bongouanou", "Abengourou"],
  "Bongouanou":         ["Dimbokro", "Abengourou"],
  "Katiola":            ["Bouaké", "Niakaramandougou", "Tafiré"],
  "Tafiré":             ["Katiola", "Niakaramandougou"],
  "Niakaramandougou":   ["Katiola", "Tafiré", "Ferkessédougou"],
  "Ferkessédougou":     ["Niakaramandougou", "Korhogo", "Sinématiali", "Kong"],
  "Sinématiali":        ["Ferkessédougou", "Korhogo"],
  "Kong":               ["Ferkessédougou", "Korhogo"],
  "Korhogo":            ["Ferkessédougou", "Sinématiali", "Man", "Odienné", "Touba", "Boundiali", "Tengréla"],
  "Tengréla":           ["Korhogo", "Boundiali"],
  "Boundiali":          ["Korhogo", "Tengréla", "Odienné"],
  "Odienné":            ["Korhogo", "Man", "Touba", "Boundiali", "Minignan"],
  "Minignan":           ["Odienné"],
  "Touba":              ["Séguéla", "Man", "Odienné", "Korhogo", "Mankono"],
  "Mankono":            ["Touba", "Séguéla"],
  "Séguéla":            ["Bouaké", "Daloa", "Man", "Touba", "Mankono", "Vavoua"],
  "Vavoua":             ["Séguéla", "Daloa"],
  "Daloa":              ["Yamoussoukro", "Bouaké", "Man", "Gagnoa", "Soubré", "Séguéla", "Issia", "Vavoua", "Sinfra", "Bouaflé", "Zuénoula"],
  "Zuénoula":           ["Daloa", "Bouaflé"],
  "Issia":              ["Daloa", "Gagnoa", "Soubré"],
  "Man":                ["Daloa", "Korhogo", "Séguéla", "Touba", "Odienné", "Danané", "Biankouma", "Zouan-Hounien", "Duékoué"],
  "Danané":             ["Man", "Zouan-Hounien"],
  "Biankouma":          ["Man"],
  "Duékoué":            ["Man", "Guiglo", "Daloa"],
  "Guiglo":             ["Duékoué", "Zouan-Hounien", "Toulepleu", "Taï"],
  "Zouan-Hounien":      ["Man", "Danané", "Guiglo"],
  "Toulepleu":          ["Guiglo"],
  "Taï":                ["Guiglo", "Soubré"],
  "Gagnoa":             ["Divo", "Lakota", "Yamoussoukro", "Daloa", "Soubré", "San-Pédro", "Issia", "Oumé"],
  "Oumé":               ["Gagnoa", "Daloa", "Divo"],
  "Soubré":             ["Gagnoa", "Daloa", "Lakota", "Issia", "San-Pédro", "Sassandra", "Tabou", "Taï", "Méagui"],
  "Méagui":             ["Soubré"],
  "San-Pédro":          ["Soubré", "Sassandra", "Tabou"],
  "San Pedro":          ["Soubré", "Sassandra", "Tabou"],
  "Sassandra":          ["San-Pédro", "Soubré", "Fresco"],
  "Fresco":             ["Sassandra", "Grand-Lahou"],
  "Grand-Lahou":        ["Fresco", "Sikensi"],
  "Sikensi":            ["Grand-Lahou", "Abidjan", "Tiassalé"],
  "Tabou":              ["Soubré", "San-Pédro", "Grand-Béréby"],
  "Grand-Béréby":       ["Tabou"],
  "Abengourou":         ["Agboville", "Aboisso", "Bouaké", "Bondoukou", "Bettié", "Mbahiakro", "Daoukro"],
  "Mbahiakro":          ["Abengourou", "Bouaké", "Daoukro"],
  "Daoukro":            ["Abengourou", "Mbahiakro", "Bocanda"],
  "Bocanda":            ["Daoukro", "Dimbokro"],
  "Bondoukou":          ["Abengourou", "Bouaké", "Bouna"],
  "Bouna":              ["Bondoukou"],
  "Bettié":             ["Abengourou"],
  "Niablé":             ["Abengourou"],
  "Agnibilékrou":       ["Abengourou"],
};

/**
 * BFS pour trouver le chemin le plus court entre deux villes
 */
function bfsPath(from: string, to: string): string[] | null {
  const normFrom = normalize(from);
  const normTo   = normalize(to);

  if (normFrom === normTo) return [from];

  const queue: string[][] = [[normFrom]];
  const visited = new Set<string>([normFrom]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    const neighbors = ROAD_NETWORK[current] ?? [];

    for (const neighbor of neighbors) {
      const normNeighbor = normalize(neighbor);
      if (normNeighbor === normTo) return [...path, neighbor];
      if (!visited.has(normNeighbor)) {
        visited.add(normNeighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

function normalize(city: string): string {
  return city.trim().toLowerCase().replace(/[-\s]+/g, "");
}

/**
 * Retourne la liste complète des villes du trajet (inclut from et to)
 */
export function getRouteAllCities(from: string, to: string): string[] {
  const path = bfsPath(from, to);
  if (!path) return [from, to];
  return path;
}

/**
 * Retourne uniquement les escales intermédiaires (sans from et to)
 */
export function getRouteStops(from: string, to: string): string[] {
  const all = getRouteAllCities(from, to);
  if (all.length <= 2) return [];
  return all.slice(1, -1);
}

/**
 * Vérifie si une route directe existe dans le graphe
 */
export function routeExists(from: string, to: string): boolean {
  return bfsPath(from, to) !== null;
}

/**
 * Toutes les villes de Côte d'Ivoire (pour le picker)
 */
export const ALL_CI_CITIES: string[] = [
  "Abengourou", "Abidjan", "Aboisso", "Adzopé", "Agboville", "Agnibilékrou",
  "Anyama", "Bettié", "Biankouma", "Bingerville", "Bocanda", "Bondoukou",
  "Bongouanou", "Bonoua", "Bouna", "Bouaflé", "Bouaké", "Boundiali",
  "Dabou", "Daloa", "Danané", "Daoukro", "Dimbokro", "Divo",
  "Duékoué", "Ferkessédougou", "Fresco", "Gagnoa", "Grand-Bassam",
  "Grand-Béréby", "Grand-Lahou", "Guiglo", "Issia", "Jacqueville",
  "Katiola", "Kong", "Korhogo", "Lakota", "Man", "Mankono",
  "Mbahiakro", "Méagui", "Minignan", "Niakaramandougou", "Niablé",
  "Odienné", "Oumé", "San-Pédro", "Sassandra", "Séguéla", "Sikensi",
  "Sinématiali", "Sinfra", "Soubré", "Tabou", "Tafiré", "Taï",
  "Tengréla", "Tiassalé", "Tiébissou", "Touba", "Toulepleu", "Toumodi",
  "Vavoua", "Yamoussoukro", "Zouan-Hounien", "Zuénoula",
].sort();

/**
 * Lookup rapide d'une ville par terme de recherche (retourne les correspondances)
 */
export function searchCities(query: string, cities: string[] = ALL_CI_CITIES): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return cities;
  return cities.filter(c =>
    c.toLowerCase().includes(q) ||
    removeDiacritics(c).toLowerCase().includes(removeDiacritics(q))
  );
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
