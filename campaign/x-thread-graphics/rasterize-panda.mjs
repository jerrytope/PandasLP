import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'

const svg = readFileSync(new URL('../../public/panda-hero.svg', import.meta.url))
const png = await sharp(svg, { density: 400 }).png().toBuffer()
writeFileSync(new URL('./panda-mascot.png', import.meta.url), png)
console.log('Wrote panda-mascot.png', png.length, 'bytes')
