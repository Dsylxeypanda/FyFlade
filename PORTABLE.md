# FyFlade Portable

FyFlade Portable is the no-install edition for Windows.

## Use it

1. Extract the entire ZIP file to a folder you can write to, such as Documents.
2. Keep `FyFlade.exe` and `FyFlade-portable.marker` together.
3. Open `FyFlade.exe`.

Microsoft Edge WebView2 is required. It is included with current Windows 10 and Windows 11 installations and can also be installed from Microsoft.

## Updates

The portable edition does not run the installer updater. Download a newer portable ZIP, close FyFlade, extract the new package, and replace the old application folder. FyFlade shows this distinction in Settings.

## Local data and account safety

Settings, profiles, layouts, chat history, and temporary caches remain in the current Windows user's local application data. Account credentials remain protected by Windows Credential Manager. They are not included in the portable folder or copied with the ZIP.

This design keeps sign-ins private and prevents a copied portable folder from carrying another person's account access.

## Public release requirement

Only publish a package whose `FyFlade.exe` has a valid Windows Authenticode signature. The build and verification scripts stop public packaging when that signature is missing unless the explicit development-only override is used.
