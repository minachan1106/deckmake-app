import type { Deck } from './types'

const c = (name_ja: string, name_en: string, qty: number, limit?: number) => ({ name_ja, name_en, qty, ...(limit ? { limit } : {}) })

/** 要件のテストケース「新ハーピィ」 */
export const harpieDeck: Deck = {
  name: '新ハーピィ',
  skill: 'ハーピィの遺志',
  main: [
    c('ハーピィ・オラクル', 'Harpie Oracle', 2),
    c('ハーピィ・チャネラー', 'Harpie Channeler', 3),
    c('ハーピィ・パフューマー', 'Harpie Perfumer', 3),
    c('ハーピィ・クィーン', 'Harpie Queen', 3),
    c('ハーピィ・レディ1', 'Harpie Lady 1', 3),
    c('ブラック・ホール', 'Dark Hole', 2),
    c('ライトニング・ボルテックス', 'Lightning Vortex', 2),
    c('ハーピィの狩場', "Harpie's Hunting Ground", 1),
    c('守護神の矛', "Spear of the Guardian", 1),
    c('万華鏡－華麗なる分身－', 'Elegant Egotist', 3),
    c('聖なるバリア －ミラーフォース－', 'Mirror Force', 1, 2),
    c('ガード・ブロック', 'Draining Shield', 2),
  ],
  extra: [
    c('ハーピィ・レディ・SC', 'Harpie Lady Sisters', 3),
    c('ダーク・リベリオン・エクシーズ・ドラゴン', 'Dark Rebellion Xyz Dragon', 1),
    c('電光千鳥', 'Lightning Chidori', 1),
  ],
}

export const harpieOwnedExtra = [c('スワローズ・ネスト', "Swallow's Nest", 1), c('サイクロン', 'Mystical Space Typhoon', 1)]
