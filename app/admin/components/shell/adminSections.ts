import type { Tab } from '../types'

// The admin is one page; the section shown comes from the URL (/admin?section=…), so the
// sidebar's links, bookmarks and the back button all work. This file is the single list of
// sections the sidebar, top bar and app/admin/page.tsx agree on.

export type AdminSection = 'overview' | 'queue' | 'leads' | 'matters' | 'brands' | 'claims' | 'finance' | 'waitlist'
export type FinanceSub = 'overview' | 'invoices' | 'settings'

export const ADMIN_SECTIONS: AdminSection[] = ['overview', 'queue', 'leads', 'matters', 'brands', 'claims', 'finance', 'waitlist']
export const FINANCE_SUBS: FinanceSub[] = ['overview', 'invoices', 'settings']

export const SECTION_LABELS: Record<AdminSection, string> = {
  overview: 'Overview',
  queue: 'Action Queue',
  leads: 'Leads',
  matters: 'All Matters',
  brands: 'Brands',
  claims: 'Custom Claims',
  finance: 'Finance',
  waitlist: 'Waitlist Signups',
}

export const FINANCE_SUB_LABELS: Record<FinanceSub, string> = {
  overview: 'Overview',
  invoices: 'Invoices',
  settings: 'Settings',
}

/**
 * The section to show for a URL. `?caseId=` (the "review this case" link in staff emails,
 * see lib/emailTemplates.ts) has always opened All Matters, so it still does when no
 * section is given. Anything unrecognised falls back to Overview.
 */
export function parseSection(raw: string | null, hasDeepLinkCase: boolean): AdminSection {
  if (raw && (ADMIN_SECTIONS as string[]).includes(raw)) return raw as AdminSection
  return hasDeepLinkCase ? 'matters' : 'overview'
}

export function parseFinanceSub(raw: string | null): FinanceSub {
  return raw && (FINANCE_SUBS as string[]).includes(raw) ? (raw as FinanceSub) : 'overview'
}

/** The URL section name for "All Matters" is `matters`; the data-loading code calls it 'cases'. */
export function sectionToTab(section: AdminSection): Tab {
  return section === 'matters' ? 'cases' : section
}

export function sectionHref(section: AdminSection, financeSub?: FinanceSub): string {
  if (section === 'overview') return '/admin'
  const sub = section === 'finance' && financeSub && financeSub !== 'overview' ? `&sub=${financeSub}` : ''
  return `/admin?section=${section}${sub}`
}
