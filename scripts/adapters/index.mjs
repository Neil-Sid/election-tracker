// Picks the feed for a schedule entry. For now every election uses the mock
// feed and calls come from the tracker's own rules (scripts/calls.mjs); no
// external API is used for results or calls.
//
// ap.mjs (Associated Press) and tse.mjs (Brazil's electoral court) are kept
// for later but are not connected.

import { fetchResults as mock } from './mock.mjs';

export function adapterFor() {
  return { name: 'mock', fetch: mock };
}
