// Ghost-job signals for a job page, from public.wilsy_job_history: has this company listed the same
// role before (and closed it), and how long has this listing been open? Pure, no network.
// Repost detection is adapted from the open-source career-ops project (MIT licence).

export const LONG_OPEN_DAYS = 90;

const day = value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}) : '';
};

/** {level: 'warn' | 'note', title, text} for the job page, or null when there is nothing to say. */
export function historyNote(history) {
  if(!history || typeof history !== 'object') return null;
  const earlier = Number(history.earlier) || 0, open = Number(history.open_days) || 0;
  if(earlier >= 1) {
    const closed = history.last_closed ? day(history.last_closed) : '';
    const times = earlier === 1 ? 'once before' : `${earlier} times before`;
    return {level: earlier >= 2 ? 'warn' : 'note', title: earlier >= 2 ? 'Posted again and again' : 'Posted before',
      text: `This company listed the same role ${times}${closed ? `, most recently closing on ${closed}` : ''}. A role that keeps coming back may be hard to fill, always open, or not really hiring. Check the company’s careers page, and look for a recent post from its recruiters, before you spend long on the application.`};
  }
  if(open >= LONG_OPEN_DAYS) return {level: 'note', title: `Open for ${open} days`,
    text: 'Listings open this long are sometimes kept up for future hiring rather than a current opening. Apply, but don’t wait on it.'};
  return null;
}
