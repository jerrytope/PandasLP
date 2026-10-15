// Phase 3 evaluation (docs/property_agent_plans/phase-3-law-library.md, task 3.9): does the law
// library find the right section for questions written the way clients write them? Scores
// keyword, meaning (gte-small) and hybrid search on the real seed, in SQLite. No API calls: the
// embedding model runs locally (downloaded once).
//
//   npm run laws:eval              q8 (the smaller model the server uses)
//   npm run laws:eval -- fp32      the full-precision model, to compare

import path from 'node:path'
import { SqliteLawLibrary } from '../lib/dev/sqliteLawLibrary'
import { gteSmallEmbedder } from '../lib/property/embeddings'

/** A question, the state, and the sections that count as a right answer ("slug|section"). */
const QUESTIONS: [string, string, string[]][] = [
  // Lagos Tenancy Law, asked in a client's words
  ['How long must I give my yearly tenant before they leave?', 'Lagos', ['lagos-tenancy-law-2011|13']],
  ['My landlord wants 2 years rent upfront, is that allowed?', 'Lagos', ['lagos-tenancy-law-2011|4']],
  ['Must the landlord give me a receipt when I pay?', 'Lagos', ['lagos-tenancy-law-2011|5']],
  ['Can my landlord just walk into my flat whenever he likes?', 'Lagos', ['lagos-tenancy-law-2011|6', 'lagos-tenancy-law-2011|8']],
  ['My landlord increased the rent by a lot, can I challenge it?', 'Lagos', ['lagos-tenancy-law-2011|37']],
  ['Will I get my caution deposit back when I move out?', 'Lagos', ['lagos-tenancy-law-2011|10']],
  ['Can I change the locks and throw my tenant\'s things outside?', 'Lagos', ['lagos-tenancy-law-2011|44']],
  ['Can I charge the tenant for the months he stayed after his time ran out?', 'Lagos', ['lagos-tenancy-law-2011|31']],
  ['Who pays the agent commission and the lawyer\'s fee?', 'Lagos', ['lagos-tenancy-law-2011|11']],
  ['My tenant disappeared and left the flat empty, what do I do?', 'Lagos', ['lagos-tenancy-law-2011|15']],
  ['How do I serve the notice if the tenant keeps avoiding me?', 'Lagos', ['lagos-tenancy-law-2011|17', 'lagos-tenancy-law-2011|18', 'lagos-tenancy-law-2011|19']],
  ['Someone moved into my house without my permission', 'Lagos', ['lagos-tenancy-law-2011|21', 'lagos-tenancy-law-2011|33', 'lagos-tenancy-law-2011|35']],
  ['Does a tenancy agreement have to be written down?', 'Lagos', ['lagos-tenancy-law-2011|3']],
  // Land Use Act, from a state with no tenancy law in the library
  ['Do I need the governor\'s approval before selling my land?', 'Oyo', ['land-use-act|22']],
  ['Government took my land for a road, will they pay me?', 'Oyo', ['land-use-act|29', 'land-use-act|28']],
  ['Can a 17 year old own land?', 'Oyo', ['land-use-act|7']],
  ['What happens to my land when I die?', 'Oyo', ['land-use-act|24', 'land-use-act|25']],
  ['Which court should I go to about my C of O dispute?', 'Oyo', ['land-use-act|39', 'land-use-act|41']],
  ['Can I sell my family land in the village without anybody\'s approval?', 'Oyo', ['land-use-act|21']],
  ['What is a certificate of occupancy?', 'Oyo', ['land-use-act|9']],
  ['Is a land sale done without consent void?', 'Oyo', ['land-use-act|22', 'land-use-act|26']],
]

const dtype = process.argv[2] === 'fp32' ? 'fp32' : 'q8'
const seed = path.resolve('docs', 'pandaslp-law-library-seed.sql')
const embed = gteSmallEmbedder(dtype)
console.log(`Loading the library and gte-small (${dtype})...`)
await embed('warm up')

const modes = ['keyword', 'meaning', 'hybrid'] as const
const libraries = Object.fromEntries(modes.map((m) => [m, SqliteLawLibrary.fromFile(seed, { embed, mode: m })]))
const score = Object.fromEntries(modes.map((m) => [m, { at1: 0, at3: 0, misses: [] as string[] }]))

for (const [question, state, right] of QUESTIONS) {
  for (const mode of modes) {
    const hits = await libraries[mode].search(question, state, 3)
    const sections = [...new Set(hits.map((h) => `${h.slug}|${h.section}`))]
    if (right.includes(sections[0])) score[mode].at1++
    if (sections.slice(0, 3).some((s) => right.includes(s))) score[mode].at3++
    else score[mode].misses.push(`${question}  →  got ${sections.join(', ') || 'nothing'}`)
  }
}

console.log(`\n${QUESTIONS.length} questions. Right section first / in the top 3:`)
for (const mode of modes) console.log(`  ${mode.padEnd(8)} ${score[mode].at1}/${QUESTIONS.length}  ${score[mode].at3}/${QUESTIONS.length}`)
for (const mode of modes) {
  if (!score[mode].misses.length) continue
  console.log(`\n${mode} missed:`)
  for (const m of score[mode].misses) console.log(`  - ${m}`)
}
