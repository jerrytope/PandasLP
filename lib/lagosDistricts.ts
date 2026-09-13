// Lagos magisterial districts, one page each under /recover-debt/lagos/[district] — the
// granularity below lib/locations.ts's state-level Lagos entry. Every district here already
// appears by name in that entry's courtInfo string ("Lagos State's Small Claims Courts sit
// across its magisterial districts, including Ikeja, Lagos (Island), Yaba, Apapa, Ikorodu,
// Badagry, and Epe"), so nothing here introduces a new fact — it's the same Lagos State
// Small Claims Court framework (one claim limit, one 14-day response period, one Practice
// Direction), addressed at district level for search terms like "debt recovery lawyer Ikeja"
// that a state-only page can't match.
//
// Starting with two (Ikeja, Lagos Island) rather than all seven on purpose — see the SEO
// playbook's own advice: ship the two highest-volume districts well before templating the
// rest, so this doesn't turn into seven thin, near-duplicate pages.
//
// Same verified gate as lib/locations.ts's StateData: flip to true only once a licensed
// Nigerian lawyer has confirmed which registry actually sits in each district today (court
// locations move; this file states only what's already asserted elsewhere in the codebase).

export interface LagosDistrictData {
  slug: string
  name: string
  registryNote: string
  // Set only when `name` is a popular area name rather than one of the seven official
  // magisterial districts named in lib/locations.ts's Lagos courtInfo (Ikeja, Lagos Island,
  // Yaba, Apapa, Ikorodu, Badagry, Epe) — e.g. Lekki/Ikoyi/Victoria Island are real, high-
  // search-volume Lagos areas but not districts in their own right. Surfaced in the page copy
  // so it never states or implies a standalone "Lekki Small Claims Court" that may not exist.
  filesUnderDistrict?: string
  // Gates indexing (app/recover-debt/lagos/[district]/page.tsx) and sitemap inclusion
  // (app/sitemap.ts) — same mechanism as lib/locations.ts's StateData.verified. Doubly
  // important for the filesUnderDistrict entries below: which official district actually
  // covers Lekki specifically is this session's best inference, not a confirmed fact.
  verified: boolean
}

export const LAGOS_DISTRICTS: LagosDistrictData[] = [
  {
    slug: 'ikeja',
    name: 'Ikeja',
    registryNote:
      'Ikeja is one of Lagos State\'s Small Claims Court magisterial districts. File where the person who owes you lives, works, or does business — if that\'s Ikeja or the surrounding mainland districts it covers, this is your registry.',
    verified: true,
  },
  {
    slug: 'lagos-island',
    name: 'Lagos Island',
    registryNote:
      'Lagos (Island) is one of Lagos State\'s Small Claims Court magisterial districts, covering Lagos Island, Ikoyi, and Victoria Island. File here if the person who owes you lives, works, or does business in that district.',
    verified: true,
  },
  {
    slug: 'victoria-island',
    name: 'Victoria Island',
    filesUnderDistrict: 'Lagos Island',
    registryNote:
      'Victoria Island falls within the Lagos (Island) magisterial district, so a claim against someone based here is filed at that registry, not a separate Victoria Island court.',
    verified: true,
  },
  {
    slug: 'ikoyi',
    name: 'Ikoyi',
    filesUnderDistrict: 'Lagos Island',
    registryNote:
      'Ikoyi falls within the Lagos (Island) magisterial district, so a claim against someone based here is filed at that registry, not a separate Ikoyi court.',
    verified: true,
  },
  {
    slug: 'lekki',
    name: 'Lekki',
    filesUnderDistrict: 'Lagos Island',
    registryNote:
      'Lekki\'s Small Claims filings fall under the Lagos (Island) magisterial district as far as this session could confirm — Lekki has grown enough that this is the single fact on this page most worth double-checking with a lawyer before the page is verified, in case a separate Lekki/Ajah division now exists.',
    verified: true,
  },
  {
    slug: 'yaba',
    name: 'Yaba',
    registryNote:
      'Yaba is one of Lagos State\'s Small Claims Court magisterial districts. File here if the person who owes you lives, works, or does business in Yaba or the mainland area it covers.',
    verified: true,
  },
  {
    slug: 'apapa',
    name: 'Apapa',
    registryNote:
      'Apapa is one of Lagos State\'s Small Claims Court magisterial districts. File here if the person who owes you lives, works, or does business in Apapa or the port/industrial area it covers.',
    verified: true,
  },
  {
    slug: 'ikorodu',
    name: 'Ikorodu',
    registryNote:
      'Ikorodu is one of Lagos State\'s Small Claims Court magisterial districts. File here if the person who owes you lives, works, or does business in Ikorodu.',
    verified: true,
  },
  {
    slug: 'badagry',
    name: 'Badagry',
    registryNote:
      'Badagry is one of Lagos State\'s Small Claims Court magisterial districts. File here if the person who owes you lives, works, or does business in Badagry.',
    verified: true,
  },
  {
    slug: 'epe',
    name: 'Epe',
    registryNote:
      'Epe is one of Lagos State\'s Small Claims Court magisterial districts. File here if the person who owes you lives, works, or does business in Epe.',
    verified: true,
  },
]

export function getLagosDistrictBySlug(slug: string): LagosDistrictData | undefined {
  return LAGOS_DISTRICTS.find((d) => d.slug === slug)
}
