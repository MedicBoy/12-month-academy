# Learning Academy v1.3.1 — Login Screen Visual Polish

This release adds the production-grade client-side account architecture for Learning Academy. The app now opens to a dedicated Login / Sign Up experience before the learning client, supports secure Remember me sessions through Electron safeStorage, external-browser OAuth with PKCE/deep-link return handling, logout, email password reset flow, and server-authoritative Owner/Learner role support through authenticated app metadata.

## Authentication architecture

- Backend provider: Supabase Auth.
- Email/password: real Supabase `signUp` and `signInWithPassword` calls once the project is connected.
- Social providers prepared: Google, Microsoft (Azure), Facebook, and X.
- OAuth is launched in the system browser and returns through `learning-academy://auth/callback`.
- Remember me never stores the user's password. Access/refresh session tokens are encrypted with Electron `safeStorage` in the app data directory.
- The renderer does not receive access or refresh tokens; authentication runs in the Electron main process through a narrow preload IPC bridge.
- Owner is designed to come from server-controlled `app_metadata.role = "owner"`; normal authenticated users resolve to Learner.
- Until a Supabase project is connected, the login screen visibly runs in Development mode and provides a non-persistent Continue in Development Mode button so the current local Owner development profile remains usable. The bypass disappears automatically once backend credentials are configured.

## Connect the production backend

Create the Learning Academy Supabase project, then put its Project URL and **publishable/anon key** in `package.json` under `learningAcademyBackend.url` and `learningAcademyBackend.publishableKey`. Never place the Supabase service-role key or social-provider client secrets in the Electron client.

In Supabase Authentication settings, add these redirect URLs:

- `learning-academy://auth/callback`
- `learning-academy://auth/reset`

Enable Email authentication, then configure whichever social providers you want to launch with. Google and Microsoft are the recommended first two; Facebook and X are already wired in the client and can be enabled later. Each social provider's private client secret belongs in Supabase/provider configuration, not in Learning Academy source code.

For the Owner account, set a server-controlled role in the authenticated user's app metadata (`role: owner`). Do not use editable user metadata for authorization.

## What still requires the external Supabase project

The client implementation is complete enough to connect and test, but real signups cannot succeed until the Supabase URL/publishable key are supplied and the provider settings/redirect URLs are configured in that project. This is intentional: no fake local password database was added.

---


## v1.2.13 — First-Run Onboarding

- Added a full first-run setup flow: welcome, profile identity, country, optional profile picture, learning goals, first-course selection, Daily Goal selection, and a final review screen.
- Fresh installs are guided through setup automatically. Existing development profiles see the onboarding once after updating so the flow can be tested, then it stays completed.
- Owner/Learner role is preserved separately and cannot be changed by onboarding.
- Added persistent learning goals and an adjustable Daily Goal target. The Dashboard now uses the learner-selected target and safely adapts when a course day has fewer tasks.
- Added **Run Setup Again** in Settings for testing or changing setup choices without deleting course progress.
- Completing onboarding loads the selected first course and adds it to Recent Courses.

# Learning Academy v1.2.13 — Commercial UI Polish

## v1.2.13 changes
- Dashboard polish: more consistent card spacing, section labels, typography, hover states, and visual weight while preserving the requested dashboard layout.
- Profile polish: stronger account header, Owner-specific gold treatment, Academy Level with XP-to-next-level progress, member-since chip, cleaner editable fields, and refined avatar controls.
- Leaderboard polish: Top 3 podium cards, cleaner Top 20 rows, clearer current-user highlighting, Owner badge, profile pictures, country flags, XP, and streaks.
- Navigation polish: unified pill-style navigation with active-page highlighting; Website remains an external-link action and Profile fits the same navigation system.
- Header account polish: metric pills and an Owner-colored profile ring while preserving the existing profile photo.
- Existing saved progress, profile picture, country, role, course data, and Daily Challenge state remain intact.

# Learning Academy v1.2.11 — Real Country Flag Icons

## v1.2.11 changes
- Replaced Windows text/emoji country markers with actual tiny country flag images beside learner names.
- Flags now appear beside the selected user name on Profile, the full Leaderboard, and Top Learners.
- Existing saved country selections are preserved automatically, so a saved Canada profile immediately displays the Canadian flag after updating.
- Owner/Learner role behavior from v1.2.10 is unchanged.


- Adds a real local profile `role` field instead of globally hard-coding **Owner** for everyone.
- The existing development profile from v1.2.9 migrates once to **Owner** and keeps the gold Academy-style role label.
- Fresh installs and newly created local profiles default to **Learner Profile**.
- Profile edits cannot change the role.
- Only the Owner profile is pinned to preview leaderboard rank **#1**; normal learner profiles are ranked by XP in the local preview.
- Keeps country flags, profile photos, leaderboard, dashboard, course, XP, Daily Challenge, and update features unchanged.

# Learning Academy v1.2.9 — Owner Profile & Country Flags

- Renames the local account label from **Learner Profile** to **Owner**, styled in the gold used by the Academy wordmark.
- Adds a country selector to Profile and stores the selected country locally.
- Shows the selected country flag next to the Owner name on the full Leaderboard and Top Learners dashboard preview.
- Pins the local Owner to preview rank **#1** so the gold-medal/profile-photo layout can be tested before the online leaderboard backend exists.
- Keeps all existing v1.2.8 profile photo, website, leaderboard, dashboard, course, XP, Daily Challenge, and update features.

# Learning Academy v1.2.8 — Profile, Leaderboard & Dashboard Layout

