# Contributing to FyFlade

Thank you for helping improve FyFlade.

## Before opening a change

- Use an issue or a focused pull request to explain the problem and intended behavior.
- Keep changes scoped and avoid unrelated generated files or formatting rewrites.
- Never commit tokens, passwords, private keys, account data, chat logs, or local environment files.
- Do not weaken OAuth, credential storage, updater verification, Content Security Policy, webhook verification, or privacy defaults.
- Use distinct test accounts and channels. Never include another person's private data in fixtures or screenshots.

## Required checks

Run:

```powershell
npm install
.\scripts\test-fyflade-release.ps1 -IncludeDesktopBuild
```

Changes to Twitch, Kick, YouTube, OBS, authentication, updates, or Windows packaging also require the relevant manual checks in `docs/RELEASE_TEST_CHECKLIST.md`.

## Review and releases

Pull requests from people without direct commit access require review by a project maintainer. Official releases and signing requests require explicit approval by the project owner. A successful build is not permission to publish under the FyFlade name.

By contributing, you agree that your contribution is licensed under GPL-3.0-or-later.
