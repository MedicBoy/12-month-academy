# Learning Academy v1.1.0 — Universal Course Engine

Learning Academy is now a package-based multi-course desktop learning platform.

## What changed in v1.1.0

- Courses are no longer hard-coded into `index.html`.
- Built-in courses live in the `courses/` directory as structured JSON packages.
- The Electron main process validates and loads course packages through a secure preload bridge.
- Each course keeps independent progress, lesson checks, XP, notes, bookmarks, and achievements.
- Existing Computing & STEM Foundations progress is automatically migrated from the legacy v1.0.x save format.
- Save data now uses schema version 2 so future migrations can be handled safely.
- A persistent local learner ID is created now so local progress can later attach to an online account.
- Progress is automatically backed up outside browser storage under the Learning Academy user-data folder. The newest five backups per course are retained.
- Settings can restore the latest progress backup and open the diagnostics folder.
- Course Library now supports search, category filtering, and difficulty filtering.
- Course metadata already contains storefront-ready fields such as category, difficulty, provider, version, estimated hours, status, and price placeholder.
- The validator checks JavaScript plus every built-in course package before a release can publish.

## Course package format

Each `courses/*.json` package contains:

- `schemaVersion`
- `id` and `version`
- catalog metadata
- `curriculum` and study days
- interactive `lessons`
- `achievements`
- `projects`
- `assessments`

The client now loads this format generically. A future online catalog can deliver the same package format without redesigning the learning engine.

## Development

```text
npm install
npm run validate
npm start
```

`npm start` runs the development client. Automatic app updates only operate in the packaged/installed build.
