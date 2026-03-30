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

function normalize(city: string): string {
  return city.trim().toLowerCase().replace(/[-\s]+/g, "");
}

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

export function getRouteAllCities(from: string, to: string): string[] {
  const path = bfsPath(from, to);
  if (!path) return [from, to];
  return path;
}

export function getRouteStops(from: string, to: string): string[] {
  const all = getRouteAllCities(from, to);
  if (all.length <= 2) return [];
  return all.slice(1, -1);
}

export const ALL_CI_CITIES: string[] = [
  "Abengourou", "Abidjan", "Aboisso", "Adzopé", "Agboville", "Agnibilékrou",
  "Anyama", "Bangolo", "Béoumi", "Bettié", "Biankouma", "Bingerville",
  "Bocanda", "Bondoukou", "Bongouanou", "Bonoua", "Bouna", "Bouaflé", "Bouaké",
  "Boundiali", "Dabakala", "Dabou", "Daloa", "Danané", "Daoukro",
  "Diawala", "Dimbokro", "Divo", "Duékoué",
  "Ferkessédougou", "Fresco", "Gagnoa", "Grand-Bassam",
  "Grand-Béréby", "Grand-Lahou", "Guiglo", "Guitry", "Issia", "Jacqueville",
  "Kafolo", "Kani", "Katiola", "Kong", "Korhogo", "Lakota",
  "M'Bahiakro", "Man", "Mankono", "Méagui", "Minignan",
  "Niakaramandougou", "Niablé", "Niellé", "Odienné", "Ouangolodougou",
  "Oumé", "San-Pédro", "Sassandra", "Séguéla", "Sikensi",
  "Sinématiali", "Sinfra", "Soubré", "Tabou", "Tafiré", "Taï",
  "Tanda", "Tengréla", "Tiassalé", "Tiébissou", "Touba", "Toulepleu", "Toumodi",
  "Vavoua", "Yamoussoukro", "Zouan-Hounien", "Zuénoula",
].sort();

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function searchCities(query: string, cities: string[] = ALL_CI_CITIES): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return cities;
  return cities.filter(c =>
    c.toLowerCase().includes(q) ||
    removeDiacritics(c).toLowerCase().includes(removeDiacritics(q))
  );
}

export const TRIP_TYPE_MULTIPLIER: Record<string, number> = {
  standard: 1.0,
  vip:      1.3,
  vip_plus: 1.6,
};
