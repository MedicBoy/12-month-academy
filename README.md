# Learning Academy v1.2.4 — Branded App Icon

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
