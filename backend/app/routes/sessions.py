from fastapi import APIRouter, Request
from app.middleware.rate_limit import limiter
from app.models.session import SessionCreate
from app.services.supabase_client import supabase

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", status_code=201)
@limiter.limit("10/minute")
async def create_session(request: Request, body: SessionCreate):
    supabase.table("sessions").insert(body.model_dump()).execute()
    return {"ok": True}
