// Prestaties uitreiken: na elke verandering van de voortgang kijken of er een badge bij is gekomen.
import { course } from './content.js';
import { progressStore } from './progress.js';
import { awardBadges, badgeOverview } from '../core/rewards/badges.js';
import { trackEvent } from '../platform/analytics.js';

/** Alle badges met hun stand (voor de pagina Prestaties). */
export const badges = () => badgeOverview(progressStore.get(), course);

/**
 * @param onAward(fresh)  nieuwe badges na iets wat de leerling hier deed (toon een melding).
 * Badges die bij het starten al verdiend blijken (oude voortgang) of via synchroniseren of import
 * binnenkomen, worden stil toegevoegd.
 */
export function initBadges({ onAward = () => {} } = {}) {
  const award = (state, announce) => {
    const out = awardBadges(state, course);
    if (!out.fresh.length) return;
    progressStore.set(out.state, 'badge');
    if (!announce) return;
    for (const b of out.fresh) trackEvent(`badge/${b.id}`, `Badge: ${b.title}`);
    onAward(out.fresh);
  };
  award(progressStore.get(), false);
  progressStore.subscribe((state, { reason }) => {
    if (reason !== 'badge') award(state, reason === 'local');
  });
}
