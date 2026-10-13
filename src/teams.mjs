import { readFileSync } from 'node:fs';
const leagueTeams = JSON.parse(readFileSync(new URL('../data/league-teams.json', import.meta.url), 'utf8'));
const aliases = {
  ANA: ['Anaheim', 'Ducks'], BOS: ['Boston', 'Bruins'], BUF: ['Buffalo', 'Sabres'],
  CAR: ['Carolina', 'Hurricanes'], CBJ: ['Columbus', 'Blue Jackets'], CGY: ['Calgary', 'Flames'],
  CHI: ['Chicago', 'Blackhawks'], COL: ['Colorado', 'Avalanche'], DAL: ['Dallas', 'Stars'],
  DET: ['Detroit', 'Red Wings'], EDM: ['Edmonton', 'Oilers'], FLA: ['Florida', 'Panthers'],
  LAK: ['Los Angeles', 'LA Kings', 'Kings'], MIN: ['Minnesota', 'Wild'], MTL: ['Montreal', 'Montréal', 'Canadiens'],
  NJD: ['New Jersey', 'Devils'], NSH: ['Nashville', 'Predators'], NYI: ['NY Islanders', 'New York Islanders', 'Islanders'],
  NYR: ['NY Rangers', 'New York Rangers', 'Rangers'], OTT: ['Ottawa', 'Senators'], PHI: ['Philadelphia', 'Flyers'],
  PIT: ['Pittsburgh', 'Penguins'], SEA: ['Seattle', 'Kraken'], SJS: ['San Jose', 'Sharks'],
  STL: ['St. Louis', 'St Louis', 'Blues'], TBL: ['Tampa Bay', 'Tampa', 'Lightning'],
  TOR: ['Toronto', 'Maple Leafs'], UTA: ['Utah', 'Mammoth'], VAN: ['Vancouver', 'Canucks'],
  VGK: ['Vegas', 'Golden Knights'], WPG: ['Winnipeg', 'Jets'], WSH: ['Washington', 'Capitals'],
};

const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function teamsInTitle(title, league = 'nhl') {
  const text = ` ${normalize(title)} `;
  const entries = Object.entries(league === 'nhl' ? aliases : leagueTeams[league] ?? {});
  const includes = name => name && text.includes(` ${normalize(name)} `);
  if (league === 'nhl') return entries.filter(([abbrev, names]) => [abbrev, ...names].some(includes)).map(([abbrev]) => abbrev);
  const scored = entries.map(([abbrev, names]) => {
    const cities = league === 'nba' && ['LAL', 'LAC'].includes(abbrev) ? ['LA', 'Los Angeles'] : [names[league === 'mlb' ? 2 : 3]];
    const specific = [abbrev, ...names.filter(name => !cities.some(city => normalize(city) === normalize(name)))].some(includes);
    return { abbrev, specific, city: cities.some(includes) };
  });
  // A named team wins over another franchise sharing its city; city-only LA/NY
  // references remain ambiguous and are never guessed into a free broadcast.
  const specific = scored.filter(team => team.specific);
  return (specific.length === 2 ? specific : scored.filter(team => team.specific || team.city)).map(team => team.abbrev);
}

export function isGameTitle(title, league = 'nhl') {
  return !/uusinta|replay|highlights|kohokoh|kooste|on the fly|kausiennakko|studio|sirkus|redzone/i.test(title)
    && teamsInTitle(title, league).length === 2;
}
