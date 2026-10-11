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
export function teamsInTitle(title) {
  const text = ` ${normalize(title)} `;
  return Object.entries(aliases)
    .filter(([abbrev, names]) => [abbrev, ...names].some(name => text.includes(` ${normalize(name)} `)))
    .map(([abbrev]) => abbrev);
}

export function isGameTitle(title) {
  return !/uusinta|replay|highlights|kohokoh|kooste|on the fly|kausiennakko|studio|sirkus/i.test(title)
    && teamsInTitle(title).length === 2;
}
