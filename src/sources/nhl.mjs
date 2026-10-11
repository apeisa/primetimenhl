import { request, mapLimit, unique } from '../http.mjs';
import { addDays } from '../time.mjs';

export function parseSchedule(raw) {
  if (!Array.isArray(raw.gameWeek)) throw new Error('NHL:n otteluohjelman rakenne muuttui');
  return raw.gameWeek.flatMap(day => day.games ?? []).map(game => {
    if (!game.id || !game.awayTeam?.abbrev || !game.homeTeam?.abbrev || !Number.isFinite(Date.parse(game.startTimeUTC))) {
      throw new Error('NHL:n ottelutiedoista puuttuu pakollinen kenttä');
    }
    const team = value => ({
      id: value.id, abbrev: value.abbrev,
      name: `${value.placeName.default} ${value.commonName.default}`,
    });
    return {
      id: game.id, startTimeUTC: game.startTimeUTC,
      away: team(game.awayTeam), home: team(game.homeTeam),
      scheduleState: game.gameScheduleState, gameState: game.gameState,
      url: `https://www.nhl.com${game.gameCenterLink}`,
    };
  });
}

export async function fetchNhl({ date, days }) {
  // Include the preceding UTC date for Finland's early morning games.
  const first = addDays(date, -1);
  const dates = Array.from({ length: Math.ceil((days + 2) / 7) }, (_, i) => addDays(first, i * 7));
  const weeks = await mapLimit(dates, 3, async d => parseSchedule(JSON.parse(await request(`https://api-web.nhle.com/v1/schedule/${d}`))));
  return { items: unique(weeks.flat(), game => game.id), url: 'https://www.nhl.com/schedule' };
}
