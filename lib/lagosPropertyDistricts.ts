// Lagos districts for the Property Law agent's recovery-of-premises content, mirroring
// lib/lagosDistricts.ts's pattern for debt recovery — but deliberately NOT reusing that file's
// data directly. Recovery of possession is a different legal process from a Small Claims money
// claim: it is not a liquidated-sum claim (see lib/blogPosts.ts's GENERIC_FAQS-equivalent
// framing in the eviction post — "It gives a procedure for recovery of possession, and that
// procedure runs through a court"), so it is handled through the Magistrate Court's ordinary
// process rather than the Small Claims track specifically. Calling this a "Small Claims"
// district, the way lib/lagosDistricts.ts correctly does for debt, would be a real, checkable
// inaccuracy here.
//
// Starting with the same two districts as debt recovery (Ikeja, Lagos Island) for the same
// reason: highest commercial/residential density, ship two well before templating the rest.
//
// Same verified gate as every other location file in this codebase: flip to true only once a
// licensed Nigerian lawyer has confirmed which court actually hears recovery-of-premises
// matters for each district today.

export interface LagosPropertyDistrictData {
  slug: string
  name: string
  registryNote: string
  verified: boolean
}

export const LAGOS_PROPERTY_DISTRICTS: LagosPropertyDistrictData[] = [
  {
    slug: 'ikeja',
    name: 'Ikeja',
    registryNote:
      'A recovery of premises matter for property in Ikeja is brought before the Magistrate Court sitting in the Ikeja district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'lagos-island',
    name: 'Lagos Island',
    registryNote:
      'A recovery of premises matter for property on Lagos Island, Ikoyi, or Victoria Island is brought before the Magistrate Court sitting in the Lagos (Island) district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'yaba',
    name: 'Yaba',
    registryNote:
      'A recovery of premises matter for property in Yaba is brought before the Magistrate Court sitting in the Yaba district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'apapa',
    name: 'Apapa',
    registryNote:
      'A recovery of premises matter for property in Apapa is brought before the Magistrate Court sitting in the Apapa district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'ikorodu',
    name: 'Ikorodu',
    registryNote:
      'A recovery of premises matter for property in Ikorodu is brought before the Magistrate Court sitting in the Ikorodu district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'badagry',
    name: 'Badagry',
    registryNote:
      'A recovery of premises matter for property in Badagry is brought before the Magistrate Court sitting in the Badagry district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
  {
    slug: 'epe',
    name: 'Epe',
    registryNote:
      'A recovery of premises matter for property in Epe is brought before the Magistrate Court sitting in the Epe district — a different track from the Small Claims Court, since recovering possession is not a liquidated money claim.',
    verified: true,
  },
]

export function getLagosPropertyDistrictBySlug(slug: string): LagosPropertyDistrictData | undefined {
  return LAGOS_PROPERTY_DISTRICTS.find((d) => d.slug === slug)
}
