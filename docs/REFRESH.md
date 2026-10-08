# Refreshing results after an election

Follow this after an election in `data/schedule.json` has taken place. It adds the
official results, moves the previous result into history, and ends in a pull
request for the owner to review. Nothing is merged without review. It is written
so that an agent with no other context can follow it.

The site promises accurate national results, so the rules in step 3 matter more
than finishing: if something can't be sourced, leave it out and say so.

## 1. Is anything due?

```
node -v                  # needs 22 or later
node scripts/due.mjs
```

If it prints `Nothing due`, stop. Make no branch, no commit and no pull request,
and end with "Nothing due."

Otherwise it lists each election that has taken place but isn't in
`data/countries` yet, for example:

```
BR President (run-off) on 2026-10-25; adds the run-off to br-president-2026
US House of Representatives on 2026-11-03; replaces us-house-2024
```

Handle each country in its own branch and pull request.

## 2. Can you reach Wikipedia?

```
node scripts/wiki/page.mjs "2024 United States House of Representatives elections"
```

If this fails, stop and report the error. Don't open a pull request.

## 3. Rules for numbers

- **Every number comes from wikitext you fetch in this run.** Never from memory,
  and never estimated. These elections are newer than anything you know.
- **Source:** the English Wikipedia article for the election. Its results tables
  reproduce the official count and cite the electoral body. Some articles keep
  results on a sub-article or a transcluded template; follow it.
- **Record the revision** you read (`page.mjs` prints it) in `source.revid`.
- **Don't use WebFetch for numbers.** It summarises pages with a model and can
  misread tables.
- **If national results aren't final yet,** stop for that country and say so in
  your final message. Signs: an empty table, "provisional", or the count still
  running. It will be due again tomorrow. US totals keep moving for weeks: once
  the article's national table is complete, use it as it stands and say so in
  the pull request.
- **Listing rule:** list every party or candidate that won a seat, took at least
  1% of the vote, or lost five or more seats. Sum everything else into one
  Others row (`"party": "oth"`), with its votes and share.
- **Party keys:**
  - Reuse the keys in `data/countries/<CODE>.json` and
    `scripts/history/<CODE>.json`.
  - New keys are lowercase letters and digits.
  - Colours come from `node scripts/wiki/colors.mjs "Party article"`. Pick one by
    hand if Wikipedia has none (`#F8F9FA`) or it is close to another party's in
    the same election; say so in the pull request.

Tools:

- `node scripts/wiki/page.mjs "Article" out.txt` saves the wikitext. It prints the
  revision id and each results table's line number and section.
- `node scripts/wiki/results.mjs out.txt <line>` parses one `{{Election results}}`
  template. Check its output against the raw table.
- Plain wikitables need a small parser. Look for a colspan cell that stands for
  a party that didn't stand somewhere.

## 4. Make the changes

### a. The new election

**Where it lives.** Search `scripts/seeds.mjs` for the old election's id:

- **The country is in `NEW` (IN, JP, MX, IT, KR, ID, ZA, TR, PL, NL, AT, PT, SE, IE).**
  Replace the old election in `NEW.<CODE>.elections` with the new one. Then delete
  `data/countries/<CODE>.json`; `npm run mock` rebuilds it from the seed.
- **The election is in `EXTRA` (us-house, br-chamber, ar-chamber).** Replace the
  seed, and delete the old election from `data/countries/<CODE>.json`. Otherwise
  mock adds the old one back. The data file, not the seed, holds the official
  figures of an election that is still current.
- **Otherwise,** edit `data/countries/<CODE>.json`: replace the old election
  object with the new one.

**Shape.** Copy the old election's structure and replace the values:

- `id` like the old one with the new year; `office`, `kind` and `seatLabel`
  unchanged.
- `date`, `status: "final"`, `reporting: 100`, `turnout`.
- `system`: update the numbers if the chamber's size changed.
- `totalSeats`, and `majority` (half the seats plus one, rounded down).
- `candidates`: `{ name, party, votes, pct, seats, change, winner }`. Exactly one
  `winner`: the elected candidate, or the largest party in a legislature.
- `cite`: `{ "name": "the <electoral body>", "url": "<article>" }`.
- `statesFrom`: the table's URL, only when every region's winner is sourced.
- **Region winners** come from the article's results-by-region table, where it
  matches the map's regions (the `abbr` codes in the old election).
  - In a data file, give `regions` as `[{ "name", "abbr", "winner" }]` for every
    region of the old election, with `winner` only where it is sourced.
  - In a seed, use `winners: { ABBR: "party" }`, plus `defaultWinner` if one party
    won almost everywhere.

