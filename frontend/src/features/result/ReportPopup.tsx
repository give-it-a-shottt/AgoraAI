import { useState } from 'react'
import { REPORT_REASONS, type ReportReason } from '../../api/types'
import { Button } from '../../components/Button'
import { Popup } from '../../components/Popup'
import styles from './popups.module.css'

type Props = {
  open: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason) => void
}

/** DEB_01_006 신고 — 이유를 고르고 보낸다. 3건이 쌓이면 확인하는 동안 가려진다. */
export function ReportPopup({ open, submitting, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  return (
    <Popup open={open} title="이 토론 신고하기" onClose={onClose}>
      <p className={`ts-body-14-r ${styles.sub}`}>어떤 문제가 있나요? 신고가 3건 쌓이면 확인하는 동안 가려져요.</p>
      <fieldset className={styles.reasons}>
        <legend className="sr-only">신고 이유</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.key} className={styles.reason}>
            <input
              type="radio"
              name="report-reason"
              value={r.key}
              checked={reason === r.key}
              onChange={() => setReason(r.key)}
              className={styles.radio}
            />
            <span className={reason === r.key ? 'ts-body-15-m' : 'ts-body-15-r'}>{r.label}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <Button variant="secondary" size="l" className={styles.cancel} onClick={onClose}>
          취소
        </Button>
        <Button
          size="l"
          className={styles.submit}
          softDisabled={!reason || submitting}
          onClick={() => reason && onSubmit(reason)}
        >
          {submitting ? '보내는 중…' : '신고하기'}
        </Button>
      </div>
    </Popup>
  )
}
