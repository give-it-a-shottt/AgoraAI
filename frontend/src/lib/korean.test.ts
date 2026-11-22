import { describe, expect, it } from 'vitest'
import { withRo } from './korean'

describe('withRo', () => {
  it.each([
    ['짬뽕', '짬뽕으로'],
    ['바다', '바다로'],
    ['평생 겨울', '평생 겨울로'],
    ['ABC', 'ABC(으)로'],
  ])('%s → %s', (w, out) => expect(withRo(w)).toBe(out))
})
