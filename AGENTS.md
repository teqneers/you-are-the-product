# Agent instructions

- English is the primary language: code, comments, identifiers, commit messages and documentation.
- Documentation may also exist in German, but only next to an English version (e.g. `README.md` + `README.de.md`,
  or English first and German second in one file). Keep both versions in sync.
- User-facing UI strings live in `lib/locales/` (one file per language, `en.ts` is the reference) and
  `public/_locales/`. A new key needs a text in every language; `npm test` checks this.
