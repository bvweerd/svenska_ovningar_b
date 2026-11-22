// Compositie: alles aanmaken en aan elkaar knopen. Hier staat geen pagina en geen logica.
import './styles.css';
import { course } from './app/content.js';
import {
  getPref, setPref, migrateToIds, progressSnapshot, mergeProgress,
} from './app/progress.js';
import { bindProgress, initSync } from './platform/sync.js';
import { usePrefs } from './platform/speech.js';
import { initPwa, isStandalone } from './platform/pwa.js';
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
// Voortgang van een ander apparaat binnengekomen: pagina's zonder invoer opnieuw tekenen.
initSync(() => router.refresh());
