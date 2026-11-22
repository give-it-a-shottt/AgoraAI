"""공유 미리보기(F-006, §8): Vite SPA라 카카오톡·메신저가 읽을 OG 태그를 서버가 만든다.
⚠️ 승자는 미리보기 어디에도 넣지 않는다(받은 사람은 승부 예측부터, §5).
⚠️ 신고로 가려진 토론은 주제를 미리보기에 넣지 않는다(신고된 문구가 메신저로 퍼지지 않게).
"""

import html
import io
import logging
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.models import Debate

logger = logging.getLogger("agora.share")

FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"  # Pretendard(OFL)
OG_W, OG_H = 1200, 630
SHARE_DESCRIPTION = "누가 이겼을까요? 먼저 예측하고 보세요"  # 프론트 SharePopup과 같은 문구
GENERIC_TITLE = "Agora AI 토론장"
HIDDEN_DESCRIPTION = "가려진 토론이에요. 다른 토론을 둘러보세요"

# 디자인 토큰(tokens.css)과 같은 값
BG = "#F5F5F5"
TEXT_MAIN = "#111111"
TEXT_SUB = "#424242"
PRIMARY = "#056FC5"

# 미리보기 레이아웃(공유 시트의 미리보기 카드를 1200×630에 옮긴 비율)
MARGIN_X = 96
LOGO_Y, LOGO_SIZE, AI_SIZE = 150, 56, 38
TITLE_Y, TITLE_MAX, TITLE_MIN = 270, 84, 44
DESC_Y, DESC_SIZE = 400, 40


def title_of(debate: Debate) -> str:
    return f"{debate.topic_a} vs {debate.topic_b}"


def _texts(debate: Debate) -> tuple[str, str]:
    """(제목, 설명). 가려진 토론은 주제를 빼고 일반 문구로."""
    if debate.is_hidden:
        return GENERIC_TITLE, HIDDEN_DESCRIPTION
    return title_of(debate), SHARE_DESCRIPTION


def share_html(debate: Debate, base_url: str) -> str:
    """미리보기 태그 + 실제 화면으로 이동. 주제는 사용자 입력이라 반드시 이스케이프한다."""
    base = base_url.rstrip("/")
    target = html.escape(f"{base}/debates/{debate.id}")
    title, desc = _texts(debate)
    page_title = html.escape(title if debate.is_hidden else f"{title} — {GENERIC_TITLE}")
    image = html.escape(f"{base}/api/og/{debate.id}.png")
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>{page_title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="{GENERIC_TITLE}">
<meta property="og:title" content="{page_title}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="{OG_W}">
<meta property="og:image:height" content="{OG_H}">
<meta property="og:url" content="{target}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={target}">
<link rel="canonical" href="{target}">
</head>
<body><a href="{target}">토론 보러 가기</a></body>
</html>"""


@lru_cache(maxsize=2)
def _base_font(weight: str) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{weight}.ttf"), TITLE_MAX)


@lru_cache(maxsize=32)
def _font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    # 폰트 파일은 굵기마다 한 번만 열고, 크기는 변형으로 만든다(2.7MB 파일을 반복해서 열지 않게).
    return _base_font(weight).font_variant(size=size)


def _fit(draw: ImageDraw.ImageDraw, text: str, max_width: int) -> ImageFont.FreeTypeFont:
    """한 줄에 들어가도록 글자 크기를 줄인다(주제가 길어도 잘리지 않게)."""
    size = TITLE_MAX
    while size > TITLE_MIN:
        font = _font("SemiBold", size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 4
    return _font("SemiBold", TITLE_MIN)


def _draw_logo(draw: ImageDraw.ImageDraw) -> None:
    """Agora + "AI" 박스(로고 전용 라운드)."""
    logo_font = _font("SemiBold", LOGO_SIZE)
    draw.text((MARGIN_X, LOGO_Y), "Agora", font=logo_font, fill=TEXT_MAIN)
    ai_x = MARGIN_X + int(draw.textlength("Agora", font=logo_font)) + 14
    ai_font = _font("SemiBold", AI_SIZE)
    ai_w = int(draw.textlength("AI", font=ai_font)) + 28
    draw.rounded_rectangle((ai_x, LOGO_Y + 12, ai_x + ai_w, LOGO_Y + 72), radius=14, fill=PRIMARY)
    draw.text((ai_x + 14, LOGO_Y + 16), "AI", font=ai_font, fill="#FFFFFF")


def _render(title: str, desc: str) -> bytes:
    img = Image.new("RGB", (OG_W, OG_H), BG)
    draw = ImageDraw.Draw(img)
    _draw_logo(draw)
    draw.text((MARGIN_X, TITLE_Y), title, font=_fit(draw, title, OG_W - MARGIN_X * 2), fill=TEXT_MAIN)
    draw.text((MARGIN_X, DESC_Y), desc, font=_font("Regular", DESC_SIZE), fill=TEXT_SUB)
    out = io.BytesIO()
    img.save(out, format="PNG")  # optimize는 CPU만 더 써서 끈다(응답은 CDN이 캐시)
    return out.getvalue()


@lru_cache(maxsize=1)
def _plain_png() -> bytes:
    """폰트 없이도 그릴 수 있는 바탕 이미지(렌더 실패 대비)."""
    out = io.BytesIO()
    Image.new("RGB", (OG_W, OG_H), BG).save(out, format="PNG")
    return out.getvalue()


def og_image(debate: Debate) -> bytes:
    """1200×630 미리보기: 로고 + 주제 문장 + 안내. 승자 없음. 렌더가 실패하면 바탕 이미지(링크는 그대로 동작)."""
    try:
        return _render(*_texts(debate))
    except Exception:
        logger.exception("미리보기 이미지 렌더 실패: %s", debate.id)
        return _plain_png()
