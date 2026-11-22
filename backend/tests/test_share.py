"""F-006 공유: OG HTML(이스케이프·승자 없음·이동), 미리보기 이미지."""

import io

from PIL import Image

from tests.factories import make_debate


def test_share_page_has_og_tags_without_winner(client, db):
    d = make_debate(db, "평생 짜장", "평생 짬뽕", winner="B")
    res = client.get(f"/share/{d.id}")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/html")
    body = res.text
    assert 'property="og:title" content="평생 짜장 vs 평생 짬뽕 — Agora AI 토론장"' in body
    assert f"/api/og/{d.id}.png" in body
    assert f"/debates/{d.id}" in body and 'http-equiv="refresh"' in body
    assert "승" not in body.split("<title>")[1].split("</title>")[0]  # 승자 표시 없음


def test_share_page_escapes_topic(client, db):
    d = make_debate(db, '<script>alert(1)</script>', '"><img src=x>')
    body = client.get(f"/share/{d.id}").text
    assert "<script>alert(1)" not in body and "&lt;script&gt;" in body
    assert '"><img' not in body


def test_og_image_is_png_1200x630(client, db):
    d = make_debate(db, "아주아주 긴 주제 문장이 들어가도", "한 줄에 맞게 줄어들어요 정말로")
    res = client.get(f"/api/og/{d.id}.png")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"
    assert Image.open(io.BytesIO(res.content)).size == (1200, 630)


def test_share_missing(client):
    assert client.get("/share/nope").status_code == 404
    assert client.get("/api/og/nope.png").status_code == 404


def test_share_404_uses_common_error_shape(client):
    res = client.get("/share/nope")
    assert res.json()["detail"]["code"] == "not_found"


def test_hidden_debate_redirects_but_hides_topic(client, db):
    d = make_debate(db, "신고된", "문구", hidden=True)
    res = client.get(f"/share/{d.id}")
    assert res.status_code == 200 and f"/debates/{d.id}" in res.text
    assert "신고된" not in res.text and "Agora AI 토론장" in res.text
    assert "max-age=60" in res.headers["cache-control"]
    img = client.get(f"/api/og/{d.id}.png")
    assert img.status_code == 200 and "max-age=60" in img.headers["cache-control"]


def test_og_image_falls_back_when_render_fails(client, db, monkeypatch):
    from app.services import share

    def boom(*a, **k):
        raise OSError("폰트 없음")

    monkeypatch.setattr(share, "_render", boom)
    d = make_debate(db)
    res = client.get(f"/api/og/{d.id}.png")
    assert res.status_code == 200 and Image.open(io.BytesIO(res.content)).size == (1200, 630)


def test_og_cache_headers_allow_cdn(client, db):
    d = make_debate(db)
    assert "s-maxage=86400" in client.get(f"/api/og/{d.id}.png").headers["cache-control"]
    assert "s-maxage=300" in client.get(f"/share/{d.id}").headers["cache-control"]
