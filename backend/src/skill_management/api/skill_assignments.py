import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from skill_management.db import get_session
from skill_management.models import Employee, Skill, SkillAssignment

router = APIRouter()


class BulkAssignment(BaseModel):
    employee_ids: list[uuid.UUID] = Field(min_length=1)
    skill_id: uuid.UUID
    proficiency_level: int = Field(ge=1, le=5)


class BulkAssignmentResult(BaseModel):
    created: list[uuid.UUID]
    updated: list[uuid.UUID]
    skipped: list[uuid.UUID]


@router.post("/skill-assignments/bulk")
def bulk_assign_skill(
    body: BulkAssignment,
    session: Annotated[Session, Depends(get_session)],
    on_conflict: Literal["skip", "overwrite"] = "skip",
) -> BulkAssignmentResult:
    """Assign one skill to many employees; existing levels are kept by default."""
    skill_id = session.scalar(
        select(Skill.id).where(Skill.id == body.skill_id, Skill.deleted_at.is_(None))
    )
    if skill_id is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    employee_ids = list(dict.fromkeys(body.employee_ids))
    known = set(
        session.scalars(
            select(Employee.id).where(
                Employee.id.in_(employee_ids), Employee.deleted_at.is_(None)
            )
        )
    )
    unknown = [
        str(employee_id) for employee_id in employee_ids if employee_id not in known
    ]
    if unknown:
        raise HTTPException(
            status_code=404, detail=f"Employees not found: {', '.join(unknown)}"
        )

    # The frontend preview is not trusted: conflicts are checked here
    existing = {
        assignment.employee_id: assignment
        for assignment in session.scalars(
            select(SkillAssignment).where(
                SkillAssignment.skill_id == skill_id,
                SkillAssignment.employee_id.in_(employee_ids),
            )
        )
    }

    result = BulkAssignmentResult(created=[], updated=[], skipped=[])
    for employee_id in employee_ids:
        assignment = existing.get(employee_id)
        if assignment is None:
            session.add(
                SkillAssignment(
                    employee_id=employee_id,
                    skill_id=skill_id,
                    proficiency_level=body.proficiency_level,
                )
            )
            result.created.append(employee_id)
        elif on_conflict == "overwrite":
            assignment.proficiency_level = body.proficiency_level
            result.updated.append(employee_id)
        else:
            result.skipped.append(employee_id)

    session.commit()
    return result
