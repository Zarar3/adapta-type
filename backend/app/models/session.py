from pydantic import BaseModel, Field


class WpmDataPoint(BaseModel):
    t: int = Field(..., ge=0, le=7200)
    wpm: float = Field(..., ge=0, le=300)
    raw: float = Field(..., ge=0, le=300)
    errors: int = Field(..., ge=0, le=1000)


class SessionCreate(BaseModel):
    duration: int = Field(..., ge=15, le=120)
    wpm: float = Field(..., ge=0, le=300)
    raw_wpm: float = Field(..., ge=0, le=300)
    accuracy: float = Field(..., ge=0, le=100)
    wpm_history: list[WpmDataPoint] = Field(..., max_length=7200)
    ngram_mistakes: dict[str, int] = Field(..., max_length=500)
