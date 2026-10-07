import { describe, it, expect, afterEach } from 'vitest'
import { appEnv, isProduction } from '../appEnv'

const original = { APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV }
const env = process.env as Record<string, string | undefined>

afterEach(() => {
  env.APP_ENV = original.APP_ENV
  env.NODE_ENV = original.NODE_ENV
  if (original.APP_ENV === undefined) delete env.APP_ENV
})

describe('appEnv', () => {
  it('uses APP_ENV when it is set', () => {
    env.APP_ENV = 'staging'
    env.NODE_ENV = 'production'
    expect(appEnv()).toBe('staging')
    expect(isProduction()).toBe(false)
  })

  it('FAILS SAFE: a production build with APP_ENV forgotten counts as production', () => {
    delete env.APP_ENV
    env.NODE_ENV = 'production'
    expect(isProduction()).toBe(true)
  })

  it('a mistyped APP_ENV is ignored, never treated as "not production"', () => {
    env.APP_ENV = 'prod'
    env.NODE_ENV = 'production'
    expect(isProduction()).toBe(true)
  })

  it('next dev and the tests are development', () => {
    delete env.APP_ENV
    env.NODE_ENV = 'development'
    expect(appEnv()).toBe('development')
    env.NODE_ENV = 'test'
    expect(appEnv()).toBe('development')
  })
})
