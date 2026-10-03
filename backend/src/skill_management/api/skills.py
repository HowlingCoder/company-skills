import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from skill_management.db import get_session
from skill_management.models import Skill

router = APIRouter()


class SkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    alias: str | None
    description: str | None


@router.get("/skills", response_model=list[SkillRead])
def list_skills(
    session: Annotated[Session, Depends(get_session)], q: str = ""
) -> list[Skill]:
    """Skill catalog for the autocomplete; q is a substring of name or alias."""
    query = select(Skill).where(Skill.deleted_at.is_(None))
    term = q.strip()
    if term:
        # autoescape: % and _ in the input are matched literally
        query = query.where(
            or_(
                Skill.name.icontains(term, autoescape=True),
                Skill.alias.icontains(term, autoescape=True),
            )
        )
    return list(session.scalars(query.order_by(func.lower(Skill.name))))
