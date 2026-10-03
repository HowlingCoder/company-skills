import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import ColumnElement, and_, func, or_, select, true
from sqlalchemy.orm import Session, selectinload

from skill_management.db import get_session
from skill_management.employee_import import (
    EmployeeRow,
    ImportFileError,
    RowError,
    parse_employees,
)
from skill_management.models import Employee, Skill, SkillAssignment

router = APIRouter()

LIKE_ESCAPE = "\\"


class EmployeeSkillRead(BaseModel):
    skill_id: uuid.UUID
    name: str
    alias: str | None
    proficiency_level: int
    matched: bool


class EmployeeRead(BaseModel):
    id: uuid.UUID
    firstname: str
    lastname: str
    email: str
    age: int
    skills: list[EmployeeSkillRead]


class ImportReport(BaseModel):
    imported_count: int
    failed_count: int
    imported: list[EmployeeRow]
    errors: list[RowError]


def skill_term_filter(term: str) -> ColumnElement[bool]:
    """Exact match on skill name or alias; * is the only wildcard."""
    pattern = term
    for char in (LIKE_ESCAPE, "%", "_"):
        pattern = pattern.replace(char, LIKE_ESCAPE + char)
    pattern = pattern.replace("*", "%")
    return or_(
        Skill.name.ilike(pattern, escape=LIKE_ESCAPE),
        Skill.alias.ilike(pattern, escape=LIKE_ESCAPE),
    )


def skill_search_filter(
    condition: ColumnElement[bool], min_level: int | None
) -> ColumnElement[bool]:
    """Assignments of active skills that fit the condition and the level."""
    filters = [SkillAssignment.skill.has(and_(Skill.deleted_at.is_(None), condition))]
    if min_level is not None:
        filters.append(SkillAssignment.proficiency_level >= min_level)
    return and_(*filters)


@router.get("/employees")
def list_employees(
    session: Annotated[Session, Depends(get_session)],
    q: str = "",
    skills: Annotated[list[str] | None, Query()] = None,
    skill_match: Literal["and", "or"] = "and",
    min_level: Annotated[int | None, Query(ge=1, le=5)] = None,
) -> list[EmployeeRead]:
    """Employee overview and search; without parameters all employees."""
    query = select(Employee).where(Employee.deleted_at.is_(None))

    for word in q.split():
        query = query.where(
            or_(
                Employee.firstname.icontains(word, autoescape=True),
                Employee.lastname.icontains(word, autoescape=True),
                Employee.email.icontains(word, autoescape=True),
            )
        )

    term_filters = [
        skill_term_filter(term.strip()) for term in skills or [] if term.strip()
    ]
    if term_filters and skill_match == "and":
        # One EXISTS per term: each term may be satisfied by a different skill
        for term_filter in term_filters:
            query = query.where(
                Employee.skill_assignments.any(
                    skill_search_filter(term_filter, min_level)
                )
            )

    # What counts as a match for the highlighting: any term, at the level
    matched_filter = None
    if term_filters or min_level is not None:
        any_term = or_(*term_filters) if term_filters else true()
        matched_filter = skill_search_filter(any_term, min_level)
        if not term_filters or skill_match == "or":
            query = query.where(Employee.skill_assignments.any(matched_filter))

    employees = session.scalars(
        query.order_by(
            func.lower(Employee.lastname), func.lower(Employee.firstname)
        ).options(
            selectinload(Employee.skill_assignments).joinedload(SkillAssignment.skill)
        )
    ).all()

    matched_ids: set[uuid.UUID] = set()
    if matched_filter is not None and employees:
        matched_ids = set(
            session.scalars(
                select(SkillAssignment.id).where(
                    SkillAssignment.employee_id.in_([e.id for e in employees]),
                    matched_filter,
                )
            )
        )

    return [
        EmployeeRead(
            id=employee.id,
            firstname=employee.firstname,
            lastname=employee.lastname,
            email=employee.email,
            age=employee.age,
            skills=[
                EmployeeSkillRead(
                    skill_id=assignment.skill_id,
                    name=assignment.skill.name,
                    alias=assignment.skill.alias,
                    proficiency_level=assignment.proficiency_level,
                    matched=assignment.id in matched_ids,
                )
                for assignment in sorted(
                    employee.skill_assignments,
                    key=lambda a: (-a.proficiency_level, a.skill.name.lower()),
                )
                if assignment.skill.deleted_at is None
            ],
        )
        for employee in employees
    ]


@router.post("/employees/import")
def import_employees(
    file: UploadFile, session: Annotated[Session, Depends(get_session)]
) -> ImportReport:
    """Upsert employees from a CSV by email; invalid rows end up in the report."""
    try:
        rows, errors = parse_employees(file.file.read())
    except ImportFileError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    existing = {
        employee.email.lower(): employee
        for employee in session.scalars(
            select(Employee).where(
                func.lower(Employee.email).in_([row.email for _, row in rows])
            )
        )
    }

    imported = []
    for line, row in rows:
        employee = existing.get(row.email)
        if employee is None:
            session.add(Employee(**row.model_dump()))
        elif employee.deleted_at is not None:
            errors.append(
                RowError(
                    line=line,
                    message=f"Employee {row.email} was deleted and is not reactivated",
                )
            )
            continue
        else:
            employee.firstname = row.firstname
            employee.lastname = row.lastname
            employee.email = row.email
            employee.age = row.age
        imported.append(row)

    # get_session does not commit; all rows of one file share one transaction
    session.commit()

    errors.sort(key=lambda error: error.line)
    return ImportReport(
        imported_count=len(imported),
        failed_count=len(errors),
        imported=imported,
        errors=errors,
    )
