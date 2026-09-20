# FyFlade – UI og innstillinger

Dato: 6. september 2026.

## Endringer

- **Kvote og bruk / Quota & Usage** er nå en egen, alltid synlig innstillingsside. Den gjenbruker den eksisterende YouTube-telleren, døgnnullstillingen og lagringsnøkkelen `chatnest.youtube.quotaTracker.v1`. Den separate YouTube-siden er fjernet fra innstillingsmenyen; konto og oppsett ligger under Kontoer. Det er ikke lagt til oppdiktede Twitch- eller Kick-kvoter. Registrerte enheter vises som registrerte enheter også når Google melder at prosjektkvoten er brukt opp; gjenstående kapasitet er tydelig merket som estimat mot standardgrensen.
- Alle 12 innstillingssidene er tilgjengelige også uten Avansert: Generelt, Kontoer, Kvote og bruk, OBS, Kick, Emoter, Chat, Kanalfaner, Markeringer, Ignorerte, Utseende og Hjelp. Sidefeltet kan rulles i lave vinduer. Avansert styrer fortsatt de avanserte valgene inne på sider.
- Synlig navn er **FyFlade** i hovedvindu, separate vinduer, innstillinger, oppstart, velkomst/gjennomgang, Hva er nytt, hjelpetekster, kontotekster, OAuth-resultatsider og OBS-visninger.
- Tre små statusprikker for Twitch, Kick og YouTube står på samme rad rett ved innstillingsknappen, også når kanallisten er på siden. Pekeren viser plattform og status; klikk åpner en liten statusboks med lenke til eksisterende systemkontroll. Boksen holdes innenfor vinduet og støtter tastatur og Escape.
- Kanallisten og innstillingsknappen beholdes i hovedvinduet også når alle kontoer er frakoblet. Dermed er innstillinger og grå statusikoner tilgjengelige uten innlogging.
- Grønn betyr tilkoblet, gul betyr tilkobling/gjenoppkobling, grå betyr ikke tilkoblet eller forbindelsen brutt, og rød betyr utilgjengelig tjeneste, behov for ny innlogging eller manglende nettforbindelse. Tekst forklarer tilstanden i tillegg til fargen.
- YouTube rapporterer nå eksisterende gjenoppkoblingsforsøk til grensesnittet. Meldinger fra en gammel tilkobling ignoreres. Ingen nye API-kall, nye tilkoblingssløyfer eller endret ventetid ble innført. Twitch-status bruker en egen feiltilstand slik at feil fra andre plattformer ikke farger Twitch feil.

## Brukerdata og kompatibilitet

Beholdt `com.stigm.chatnest`, pakkenavnet `chatnest`, nøkkeltjenesten `ChatNest`, innloggingstoken-navn, localStorage-/database-nøkler, datamapper, OAuth-adresser, klientoppsett og oppdateringsadresse. Backupens eksisterende formatmarkør og godkjente gamle navn er også beholdt; bare den foreslåtte filens synlige navn er endret.

Den installerte Tauri-koden bruker den uendrede bundle-identifikatoren for både appdata og Windows WebView-data. Endringen av produktnavnet flytter derfor ikke disse dataene. Ingen datamigrering eller nye tillatelser er lagt til.

## Endrede kildefiler

