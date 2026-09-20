# FyFlade 1.0 – personvern / privacy

Sist oppdatert / Last updated: 13 September 2026

## Norsk

FyFlade er en skrivebordsapp som samler chat fra Twitch, Kick og YouTube.

### Dette lagres på brukerens PC

- valgte kanaler, innstillinger, utseende og oppsett
- lokale kallenavn, ignoreringer og notater
- chatlogg i opptil 24 timer dersom brukeren selv slår på lagring
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

### Deling

FyFlade-utvikleren får ikke tilgang til brukerens passord, innloggingstoken,
Client Secrets, lokale chatlogg eller innstillinger. Data selges ikke.

Spørsmål om personvern kan sendes til [sabryna91@live.no](mailto:sabryna91@live.no).

## English

FyFlade is a desktop app that combines chat from Twitch, Kick, and YouTube.

### Data stored on the user's PC

- selected channels, preferences, appearance, and layouts
- local nicknames, ignores, and notes
- up to 24 hours of chat history when the user enables history saving
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

### Sharing

The FyFlade developer cannot access users' passwords, sign-in tokens, Client
Secrets, local chat history, or settings. Data is not sold.

Privacy questions can be sent to [sabryna91@live.no](mailto:sabryna91@live.no).
