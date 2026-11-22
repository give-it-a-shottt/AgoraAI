"""DB 모델. 구조 설명은 Admin_Docs/overview/data-model.md."""

import secrets
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.timeutil import utcnow

TOTAL_UTTERANCES = 6  # 3라운드 × 2명


def new_debate_id() -> str:
    return secrets.token_urlsafe(6)  # URL에 쓰는 8자 ID


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_user_provider"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    provider: Mapped[str] = mapped_column(String(16))
    provider_user_id: Mapped[str] = mapped_column(String(128))
    nickname: Mapped[str] = mapped_column(String(64), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Debate(Base):
    __tablename__ = "debates"

    id: Mapped[str] = mapped_column(String(16), primary_key=True, default=new_debate_id)
    topic_a: Mapped[str] = mapped_column(String(30))
    topic_b: Mapped[str] = mapped_column(String(30))
    normalized_key: Mapped[str] = mapped_column(String(80), index=True)
    cat_side: Mapped[str] = mapped_column(String(1))  # 냥냥이(HyperCLOVA X)가 맡은 편: "A" | "B"
    status: Mapped[str] = mapped_column(
        String(16), default="generating", server_default="generating"
    )  # generating|paused|done
    lock_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fail_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    paused_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    winner: Mapped[str | None] = mapped_column(String(1), nullable=True)  # 결과 API에서만 노출
    judge_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_status: Mapped[str] = mapped_column(
        String(16), default="pending", server_default="pending"
    )  # pending|done|failed
    judge_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    rebut_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    agree_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    today_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    creator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    utterances: Mapped[list["Utterance"]] = relationship(
        back_populates="debate", order_by="Utterance.seq", cascade="all, delete-orphan"
    )

    def character_of(self, side: str) -> str:
        return "cat" if side == self.cat_side else "penguin"


class Utterance(Base):
    __tablename__ = "utterances"
    __table_args__ = (UniqueConstraint("debate_id", "seq", name="uq_utterance_seq"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"))
    seq: Mapped[int] = mapped_column(Integer)
    round: Mapped[int] = mapped_column(Integer)
    side: Mapped[str] = mapped_column(String(1))
    text: Mapped[str] = mapped_column(Text)
    caption: Mapped[str] = mapped_column(String(40))
    stance_label: Mapped[str | None] = mapped_column(String(16), nullable=True)  # rebut|agree|neutral
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    debate: Mapped[Debate] = relationship(back_populates="utterances")


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("debate_id", "browser_id", name="uq_prediction_browser"),
        Index("ix_predictions_client_recent", "client_hash", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"))
    browser_id: Mapped[str] = mapped_column(String(36))
    pick: Mapped[str] = mapped_column(String(1))
    client_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)  # 요청 수 제한용(IP 해시)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Empathy(Base):
    __tablename__ = "empathies"
    __table_args__ = (
        UniqueConstraint("utterance_id", "browser_id", name="uq_empathy_browser"),
        Index("ix_empathies_client_recent", "client_hash", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    utterance_id: Mapped[int] = mapped_column(ForeignKey("utterances.id", ondelete="CASCADE"))
    browser_id: Mapped[str] = mapped_column(String(36))
    client_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("debate_id", "browser_id", name="uq_report_browser"),
        Index("ix_reports_client_recent", "client_hash", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    debate_id: Mapped[str] = mapped_column(ForeignKey("debates.id", ondelete="CASCADE"))
    browser_id: Mapped[str] = mapped_column(String(36))
    reason: Mapped[str] = mapped_column(String(32))
    client_hash: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