- `src/App.tsx`
- `src/features/settings/settingsSearch.ts`
- `src/features/reliability/ConnectionHealthButton.tsx`
- `src/features/reliability/ConnectionHealthButton.css` (ny)
- `src/features/reliability/reliability.ts`
- `src/features/onboarding/FirstRunSetup.tsx`
- `src/features/onboarding/WhatsNew.tsx`
- `src/features/onboarding/onboarding.ts`
- `src/features/obs/ObsOverlaySettingsPanel.tsx`
- `index.html`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/obs-dock.html`
- `src-tauri/obs-overlay.html`
- `cloudflare/kick-relay/src/index.ts` (kun synlig tekst; ikke publisert)
- `scripts/build-chatnest-release.ps1` (kun synlig tekst)

Det isolerte grensesnitt-testoppsettet og resultater ligger i `work/ui-correction-test/` og brukes ikke av produksjonsappen.

## Kontroller

- `npm run build`: godkjent; inkluderer TypeScript-kontroll.
- `cargo check --manifest-path src-tauri/Cargo.toml`: godkjent.
- `npx tauri build --debug --no-bundle`: godkjent etter siste endringer, inkludert full Rust-kompilering.
- Målrettede kontroller av statusfarger og utløpt kontra midlertidig innloggingsfeil: godkjent.
- Isolert grensesnittkontroll: 19 tilfeller godkjent, ingen ufangede nettleserfeil. Alle 12 sider ble åpnet på norsk og engelsk, med Avansert både på og av. En testkvote på 123 registrerte enheter ble lest fra samme nøkkel som appens vanlige teller. Testdata for kanaler, favoritter, rekkefølge og kvote overlevde omstart. Høyre/venstre/topp/bunn ble kontrollert i et smalt vindu på 420 × 520, inkludert klikk, statusboks og Escape/fokus. Alle åtte statusvarianter fikk forventet tekst og farge. Resultatene finnes i `ui-correction-test/results/report.json` og skjermbildene i samme mappe. Dette er isolerte testdata, ikke målinger fra ekte kontoer.

## Begrensninger

Windows-programmet ble forsøkt startet fra testmiljøet, men Tauri stoppet ved `PluginInitialization("http", "Ingen tilgang. (os error 5)")`. Denne miljøbegrensningen har også vært observert før disse endringene. Ekte OAuth-innlogginger, direkte mottak av meldinger og tilgang til brukerens Windows Credential Manager er derfor ikke testet i denne runden. Isolerte nettlesertester bruker bare egne testdata og ingen ekte kontoer.

Vite gir fortsatt den eksisterende advarselen om stor JavaScript-pakke; dette er ikke en byggefeil. Ingen installasjon, ny signert utgivelse eller publisering til Cloudflare er utført. Endringene ligger i utviklingsprosjektet og den lokale debug-versjonen.

## Siste opprydding av statusområdet

- YouTube-kvotepanelet ble fjernet fra YouTube-kontosiden. Den eneste normale kvotesiden er **Settings → Kvote og bruk / Quota & Usage**. YouTube-siden har bare en forklaring og en knapp som åpner denne siden. Systemkontrollen viser tilkoblingsstatus, men ingen kvotetall.
- Statusområdet ved tannhjulet viser nå bare tre små prikker i fast rekkefølge: Twitch, Kick, YouTube. Plattformlogoer og store knappflater er fjernet fra selve statusområdet. Tooltip og status-popup er beholdt.
- Farger: grønn med svak glød = tilkoblet, gul = kobler til igjen, grå = ikke tilkoblet eller forbindelsen brutt, rød = tjenesten utilgjengelig, innlogging utløpt eller ingen nettforbindelse.
- Etter oppryddingen passerte isolert UI-test 19/19 tilfeller uten nettleserfeil. Den kontrollerte én kvoteside, tre prikker, tooltip-tekst, alle fire plasseringer av kanallisten og status-popupens tastatur/fokus.
- Emote-autofullføring starter ikke lenger på ett tegn etter kolon, slik at vanlige tekstsmilefjes som `:D` og `:P` ikke får et 7TV/BTTV-forslag over skrivefeltet eller endres til en kode som `D:`. Guide-spotlighten er også strammet inn til målområdet og klippes mot alle viewport-kanter.
- Ny frontend-build, Rust-kontroll, Tauri debug-bygg i egen målmappe og Rust-test (0 tester i prosjektet) passerte. Standard debug-mappen kunne ikke overskrive den gamle kjørende `chatnest.exe`-prosessen; den nye native testbyggen ligger i `src-tauri/target/ui-clean/debug/chatnest.exe`.
