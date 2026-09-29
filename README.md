# Maarten 2.0

Persoonlijk dashboard om elke dag een beetje beter te worden. Donker thema met blauwe accenten, gemaakt voor iPhone 13 én desktop, en te installeren als app (PWA).

## Wat zit erin

- **Gewoontes**: elke dag Spaans, 15 min Tinder en 15 min Bumble (met timer die automatisch afvinkt), 2x per week sporten (wo/zo, do als inhaaldag) en 3x per week Project Management (ma/wo/vr). Streaks en heatmaps op de pagina *Doelen*.
- **Waterpeil**: drinktracker met doel van 2300 ml, knoppen voor glas (250 ml), groot glas (350 ml) en flesje (0,5 L); houdt bij welke dagen het doel gehaald is.
- **Todo**: supersnel toevoegen met gewone taal (`Tandarts morgen 14:00 #persoonlijk !!`), afgevinkte taken blijven zichtbaar en gaan na een week naar het archief.
- **Agenda**: vast rooster (school, klussen), taken, F1, Roda JC, verjaardagen en Nederlandse/Belgische feestdagen (met (NL)/(BE)) in één week-overzicht. Elke categorie heeft een eigen kleur.
- **Automatisch**: F1-kwalificaties, sprints en races (Jolpica API) en alle Roda JC-wedstrijden (TheSportsDB) worden 2x per dag toegevoegd.
- **Terugkerende taken**: bv. uren invullen op de 1e (met herinnering t/m de 5e), salaris op de 25e, planning maken op zondag.
- **Verjaardagen**: 14 dagen van tevoren een melding.
- **Pushmeldingen**: ochtendoverzicht, gewoontes-check, water, taken, deadlines (bv. 2 weken / 1 week / 1 dag van tevoren), wedstrijden en races.

## Techniek

| Onderdeel | Keuze |
| --- | --- |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| PWA | `vite-plugin-pwa` (eigen service worker in `src/sw.ts` voor pushmeldingen) |
| Database & login | Supabase (Postgres + RLS + Auth) |
| Serverlogica | Supabase Edge Functions (`supabase/functions`) + `pg_cron` |
| Hosting | GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`) |

Alles draait op gratis tiers.

### Mappen

```
src/            app (pagina's, componenten, logica)
supabase/       migraties (schema, RLS, meldingen, cron) en edge functions
scripts/        genereert logo en app-iconen (npm run icons)
```

Persoonlijke startdata (rooster, verjaardagen, deadlines) staat alleen in de database (`public.seed_data`), niet in deze publieke repo.

## Lokaal draaien

```bash
npm install
npm run dev
```

## Installeren op iPhone

1. Open de site in **Safari**.
2. Tik op **Deel** → **Zet op beginscherm**.
3. Open de app vanaf je beginscherm, ga naar **Meer → Instellingen** en zet **Pushmeldingen** aan.