**Two-round races:**

- **First round done, run-off pending:**
  - `rounds: [{ label: "First round", date, candidates }]`, and `candidates`
    repeating that round.
  - The two going through get `advanced: true`; nobody gets `winner`.
  - Add `call: { status: "runoff", parties: [<key 1>, <key 2>], by: "the <electoral body>" }`.
  - Point the run-off's `basedOn` in the schedule at the new id.
  - `short` is an optional short name for the home page (Brazil's "Lula").
- **Run-off done** (`due.mjs` says "adds the run-off to"):
  - Append `{ label: "Run-off", date, candidates, regions }` to the existing
    election's `rounds`, with the run-off's region winners.
  - Set `candidates` to the run-off's with one `winner`, remove `call`, and set
    `turnout` to the run-off's.
  - Keep `advanced` only in the first round. Nothing moves to history.
- **Won outright in the first round:** one round, with a `winner` and no `call`.

**Upper houses and partial renewals:** follow the old entry's convention.

- US Senate, Brazil's and Australia's Senates: seats are the chamber's
  composition after the election.
- Argentina: seats won, with `chamberSize`.
- US Senate and governors: the states that voted and their winners go in
  `CONTESTS` in `scripts/mock-data.mjs`, under the new id; other states show no
  race.

**Tables in `scripts/mock-data.mjs` keyed by election id.** Rename the old id
and refresh:

- `DISTRICT_ELECTIONS`: elections drawn by district.
- `SEAT_SPLITS`: real seats by party in each region. Refresh it from the
  article's by-region table. If there is none, remove the entry, and seats are
  fitted instead.
- `CONTESTS` and `REGION_SEATS`.
- A new regional party also goes in `REGIONAL` (`scripts/regions.mjs`) and
  `RULES` (`scripts/build-history.mjs`), so it only appears where it stands.

### b. The previous election into history

Unless you only added a run-off, append the old election to
`scripts/history/<CODE>.json`. Copy the shape of that file's other entries:

- `id`, `office`, `kind`, `date`, `turnout`, `totalSeats`, `seatLabel` and
  `chamberSize` where it applies.
- `source: { name: "Wikipedia, citing <body>", url, revid }`.
- `candidates`, `rounds`, `notes`.
- `regionWinners` and `regionSource`, only where sourced.
- `partial` or `voted` where some regions had no race.

Take its numbers again from its own article and record that revision. They
should match the data file's figures. Where they differ, the article wins; list
the differences in the pull request.

Define any party key the entry uses that today's elections no longer use in
the history file's `parties`.

### c. The calendar

- Remove the processed entry from `data/schedule.json`, and from `NEW_SCHEDULE` in
  `scripts/seeds.mjs` if it is there.
- Add the office's next election if it is missing, with `basedOn` set to the new
  id. Use `tentative: true` when the date isn't fixed.
- Repoint any `basedOn` that named the old id.
- Remove the old id from `HISTORY` (`scripts/mock-data.mjs`) and `NEW_HISTORY`
  (`scripts/seeds.mjs`).

### d. The date stamp

Set `asOf` in `data/index.json` to today (UTC). The site shows "Results as of" this
date.

## 5. Check everything

Also write the new election(s) to a scratch file in the history schema (with
`source.revid`, `regionWinners` and `regionSource`), here `new.json`, outside the
repo. Then run:

```
npm run mock
npm run history
node scripts/check-history.mjs
node scripts/check-history.mjs <CODE> --file=new.json --current
node scripts/verify-history.mjs <CODE>
node scripts/verify-history.mjs <CODE> --file=new.json
node scripts/check-current.mjs <CODE> --sourced=new.json
npm run build
```

- Every check must pass.
- **`verify-history`:** every vote count must appear in the cited revision. A miss
  must be a sum you made yourself, explained in `notes`; anything else is a
  mistake to fix.
- **Repeatability:** run `npm run mock` once more. `git status` must show no further
  change.

## 6. Pull request

- Branch `refresh/<code>-<office>-<date>`, one per country.
- Title: `Results: <Country> <office>, <date>`.
- The body says:
  - what became current, and what moved into history;
  - the articles and revision ids used;
  - the verification counts;
  - which map winners are sourced, and which are illustrative;
  - anything uncertain or not final;
  - any differences between the old data file and its article.
- Don't merge, and don't change the UI, styles or README unless a check needs it.
