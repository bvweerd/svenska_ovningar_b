-- Voortgang per synccode en site. id = SHA-256 van de synccode (de code zelf staat nergens).
-- WITHOUT ROWID: één schrijfactie per opslag (telt mee voor de gratis limiet van D1).
CREATE TABLE IF NOT EXISTS progress (
  id TEXT NOT NULL,
  site TEXT NOT NULL,
  rev INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (id, site)
) WITHOUT ROWID;
