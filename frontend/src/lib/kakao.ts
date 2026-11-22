/** 카카오톡 공유(Kakao JavaScript SDK). 키(VITE_KAKAO_JS_KEY)가 없으면 쓰지 않는다(Q-014).
 * SDK는 공유 버튼을 누를 때만 불러온다(첫 화면 무게를 늘리지 않게). */
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

type KakaoSdk = {
  isInitialized: () => boolean
  init: (key: string) => void
  Share: { sendDefault: (opts: Record<string, unknown>) => void }
}

declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

export const kakaoAvailable = () => Boolean(KAKAO_JS_KEY)

let loading: Promise<KakaoSdk> | null = null

function loadSdk(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.crossOrigin = 'anonymous'
    script.onload = () => (window.Kakao ? resolve(window.Kakao) : reject(new Error('kakao sdk')))
    script.onerror = () => {
      loading = null
      reject(new Error('kakao sdk'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** 카카오톡 공유 창을 연다. 실패하면 false(호출한 쪽이 링크 복사로 대신 안내). */
export async function shareToKakao(opts: { title: string; description: string; imageUrl: string; url: string }) {
  if (!KAKAO_JS_KEY) return false
  try {
    const kakao = await loadSdk()
    if (!kakao.isInitialized()) kakao.init(KAKAO_JS_KEY)
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: opts.title,
        description: opts.description,
        imageUrl: opts.imageUrl,
        link: { mobileWebUrl: opts.url, webUrl: opts.url },
      },
      buttons: [{ title: '예측하고 보기', link: { mobileWebUrl: opts.url, webUrl: opts.url } }],
    })
    return true
  } catch {
    return false
  }
}
