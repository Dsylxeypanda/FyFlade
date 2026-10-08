# FyFlade 1.0 beta — unsigned portable edition

This is an early public beta for Windows 10 and Windows 11. It contains Twitch and Kick support. YouTube support is planned for FyFlade 1.1.

## Important Windows notice

This beta is not yet signed with a trusted Windows Authenticode certificate. Microsoft Defender SmartScreen may therefore display a warning when FyFlade starts. Download FyFlade only from the official GitHub release linked from <https://fyflade.pages.dev/>.

FyFlade is open source. The exact source for this beta is the `v1.0.0-beta.1` tag in the official repository.

## Download verification

File:

`FyFlade-1.0.0-windows-x64-portable.zip`

SHA-256:

`32A78FDDC590AD9AE3B33461492D3B07C8A62B1F46B1C1E63F5DD2F247CF5ABC`

To verify it in PowerShell:

```powershell
Get-FileHash .\FyFlade-1.0.0-windows-x64-portable.zip -Algorithm SHA256
```

The displayed hash must match the value above exactly. Do not run the package if it differs.

## Portable use

Extract the complete ZIP into a writable folder and start `FyFlade.exe`. Do not run the executable from inside the ZIP. The portable edition does not install itself across the PC and does not include automatic installer updates.

Account credentials remain protected by Windows Credential Manager for the signed-in Windows user; they are not stored inside the portable folder.

## Beta limitations

- This is beta software, not a signed stable release.
- YouTube sign-in and chat are intentionally unavailable until version 1.1.
- Windows may show a SmartScreen warning because Authenticode signing is not yet available.
- Please report bugs through the official GitHub repository without including passwords, tokens, private chat logs, or other sensitive information.
