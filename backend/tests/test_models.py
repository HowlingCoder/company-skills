import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from skill_management.models import Employee, Skill, SkillAssignment


def unique(prefix: str) -> str:
    """Random suffix, so test data never collides with rows in the dev database."""
    return f"{prefix}-{uuid.uuid4().hex}"


def make_employee(**overrides) -> Employee:
    fields = {
        "firstname": "Ada",
        "lastname": "Lovelace",
        "email": f"{unique('ada')}@example.com",
        "age": 36,
    }
    return Employee(**(fields | overrides))


def test_employee_timestamps_are_equal_on_insert(session: Session):
    employee = make_employee()
    session.add(employee)
    session.flush()
    session.refresh(employee)

    assert employee.created_at == employee.updated_at
    assert employee.deleted_at is None
    assert employee.skill_assignments == []


def test_employee_email_is_unique(session: Session):
    email = f"{unique('ada')}@example.com"
    session.add(make_employee(email=email))
    session.flush()

    session.add(make_employee(email=email))
    with pytest.raises(IntegrityError, match="uq_employee_email"):
        session.flush()


@pytest.mark.parametrize("age", [0, -1])
def test_employee_age_must_be_positive(session: Session, age: int):
    session.add(make_employee(age=age))

    with pytest.raises(IntegrityError, match="ck_employee_age_positive"):
        session.flush()


def test_skill_name_is_unique_case_insensitively(session: Session):
    name = unique("Skill")
    session.add(Skill(name=name))
    session.flush()

    session.add(Skill(name=name.lower()))
    with pytest.raises(IntegrityError, match="uq_skill_name_lower"):
        session.flush()


@pytest.mark.parametrize("level", [0, 6])
def test_proficiency_level_must_be_between_1_and_5(session: Session, level: int):
    employee = make_employee()
    skill = Skill(name=unique("Skill"))
    employee.skill_assignments.append(
        SkillAssignment(skill=skill, proficiency_level=level)
    )
    session.add(employee)

    with pytest.raises(
        IntegrityError, match="ck_skill_assignment_proficiency_level_range"
    ):
        session.flush()


def test_employee_has_one_assignment_per_skill(session: Session):
    employee = make_employee()
    skill = Skill(name=unique("Skill"))
    employee.skill_assignments.append(SkillAssignment(skill=skill, proficiency_level=3))
    session.add(employee)
    session.flush()

    employee.skill_assignments.append(SkillAssignment(skill=skill, proficiency_level=5))
    with pytest.raises(IntegrityError, match="uq_skill_assignment_employee_id"):
        session.flush()


def test_removing_an_assignment_from_the_employee_deletes_it(session: Session):
    employee = make_employee()
    skill = Skill(name=unique("Skill"))
    employee.skill_assignments.append(SkillAssignment(skill=skill, proficiency_level=3))
    session.add(employee)
    session.flush()

    employee.skill_assignments.clear()
    session.flush()

    assert session.query(SkillAssignment).filter_by(skill_id=skill.id).count() == 0
