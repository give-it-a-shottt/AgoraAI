import styles from './LegalPage.module.css'

type Props = { kind: 'terms' | 'privacy' }

/** 이용약관·개인정보처리방침 임시 안내 (Q-008: 실제 문구는 사용자 결정) */
export function LegalPage({ kind }: Props) {
  const isTerms = kind === 'terms'
  return (
    <article className={styles.page}>
      <h1 className="ts-headline-28">{isTerms ? '이용약관' : '개인정보처리방침'}</h1>
      {isTerms ? (
        <ul className={`ts-body-15-r ${styles.list}`}>
          <li>Agora는 비상업 포트폴리오 프로젝트예요.</li>
          <li>토론 발언은 AI가 만든 글이라 사실과 다를 수 있어요.</li>
          <li>부적절한 토론은 신고할 수 있고, 신고가 쌓이면 가려져요.</li>
        </ul>
      ) : (
        <ul className={`ts-body-15-r ${styles.list}`}>
          <li>로그인하면 소셜 계정의 고유 번호와 닉네임만 저장해요.</li>
          <li>예측·공감·신고는 브라우저에 저장한 무작위 번호로만 구분해요.</li>
          <li>이메일·전화번호 같은 연락처는 받지 않아요.</li>
        </ul>
      )}
    </article>
  )
}
