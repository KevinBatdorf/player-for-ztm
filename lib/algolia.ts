/** Their index, so the lesson list costs one request instead of scraping a rate-limited host. */
const APP_ID = 'A2A0SZZKAM';

/** Search-only, and public: their own pages ship it to every visitor. */
const SEARCH_KEY = '3d72059ae68f8e63df31b1d4eacda103';

const ENDPOINT = `https://${APP_ID}-dsn.algolia.net/1/indexes`;

const REACH_MS = 10_000;

export type CatalogEntry = {
  slug: string;
  title: string;
  /** Their last-edit stamp; nothing in reach carries a release date. */
  updated: string;
  lectures: { title: string; href: string }[];
};

type Hit = {
  slug?: string;
  courseTitle?: string;
  internal?: { contentDigest?: string };
  lectureLinkMap?: { name?: string; link?: string }[];
};

export async function fetchCatalog(): Promise<CatalogEntry[]> {
  const res = await fetch(`${ENDPOINT}/courses/query`, {
    method: 'POST',
    headers: {
      'X-Algolia-API-Key': SEARCH_KEY,
      'X-Algolia-Application-Id': APP_ID,
    },
    body: JSON.stringify({
      query: '',
      hitsPerPage: 1000,
      attributesToRetrieve: ['slug', 'courseTitle', 'internal', 'lectureLinkMap'],
      attributesToHighlight: [],
    }),
    signal: AbortSignal.timeout(REACH_MS),
  });

  if (!res.ok) throw new Error(`Catalogue came back ${res.status}.`);

  const body: { hits?: Hit[] } = await res.json();

  return (body.hits ?? []).flatMap((hit) => {
    if (!hit.slug || !hit.courseTitle) return [];
    return [
      {
        slug: hit.slug,
        title: hit.courseTitle,
        updated: hit.internal?.contentDigest ?? '',
        lectures: (hit.lectureLinkMap ?? []).flatMap((row) =>
          row.name && row.link ? [{ title: row.name, href: row.link }] : [],
        ),
      },
    ];
  });
}
