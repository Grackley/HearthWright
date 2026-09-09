# Download help

**[Download Hearthwright 1.2.0 for Windows](https://github.com/Grackley/HearthWright/releases/download/v1.2.0/Hearthwright-Portable-1.2.0.exe)**

Download `Hearthwright-Portable-1.2.0.exe` and open it. This is the complete Windows app. It needs no installer, PowerShell commands, Node.js, or other developer tools.

## Which file do I need?

- **`Hearthwright-Portable-1.2.0.exe`** is the app. “Executable” simply means a file Windows can run.
- **`Hearthwright-Portable-1.2.0.exe.sha256`** is an optional text file for checking that a download matches the release. You do not need it to use Hearthwright.
- **Source code ZIP/TAR files** are for developers. They are not the ready-to-run app.

The app and optional checksum are attached under **Assets** on the [1.2.0 release page](https://github.com/Grackley/HearthWright/releases/tag/v1.2.0). The direct download link above opens the app download without needing to browse those files.

## Windows download warning

Hearthwright is currently unsigned. Windows or Microsoft Edge may show:

- **“Publisher: Unknown”** because the app does not have a verified publisher signature.
- **“Not commonly downloaded”** because Microsoft has not established this file's reputation.

These warnings do not, by themselves, mean malware was detected. They also do not certify the file as safe. Check that you followed the download link from this repository's release page. [Microsoft explains how these warnings work](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Checking your download

This is an optional check for people who want to verify the downloaded file. It is not part of setting up or using Hearthwright, and it will not remove the Windows warning.

<details>
<summary>Optional: compare the SHA-256 checksum with PowerShell</summary>

1. Download the app and its matching `.sha256` file from the [same release](https://github.com/Grackley/HearthWright/releases/tag/v1.2.0).
2. Open the `.sha256` file in Notepad to see the expected checksum.
3. Open PowerShell in the folder containing your download and run:

```powershell
Get-FileHash '.\Hearthwright-Portable-1.2.0.exe' -Algorithm SHA256
```

If your browser added `(1)` or another suffix to the filename, use that exact filename between the quotes instead.

Compare the resulting hash with the one in the `.sha256` file. Letter case does not matter. A matching checksum confirms that your file matches the release; it is not a publisher signature or a guarantee of safety.

</details>

[Quick start](quick-start.md) · [Back to Hearthwright](../README.md)