- Added a Website tab that opens the external Learning Academy website location; temporarily points to Google for testing.
- Added a full local learner Profile page with editable display name, headline, bio, persistent profile photo upload, learner ID, XP, courses, achievements, and challenge streak.
- Added the learner's profile picture button to the top-right header.
- Added a Leaderboard button beside Academy XP and a dedicated Top 20 leaderboard page with gold/silver/bronze top-three medals.
- Added a dashboard Top Learners preview card that opens the full leaderboard.
- The leaderboard is clearly marked as a local development preview until online accounts and backend rankings are connected.
- Reworked the dashboard layout so Daily Challenge spans alongside Recent Courses + Overall Learning Stats and its bottom aligns with the bottom of Overall Learning Stats.
- Moved Updates & Notifications into the former Recent Courses area, moved Recent Courses to the right column, and moved Daily Goal beneath Overall Learning Stats.

---

# Learning Academy v1.2.7 — Full Header Branding

This small maintenance release removes the visible **Update source** box from Settings. Automatic update checking and installation continue to work exactly as before; the GitHub release source is simply no longer exposed in the user-facing interface.

---

# Learning Academy v1.2.1 — Course Navigation & Global XP Fix

This maintenance release fixes two issues found while testing the multi-course package system.

## What changed in v1.2.1

- The XP shown in the top application header is now **Total XP across all courses** instead of changing to the XP of whichever course is currently loaded.
- Course-specific XP remains available inside each course's Home and Course Stats views.
- The lesson **Previous** button now navigates to the preceding lesson step.
- On the first lesson step, that button changes to **← Course Home** and returns to the loaded course home instead of doing nothing.
- Existing per-course progress, achievements, and XP values are preserved; this update only changes how academy-wide XP is displayed.

---

# Learning Academy v1.2.0 — Course Package System

Learning Academy can now install courses independently from the desktop client through the `.lacourse` package format.

## What changed in v1.2.0

- Added the Learning Academy `.lacourse` package format.
- Course Library can install a `.lacourse` file with a normal Windows file picker.
- Installed courses are stored under Learning Academy's user-data folder rather than inside the Windows installation.
- Installed packages are discovered automatically whenever the app opens.
- Built-in and separately installed courses appear together in Course Library.
- Course cards show the course version and whether the course is built-in or an installed package.
- Installing a newer package with the same course ID updates that course without erasing learner progress.
- Course downgrades are blocked to protect progress compatibility.
- Installed courses can be uninstalled while keeping their saved progress for a future reinstall.
- Built-in courses cannot be overwritten or uninstalled by local packages.
- Settings can open the installed-course folder.
- Course archives are validated for package format, schema, IDs, semantic versions, unsafe archive paths, file-count limits, and compressed/uncompressed size limits.
- Imported lesson HTML is filtered before display, and package metadata must remain plain text.
- Added `adm-zip` as a bundled production dependency, so customers do not need ZIP software or any other program to install courses.

## `.lacourse` package format v1

A `.lacourse` file is a ZIP-compatible archive with a Learning Academy-specific extension. It contains at minimum:

```text
Python_Foundations_Demo.lacourse
├── manifest.json
└── course.json
```

`manifest.json` identifies the package:

```json
{
  "packageFormat": "learning-academy-course",
  "packageVersion": 1,
  "courseId": "python-foundations-demo",
  "courseVersion": "1.0.0",
  "entry": "course.json",
  "name": "Python Foundations — Demo"
}
```

`course.json` uses the same universal course schema introduced in v1.1.0. Future package versions can add assets without redesigning the learning engine.

## Why this matters

Today a learner can receive a `.lacourse` file and install it manually. Later the online Learning Academy store can download the exact same package after purchase and hand it to the same validator/installer. The course engine therefore does not need to be rebuilt when accounts and commerce are added.

## Development

```text
npm install
npm run validate
npm start
```

`adm-zip` is bundled with the application when the Windows release is built. Customers do not install Node.js, Git, ZIP software, or any other dependency.



## v1.2.4 — Branded App Icon

- Sets the new Learning Academy logo as the Windows application/executable icon.
- Uses the same logo for the Electron window/taskbar icon.
- Adds the logo beside the Learning Academy name inside the app header.
- Packages both PNG and ICO branding assets with the application.

## v1.2.3 — Daily Challenge
- Replaces the redundant Dashboard Continue Learning panel with an Academy-wide Daily Challenge.
- One submitted attempt per local calendar day.
- Top-bar flame now displays the current consecutive Daily Challenge win streak and resets to 0 after a missed challenge.
- Overall Learning Stats tracks the learner's longest Daily Challenge win streak as a permanent best record.
- Optional XP wager slider allows 0–15% of current Total XP.
- Correct answer: +75 base XP plus the wager amount. Incorrect answer: wager is deducted.
- Daily Challenge XP is Academy-wide and does not alter course-specific XP totals.
- Completed challenge card changes to a persistent win/loss result until the next day.


## v1.2.7 — Full Header Branding

- Replaced the old small header icon plus separate text branding with the approved full Learning Academy banner logo.
- The Windows application icon remains unchanged.
- Added responsive header-logo sizing for smaller windows.


## v1.2.7
- Corrected the Windows application/desktop shortcut icon positioning.
- Enlarged the icon artwork within the ICO canvas so it appears larger and evenly centered.
- Rebuilt the multi-resolution Windows ICO used by both Electron and electron-builder.

## v1.2.7 Header Branding Polish
- Removed the visible line under the header branding.
- Matched the header background to the application background for a seamless blend.
- Increased the header logo size while keeping the full wordmark and tagline visible.
