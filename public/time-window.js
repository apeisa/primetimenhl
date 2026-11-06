const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

// Use elapsed time so every start gets the same three hours, including across
// midnight, time zones and daylight-saving changes. Shared by build and browser.
export function isWithinViewingWindow(start, now) {
  return new Date(now).getTime() < Date.parse(start) + THREE_HOURS_MS;
}
