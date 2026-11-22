/** 추천 밸런스 게임(홈 빈 상태 · 만들기 추천 칩). 누르면 만들기 입력칸을 채운다. */
export type TopicPair = { a: string; b: string }

export const TOPIC_SUGGESTIONS: TopicPair[] = [
  { a: '산', b: '바다' },
  { a: '민트초코', b: '반민초' },
  { a: '깻잎 논쟁 허용', b: '금지' },
  { a: '평생 짜장', b: '평생 짬뽕' },
  { a: '탕수육 부먹', b: '찍먹' },
  { a: '아침형 인간', b: '저녁형 인간' },
]

export const createPathFor = (t: TopicPair) =>
  `/create?a=${encodeURIComponent(t.a)}&b=${encodeURIComponent(t.b)}`
