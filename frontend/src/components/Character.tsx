import catA from '../assets/characters/cat-a.svg'
import penguinB from '../assets/characters/penguin-b.svg'
import owlJudge from '../assets/characters/owl-judge.svg'

export type CharacterKey = 'cat' | 'penguin' | 'owl'

const SRC: Record<CharacterKey, string> = { cat: catA, penguin: penguinB, owl: owlJudge }

type Props = {
  character: CharacterKey
  size: number
  /** 의미 있는 그림이면 이름을, 장식이면 빈 문자열(§8: 홈 카드 그림 alt="") */
  alt?: string
  className?: string
}

/** 오리지널 캐릭터 일러스트(Figma Characters 컴포넌트 export, 240×240 원본) */
export function Character({ character, size, alt = '', className }: Props) {
  return (
    <img
      src={SRC[character]}
      width={size}
      height={size}
      alt={alt}
      className={className}
      draggable={false}
    />
  )
}
