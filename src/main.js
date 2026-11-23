// Compositie: alles aanmaken en aan elkaar knopen. Hier staat geen pagina en geen logica.
import './styles.css';
import { course } from './app/content.js';
import {
  getPref, setPref, migrateToIds, progressSnapshot, mergeProgress, progressStore,
} from './app/progress.js';
import { bindProgress, initSync } from './platform/sync.js';
import { usePrefs } from './platform/speech.js';
import { initPwa, isStandalone } from './platform/pwa.js';
import { writeFailed } from './platform/storage.js';
import { toast } from './ui/components/toast.js';
import { initAnalytics, trackPage } from './platform/analytics.js';
import { knownWords } from './core/content/known-words.js';
import { setKnownWords } from './ui/items/tiles.js';
import { reportSpeechStatus } from './ui/views/listen.js';
import { createMenu } from './ui/menu.js';
import { initAppNav } from './ui/nav.js';
import { showUpdate } from './ui/components/pwa.js';
import { countVisit } from './ui/onboarding.js';
import { charBar } from './ui/components/charbar.js';
import { themeToggle } from './ui/components/theme.js';
import { createRouter } from './ui/router.js';
import { routes } from './ui/routes.js';
import { initBadges } from './app/rewards.js';
import { announceBadges } from './ui/views/badges.js';

const app = document.getElementById('app');

usePrefs(getPref, setPref);
bindProgress(progressSnapshot, mergeProgress);
setKnownWords(...knownWords(course));
// Oude voortgang (opgeslagen op de plek van een vraag) eenmalig omzetten naar vraag-id's.
migrateToIds(course);
const updateMenu = createMenu(course);
initAnalytics();
initPwa({ onUpdate: showUpdate });
countVisit();
reportSpeechStatus();
// Geïnstalleerde app: de terugknop gaat naar de bovenliggende pagina (zie nav.js).
if (isStandalone()) initAppNav();

const router = createRouter({
  root: app,
  routes,
  after(path) {
    updateMenu(path);
    trackPage(path, document.title);
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  },
});
charBar();
themeToggle();
router.start();
// Voortgang van buiten (ander apparaat, import, wissen): pagina's zonder invoer opnieuw tekenen.
progressStore.subscribe((_state, { reason }) => {
  if (reason === 'sync' || reason === 'import' || reason === 'reset') router.refresh();
});
initBadges({ onAward: announceBadges });
// Lukt opslaan niet, zeg dat één keer: anders lijkt de app voortgang te vergeten.
let warned = false;
progressStore.subscribe(() => {
  if (warned || !writeFailed()) return;
  warned = true;
  toast('Je voortgang kan op dit apparaat niet worden opgeslagen (opslag vol, of een privévenster). Exporteer je voortgang op de pagina Over, of zet synchroniseren aan.', { ms: 15000 });
});
initSync();
