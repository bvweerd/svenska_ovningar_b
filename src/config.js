// Instellingen van de site.

// GoatCounter-code voor anonieme bezoekers- en vraagstatistieken (https://www.goatcounter.com).
// Laat leeg om niets te meten. Bij code "svensk-ovningar" gaan de gegevens naar
// https://svensk-ovningar.goatcounter.com.
// Paden krijgen dit voorvoegsel, zodat ze in GoatCounter los staan van de A1–A2-site.
export const PATH_PREFIX = '/b';

// A1–A2-site (hoofdstuk 0–12).
export const A_SITE = 'https://bvweerd.github.io/svenska_ovningar/';

export const GOATCOUNTER_CODE = import.meta.env?.VITE_GOATCOUNTER || 'bvweerd';

// Foutmeldingen: adres van de Cloudflare Worker (zie worker/README.md) en de openbare
// sitekey van Turnstile. Laat een van beide leeg om de knop „Meld een fout” te verbergen.
export const REPORT_URL = import.meta.env?.VITE_REPORT_URL || '';
export const TURNSTILE_SITEKEY = import.meta.env?.VITE_TURNSTILE_SITEKEY || '';
// In deze repo komen de issues. De Worker accepteert alleen repo's uit zijn eigen lijst.
export const REPORT_REPO = 'bvweerd/svenska_ovningar_b';
