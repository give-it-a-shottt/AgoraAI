"""공유 미리보기(F-006, §8): Vite SPA라 카카오톡·메신저가 읽을 OG 태그를 서버가 만든다.
⚠️ 승자는 미리보기 어디에도 넣지 않는다(받은 사람은 승부 예측부터, §5).
"""

import html
import io
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.models import Debate

FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"  # Pretendard(OFL)
OG_SIZE = (1200, 630)
SHARE_DESCRIPTION = "누가 이겼을까요? 먼저 예측하고 보세요"

# 디자인 토큰(tokens.css)과 같은 값
BG = "#F5F5F5"
TEXT_MAIN = "#111111"
TEXT_SUB = "#424242"
PRIMARY = "#056FC5"


def title_of(debate: Debate) -> str:
    return f"{debate.topic_a} vs {debate.topic_b}"


def share_html(debate: Debate, base_url: str) -> str:
    """미리보기 태그 + 실제 화면으로 이동. 주제는 사용자 입력이라 반드시 이스케이프한다."""
    base = base_url.rstrip("/")
    target = f"{base}/debates/{debate.id}"
    title = html.escape(f"{title_of(debate)} — Agora AI 토론장")
    desc = html.escape(SHARE_DESCRIPTION)
    image = html.escape(f"{base}/api/og/{debate.id}.png")
    target_attr = html.escape(target)
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Agora AI 토론장">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{target_attr}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={target_attr}">
<link rel="canonical" href="{target_attr}">
</head>
<body><a href="{target_attr}">토론 보러 가기</a></body>
</html>"""


@lru_cache(maxsize=4)
def _font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / f"Pretendard-{weight}.ttf"), size)


def _fit(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int) -> ImageFont.FreeTypeFont:
    """한 줄에 들어가도록 글자 크기를 줄인다(주제가 길어도 잘리지 않게)."""
    size = start
    while size > minimum:
        font = _font("SemiBold", size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 4
    return _font("SemiBold", minimum)


def og_image(debate: Debate) -> bytes:
    """1200×630 미리보기: 로고 + 주제 문장 + 안내. 승자 없음(§7 공유 미리보기 이미지)."""
    img = Image.new("RGB", OG_SIZE, BG)
    draw = ImageDraw.Draw(img)
    left = 96
    # 로고: Agora + "AI" 박스
    logo_font = _font("SemiBold", 56)
    draw.text((left, 150), "Agora", font=logo_font, fill=TEXT_MAIN)
    ai_x = left + int(draw.textlength("Agora", font=logo_font)) + 14
    ai_font = _font("SemiBold", 38)
    ai_w = int(draw.textlength("AI", font=ai_font)) + 28
    draw.rounded_rectangle((ai_x, 162, ai_x + ai_w, 222), radius=14, fill=PRIMARY)
    draw.text((ai_x + 14, 166), "AI", font=ai_font, fill="#FFFFFF")
    # 주제
    title = title_of(debate)
    title_font = _fit(draw, title, OG_SIZE[0] - left * 2, 84, 44)
    draw.text((left, 270), title, font=title_font, fill=TEXT_MAIN)
    # 안내
    draw.text((left, 400), SHARE_DESCRIPTION, font=_font("Regular", 40), fill=TEXT_SUB)
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()
