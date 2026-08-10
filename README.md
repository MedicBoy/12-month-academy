# Learning Academy v1.0.10 — Automatic Updates & Live Notifications

## Changes
- Replaced the static Dashboard notification messages with a persistent live notification feed.
- Course loads, completed study days, newly unlocked achievements, available updates, and update results now appear in **Updates & Notifications**.
- The notification feed keeps the newest activity and automatically drops older entries.
- Learning Academy now checks GitHub Releases automatically each time the installed app opens.
- When a newer version is available, an automatic **New Update Available** popup opens with a button that takes the user directly to **Settings**.
- Removed the manual **Check for Updates** button from Settings.
- Settings now shows a single **Update to vX** action only when an update is available.
- Clicking Update starts the download and displays live percentage progress in Settings.
- After the download completes, Learning Academy installs the Windows NSIS update silently and automatically restarts/reopens the app.
- Added **Update Successful** and **Update Unsuccessful** popup feedback, including install-result tracking across the restart.
- Preserves the v1.0.9 Recent Courses load button, green achievement completion checkmarks, centered brand subtitle, and v1.0.8 session-advance behavior.

## Update behavior note
Windows cannot replace the installed Learning Academy executable while that executable is still running. The updater therefore performs a brief automatic restart at the install stage. The NSIS installer runs silently and Learning Academy is forced to reopen after installation, so the experience behaves like an automatic reload rather than requiring the user to run the installer manually.
