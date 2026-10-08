# Code signing policy

FyFlade does not currently have a trusted Windows Authenticode certificate. The SignPath Foundation application was not approved because the new project does not yet have enough public adoption and independent visibility. This was not a security or quality rejection.

Early public beta packages may be unsigned. Windows can display a Microsoft Defender SmartScreen warning for these files. FyFlade will pursue trusted signing again after the project has established sufficient public activity, or when another sustainable signing route is available.

## Team roles

- Committer and reviewer: Dsylxeypanda
- Release approver: Dsylxeypanda

Contributions from people without direct commit access require maintainer review. Every public release requires manual approval by the release approver. Build scripts, dependency changes, CI configuration, authentication, updater logic, and release metadata are part of the security review.

## Release origin

- Official binaries must be reproducibly connected to the public FyFlade source repository and its reviewed release commit.
- Release builds must pass `scripts/test-fyflade-release.ps1 -IncludeDesktopBuild` and the applicable manual checks in `docs/RELEASE_TEST_CHECKLIST.md`.
- The private Tauri updater key and its password are never stored in the repository.
- A public unsigned beta must be clearly labelled **Beta — unsigned**, link to its exact public source revision, and state that Windows may show a SmartScreen warning.
- Every published installer and portable ZIP must have its SHA-256 checksum shown beside the download or in the matching GitHub release notes.
- Public files are distributed only through the official FyFlade GitHub repository or a link from `fyflade.pages.dev`; arbitrary locally modified files are not official releases.
- Stable releases should use trusted Authenticode signing. Until that is available, FyFlade releases remain beta releases.
- Artifact product name and product version must match the reviewed source and release metadata.

## Privacy and network services

FyFlade does not transfer information to networked systems unless requested by the user, required for a feature the user selected, or required to connect to a chat platform the user added.

The application can communicate with Twitch, Kick, YouTube/Google, 7TV, BetterTTV, the FyFlade Cloudflare relay/update service, and a translation provider selected by the user. Optional anonymous usage counting is off by default. Translation displays a privacy disclosure before selected message text is handed to the provider.

The complete user-facing policy is in [PRIVACY.md](PRIVACY.md). Relevant third-party policies include:

- Twitch privacy notice: <https://www.twitch.tv/p/en/legal/privacy-notice/>
- Kick privacy policy: <https://kick.com/privacy-policy>
- Google privacy policy: <https://policies.google.com/privacy>
- YouTube terms: <https://www.youtube.com/static?template=terms>
- Cloudflare privacy policy: <https://www.cloudflare.com/privacypolicy/>
- 7TV privacy policy: <https://7tv.app/privacy>
- BetterTTV privacy policy: <https://betterttv.com/privacy>

Security concerns must be reported privately using the contact in [SECURITY.md](SECURITY.md), not in a public issue.
