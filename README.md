# Maarten 2.0

Persoonlijk dashboard om elke dag een beetje beter te worden. Donker thema met blauwe accenten, gemaakt voor iPhone 13 én desktop, en te installeren als app (PWA).

## Wat zit erin

- **Gewoontes**: elke dag Spaans, 15 min Tinder en 15 min Bumble (met timer die automatisch afvinkt), 2x per week sporten (wo/zo, do als inhaaldag) en 3x per week Project Management (ma/wo/vr). Streaks en heatmaps op de pagina *Doelen*.
- **Waterpeil**: drinktracker met doel van 2300 ml, knoppen voor glas (250 ml), groot glas (350 ml) en flesje (0,5 L); houdt bij welke dagen het doel gehaald is.
- **Todo**: supersnel toevoegen met gewone taal (`Tandarts morgen 14:00 #persoonlijk !!`), afgevinkte taken blijven zichtbaar en gaan na een week naar het archief.
- **Agenda**: vast rooster (school, klussen), taken, F1, Roda JC, Oranje, projectdeadlines, verjaardagen en Nederlandse/Belgische feestdagen (met (NL)/(BE)) in één week-overzicht. Elke categorie heeft een eigen kleur.
- **Automatisch**: F1-kwalificaties, sprints en races (Jolpica API), alle Roda JC-wedstrijden en alle wedstrijden van het Nederlands elftal (heren, A-selectie: WK, EK, kwalificatie, Nations League en oefenduels; via TheSportsDB) worden 2x per dag toegevoegd en bijgewerkt als tijden veranderen.
- **Projecten**: elk project hoort bij een GitHub-repo (of is handmatig). De taken komen uit `todo.md` in de root van de repo (`- [ ]` open, `- [x]` af, koppen = secties, `!!`/`!!!` prioriteit, `#tag`, datums als `2026-10-20` of `vr 20 okt` = deadline). Voortgang, “Focus deze week” (max. 3), prioriteit door te slepen, waarschuwing als een project 14 dagen stilligt, deadlines in de Agenda, “Zet in Todo” en elke maandag om 08:30 een weekoverzicht. De repolijst staat alleen in de database; repo’s beheer je in *Instellingen*.
- **Terugkerende taken**: bv. uren invullen op de 1e (met herinnering t/m de 5e), salaris op de 25e, planning maken op zondag.
- **Verjaardagen**: 14 dagen van tevoren een melding.
- **Pushmeldingen**: ochtendoverzicht, gewoontes-check, water, taken, deadlines (bv. 2 weken / 1 week / 1 dag van tevoren), wedstrijden en races, projecten-weekoverzicht.

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

Persoonlijke startdata (rooster, verjaardagen, deadlines) en de lijst met project-repo’s staan alleen in de database, niet in deze publieke repo.

### GitHub-token voor de Projecten-sync

Privé-repo’s worden gelezen met een fine-grained GitHub-token met alleen leesrechten op *Contents*, opgeslagen als Supabase-secret `GITHUB_TOKEN` (Edge Functions → Secrets). Een fine-grained token geldt voor één eigenaar; voor repo’s van een andere eigenaar of organisatie zet je een extra secret `GITHUB_TOKEN_<EIGENAAR>` (hoofdletters, andere tekens als `_`, bv. `GITHUB_TOKEN_MIJN_ORG`). Het token komt nooit in de frontend of in deze repo.

## Lokaal draaien

```bash
npm install
npm run dev
```

## Installeren op iPhone

1. Open de site in **Safari**.
2. Tik op **Deel** → **Zet op beginscherm**.
3. Open de app vanaf je beginscherm, ga naar **Meer → Instellingen** en zet **Pushmeldingen** aan.
