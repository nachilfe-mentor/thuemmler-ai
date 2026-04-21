# Shift07.ai - Thümmler AI GmbH

## Sprache & Rechtschreibung

Alle Inhalte auf dieser Website sind auf Deutsch. Bei jeder Änderung an Textinhalten:

1. **Immer echte Unicode-Umlaute verwenden:** ü, ä, ö, Ü, Ä, Ö, ß - niemals ASCII-Ersetzungen (ue, ae, oe, ss)
2. **Bei neuem Content:** Vor dem Commit den gesamten neuen Text auf korrekte deutsche Rechtschreibung prüfen
3. **Bei Änderungen an bestehenden Seiten:** Auch den umliegenden Text auf Umlaut-Fehler und Rechtschreibfehler scannen und mitfixen
4. **Firmenname:** "Thümmler AI GmbH" (mit ü) in sichtbarem Text. In Dateinamen/URLs ist "thuemmler" akzeptabel.
5. **Keine Em-Dashes:** Das Zeichen — (U+2014) sowie `&mdash;`, `&#8212;`, `&#x2014;` sind vollständig verboten. Stattdessen normale Bindestriche (-), Kommas oder Punkte verwenden. Bei jeder Dateiänderung prüfen ob Em-Dashes eingeschlichen sind.
6. **Kein persönlicher Autorenname:** Autor ist immer "Thümmler AI GmbH", nie "Laurenz Thümmler" oder ein anderer Personenname.

## Personen & Rollen

- **Thümmler AI GmbH** - das Unternehmen, Autor aller Inhalte
- **Helene Thümmler** - Geschäftsführerin der GmbH (nur im Impressum und auf ueber-uns.html)
- Kein anderer Personenname taucht auf der Website auf

## Technologie

- Frontend: HTML + Tailwind CSS + Vanilla JS (kein Framework)
- Backend: Supabase Edge Functions (TypeScript/Deno)
- Payments: Stripe
- Hosting: GitHub Pages (Domain: shift07.ai)
- Analytics: Google Analytics (G-K1S1RXBDS8)
- AdSense: ca-pub-8475857002943858 (Auto-Ads auf Blog + Tools; index.html ist von Auto-Ads ausgeschlossen)

## Seitenstruktur

- `/` - Haupt-Landing-Page (SaaS-Tool-Einstieg)
- `/app/` - Eingeloggte App (SPA, kein AdSense)
- `/blog/` - SEO-Blog mit 100+ Artikeln (AdSense aktiv)
- `/tools/` - 60+ kostenlose Browser-Tools (AdSense aktiv)
- `/ueber-uns.html` - About-Seite (Thümmler AI GmbH, Helene Thümmler als GF, E-E-A-T)
- `/impressum.html`, `/datenschutz.html`, `/agb.html` - Rechtliches

## AdSense-Strategie

Google hat die Website 2026-04 wegen "minderwertige Inhalte" abgelehnt. Behobene Massnahmen und Erkenntnisse:

1. **AdSense lohnt sich nur auf Blog + Tools**, nicht auf der App. Bei gleichem Traffic bringt ein SaaS-Abo 10-30x mehr Umsatz als AdSense-Klicks.
2. **E-E-A-T ist entscheidend** - `/ueber-uns.html` mit Firmeninfo und Geschäftsführerin ist Pflicht für AdSense-Genehmigung.
3. **Blog-Artikel Autorschaft** - Autor ist "Thümmler AI GmbH" (Organization), verlinkt auf `/ueber-uns.html`.
4. **Kein Overselling von AdSense** - Erst erneut beantragen wenn mindestens 500 organische Besucher/Monat. Primarziel: Traffic zu SaaS-Conversions.
5. **Auto-Ads** sind auf Blog und Tool-Seiten aktiv (AdSense-Script im Head). Manuelle Ad-Units werden nicht verwendet.

## Navigation - Konsistenz

Alle Seiten (Blog, Tools, Impressum, etc.) haben in Nav und Footer Links zu:
- `/ueber-uns.html`
- `/impressum.html`
- `/datenschutz.html`
- `/agb.html`

Bei neuen Seiten diese Links immer einbinden. Die index.html hat zusätzlich Blog- und Tools-Links in der Nav.
