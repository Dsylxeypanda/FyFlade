# FyFlade 1.0 – personvern / privacy

Sist oppdatert / Last updated: 25 September 2026

## Norsk

FyFlade er en skrivebordsapp som samler chat fra Twitch, Kick og YouTube.

### Dette lagres på brukerens PC

- valgte kanaler, innstillinger, utseende og oppsett
- lokale kallenavn, ignoreringer og notater
- valgfri lokal chatlogg med lagringstiden brukeren selv velger
- innloggingstoken og Client Secrets i Windows Credential Manager

FyFlade mottar eller lagrer aldri kontopassord. Innlogging skjer på den offisielle
nettsiden til Twitch, Kick eller Google. Brukeren kan slette en innlogging med
«Fjern konto» og kan slette lokale data under Innstillinger → Data og personvern.

### Anonym brukstelling

Anonym brukstelling er frivillig og avslått som standard. Dersom brukeren slår
den på, sendes maksimalt ett tomt signal per UTC-dag. FyFlades serverkode lagrer
bare dato og antall signaler i maksimalt 31 dager. Den lagrer ikke konto,
bruker-ID, kanal, chatmelding, IP-adresse eller permanent installasjons-ID.

Cloudflare leverer nettverkstrafikken og behandler derfor nødvendige tekniske
nettverksdata under transport etter sine egne vilkår. FyFlade bruker ikke disse
dataene til profilering, reklame eller salg.

Når brukeren legger til eller logger inn på en tjeneste, kommuniserer FyFlade med
Twitch, Kick eller YouTube/Google for å hente og sende chatdata som brukeren har
bedt om. Emoter og kosmetikk kan hentes fra 7TV og BetterTTV. Oversettelse åpnes
først etter en personvernforklaring og sender bare den valgte meldingsteksten til
oversettelsestjenesten brukeren velger.

### Deling

FyFlade-utvikleren får ikke tilgang til brukerens passord, innloggingstoken,
Client Secrets, lokale chatlogg eller innstillinger. Data selges ikke.

Spørsmål om personvern kan sendes til [sabryna91@live.no](mailto:sabryna91@live.no).

## English

FyFlade is a desktop app that combines chat from Twitch, Kick, and YouTube.

### Data stored on the user's PC

- selected channels, preferences, appearance, and layouts
- local nicknames, ignores, and notes
- optional local chat history using the retention period selected by the user
- sign-in tokens and Client Secrets in Windows Credential Manager

FyFlade never receives or stores account passwords. Sign-in happens on the
official Twitch, Kick, or Google website. Users can delete a sign-in with
“Remove account” and delete local data under Settings → Data & Privacy.

### Anonymous usage counting

Anonymous usage counting is optional and off by default. If enabled, FyFlade
sends at most one empty signal per UTC day. FyFlade's server code stores only a
date and signal count for up to 31 days. It does not store an account, user ID,
channel, chat message, IP address, or persistent installation identifier.

Cloudflare delivers the network request and therefore processes necessary
technical network data in transit under its own terms. FyFlade does not use this
data for profiling, advertising, or sale.

When a user adds or signs in to a service, FyFlade communicates with Twitch,
Kick, or YouTube/Google to retrieve and send chat data requested by the user.
Emotes and cosmetics may be retrieved from 7TV and BetterTTV. Translation opens
only after a privacy disclosure and sends only the selected message text to the
translation provider chosen by the user.

### Sharing

The FyFlade developer cannot access users' passwords, sign-in tokens, Client
Secrets, local chat history, or settings. Data is not sold.

Privacy questions can be sent to [sabryna91@live.no](mailto:sabryna91@live.no).
