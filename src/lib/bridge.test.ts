import { describe, expect, it } from 'vitest'
import { extractJson, parseReply, proposalPrompt } from './bridge'
import { harpieDeck, harpieOwnedExtra } from './fixtures'

describe('bridge', () => {
  it('フェンス付きJSONを取り出す', () => {
    expect(extractJson('前置き\n```json\n{"a":1}\n```\n後書き')).toEqual({ a: 1 })
  })
  it('フェンス無しでも取り出す', () => {
    expect(extractJson('はい {"a":2} です')).toEqual({ a: 2 })
  })
  it('deckを検証する', () => {
    const r = parseReply('```json\n' + JSON.stringify({ kind: 'deck', ...harpieDeck }) + '\n```')
    expect(r.kind).toBe('deck')
  })
  it('不正な形式は弾く', () => {
    expect(() => parseReply('{"kind":"deck","name":"x","main":[{"name_en":"a","qty":0}]}')).toThrow()
    expect(() => parseReply('{"kind":"zzz"}')).toThrow()
  })
  it('手持ち提案プロンプトに未使用の所持カードと理由要求が入る', () => {
    const p = proposalPrompt({
      tier: 'owned',
      deck: harpieDeck,
      owned: harpieOwnedExtra.map((c) => ({ ...c, disposal: 0, updated_at: '' })),
      resources: [],
    })
    expect(p).toContain('スワローズ・ネスト')
    expect(p).toContain('サイクロン')
    expect(p).toContain('理由')
  })
})
