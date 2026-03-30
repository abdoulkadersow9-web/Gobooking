export const CI_CITIES: string[] = [
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
  "Oumé", "San Pedro", "Sassandra", "Séguéla", "Sikensi",
  "Sinématiali", "Sinfra", "Soubré", "Tabou", "Tafiré", "Taï",
  "Tanda", "Tengréla", "Tiassalé", "Tiébissou", "Touba", "Toulepleu", "Toumodi",
  "Vavoua", "Yamoussoukro", "Zouan-Hounien", "Zuénoula",
].sort();

export function searchCICity(query: string, cities: string[] = CI_CITIES): string[] {
  if (!query.trim()) return cities;
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return cities.filter(c => {
    const normalized = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized.includes(q) || c.toLowerCase().includes(query.toLowerCase());
  });
}
