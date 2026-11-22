"""API 요청·응답 모양. 계약은 Admin_Docs/overview/api-list.md와 같아야 한다.
⚠️ 승자(winner)는 ResultOut 외 어떤 응답에도 넣지 않는다(§5)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Side = Literal["A", "B"]


class CastMember(BaseModel):
    character: Literal["cat", "penguin"]
    side: Side
    name: str
    ai: str
    catchphrase: str


class DebateSummary(BaseModel):
    id: str
    topic_a: str
    topic_b: str
    status: Literal["generating", "paused", "done"]
    prediction_count: int
    created_at: datetime
    today_date: date | None
    cast: list[CastMember]


class DebateList(BaseModel):
    items: list[DebateSummary]
    page: int
    total_pages: int
    total: int


class DebateDetail(DebateSummary):
    hidden: bool
    utterance_count: int


class SimilarOut(BaseModel):
    debate: DebateSummary | None


class UtteranceOut(BaseModel):
    id: int
    seq: int
    round: int
    side: Side
    character: Literal["cat", "penguin"]
    text: str
    caption: str
    empathy_count: int


class UtteranceList(BaseModel):
    items: list[UtteranceOut]
    status: Literal["generating", "paused", "done"]
    total: int


class StatusOut(BaseModel):
    status: Literal["generating", "paused", "done"]


class PredictionIn(BaseModel):
    pick: Side


class PredictionOut(BaseModel):
    pick: Side | None


class EmpathyOut(BaseModel):
    count: int
    empathized: bool


class AudienceOut(BaseModel):
    count: int
    a_ratio: float | None
    b_ratio: float | None


class MetricsOut(BaseModel):
    rebut_rate: float | None
    agree_rate: float | None
    human_agreement: float | None


class ResultOut(BaseModel):
    judge_status: Literal["pending", "done", "failed"]
    winner: Side | None
    judge_reason: str | None
    my_prediction: Side | None
    audience: AudienceOut
    metrics: MetricsOut


ReportReason = Literal["hate", "sexual", "violence", "spam", "other"]


class ReportIn(BaseModel):
    reason: ReportReason


class ReportOut(BaseModel):
    reported: bool
    hidden: bool


class TopicSuggestion(BaseModel):
    a: str
    b: str


class TopicSuggestionList(BaseModel):
    items: list[TopicSuggestion]


class CreateDebateIn(BaseModel):
    topic_a: str = Field(min_length=2, max_length=30)
    topic_b: str = Field(min_length=2, max_length=30)


class CreateDebateOut(BaseModel):
    id: str


class QuotaOut(BaseModel):
    remaining: int
    limit: int
    reset_at: datetime


class UserOut(BaseModel):
    id: int
    nickname: str


class MeOut(BaseModel):
    user: UserOut | None


class ProvidersOut(BaseModel):
    google: bool
    kakao: bool
    dev: bool
