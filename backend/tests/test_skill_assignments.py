import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from skill_management.models import Employee, Skill, SkillAssignment


def add_skill(session: Session, name: str = "skill", **fields) -> Skill:
    skill = Skill(name=f"{name}-{uuid.uuid4().hex}", **fields)
    session.add(skill)
    session.flush()
    return skill


def add_employee(
    session: Session, skills: dict[Skill, int] | None = None, **fields
) -> Employee:
    employee = Employee(
        firstname="Max",
        lastname="Muster",
        email=f"{uuid.uuid4().hex}@example.com",
        age=30,
        **fields,
    )
    for skill, level in (skills or {}).items():
        employee.skill_assignments.append(
            SkillAssignment(skill=skill, proficiency_level=level)
        )
    session.add(employee)
    session.flush()
    return employee


def stored_levels(session: Session, employee: Employee) -> dict[uuid.UUID, int]:
    """Assignments as they are in the database: skill id -> level."""
    session.expire_all()
    rows = session.execute(
        select(SkillAssignment.skill_id, SkillAssignment.proficiency_level).where(
            SkillAssignment.employee_id == employee.id
        )
    )
    return {skill_id: level for skill_id, level in rows}


def put_skills(
    client: TestClient, employee_id: uuid.UUID, levels: dict[uuid.UUID, int]
):
    return client.put(
        f"/employees/{employee_id}/skills",
        json={
            "skills": [
                {"skill_id": str(skill_id), "proficiency_level": level}
                for skill_id, level in levels.items()
            ]
        },
    )


def bulk_assign(
    client: TestClient,
    employees: list[Employee],
    skill_id: uuid.UUID,
    level: int,
    **params,
):
    return client.post(
        "/skill-assignments/bulk",
        params=params,
        json={
            "employee_ids": [str(employee.id) for employee in employees],
            "skill_id": str(skill_id),
            "proficiency_level": level,
        },
    )


# PUT /employees/{id}/skills


def test_put_adds_changes_and_removes_in_one_request(
    client: TestClient, session: Session
):
    kept = add_skill(session, "kept")
    removed = add_skill(session, "removed")
    added = add_skill(session, "added", alias="new")
    employee = add_employee(session, skills={kept: 2, removed: 3})

    response = put_skills(client, employee.id, {kept.id: 5, added.id: 1})

    assert response.status_code == 200
    assert stored_levels(session, employee) == {kept.id: 5, added.id: 1}
    body = response.json()
    assert body["id"] == str(employee.id)
    assert body["skills"] == [
        {
            "skill_id": str(kept.id),
            "name": kept.name,
            "alias": None,
            "proficiency_level": 5,
            "matched": False,
        },
        {
            "skill_id": str(added.id),
            "name": added.name,
            "alias": "new",
            "proficiency_level": 1,
            "matched": False,
        },
    ]


def test_put_with_empty_list_removes_all_skills(client: TestClient, session: Session):
    employee = add_employee(session, skills={add_skill(session): 2})

    response = put_skills(client, employee.id, {})

    assert response.status_code == 200
    assert response.json()["skills"] == []
    assert stored_levels(session, employee) == {}


def test_put_does_not_touch_other_employees(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session, skills={skill: 2})
    other = add_employee(session, skills={skill: 4})

    put_skills(client, employee.id, {})

    assert stored_levels(session, other) == {skill.id: 4}


def test_put_keeps_assignments_of_soft_deleted_skills(
    client: TestClient, session: Session
):
    hidden = add_skill(session, "hidden", deleted_at=datetime.now(UTC))
    employee = add_employee(session, skills={hidden: 3})

    response = put_skills(client, employee.id, {})

    assert response.status_code == 200
    assert response.json()["skills"] == []
    assert stored_levels(session, employee) == {hidden.id: 3}


def test_put_for_unknown_employee_is_404(client: TestClient, session: Session):
    response = put_skills(client, uuid.uuid4(), {add_skill(session).id: 3})

    assert response.status_code == 404


def test_put_for_soft_deleted_employee_is_404(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session, deleted_at=datetime.now(UTC))

    response = put_skills(client, employee.id, {skill.id: 3})

    assert response.status_code == 404
    assert stored_levels(session, employee) == {}


def test_put_with_unknown_skill_is_404_and_writes_nothing(
    client: TestClient, session: Session
):
    existing = add_skill(session, "existing")
    new = add_skill(session, "new")
    employee = add_employee(session, skills={existing: 2})
    unknown = uuid.uuid4()

    response = put_skills(client, employee.id, {new.id: 4, unknown: 3})

    assert response.status_code == 404
    assert str(unknown) in response.json()["detail"]
    assert stored_levels(session, employee) == {existing.id: 2}


def test_put_with_soft_deleted_skill_is_404(client: TestClient, session: Session):
    deleted = add_skill(session, deleted_at=datetime.now(UTC))
    employee = add_employee(session)

    response = put_skills(client, employee.id, {deleted.id: 3})

    assert response.status_code == 404
    assert stored_levels(session, employee) == {}


def test_put_with_level_out_of_range_is_422(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session, skills={skill: 2})

    for level in (0, 6):
        response = put_skills(client, employee.id, {skill.id: level})
        assert response.status_code == 422

    assert stored_levels(session, employee) == {skill.id: 2}


def test_put_with_same_skill_twice_is_422(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session)
    item = {"skill_id": str(skill.id), "proficiency_level": 3}

    response = client.put(
        f"/employees/{employee.id}/skills", json={"skills": [item, item]}
    )

    assert response.status_code == 422
    assert stored_levels(session, employee) == {}


# POST /skill-assignments/bulk


def test_bulk_creates_assignment_for_each_employee(
    client: TestClient, session: Session
):
    skill = add_skill(session)
    first = add_employee(session)
    second = add_employee(session)

    response = bulk_assign(client, [first, second], skill.id, 3)

    assert response.status_code == 200
    assert response.json() == {
        "created": [str(first.id), str(second.id)],
        "updated": [],
        "skipped": [],
    }
    assert stored_levels(session, first) == {skill.id: 3}
    assert stored_levels(session, second) == {skill.id: 3}


def test_bulk_skips_existing_levels_by_default(client: TestClient, session: Session):
    skill = add_skill(session)
    has_skill = add_employee(session, skills={skill: 5})
    new = add_employee(session)

    response = bulk_assign(client, [has_skill, new], skill.id, 2)

    assert response.status_code == 200
    assert response.json() == {
        "created": [str(new.id)],
        "updated": [],
        "skipped": [str(has_skill.id)],
    }
    assert stored_levels(session, has_skill) == {skill.id: 5}
    assert stored_levels(session, new) == {skill.id: 2}


def test_bulk_overwrites_existing_levels_on_request(
    client: TestClient, session: Session
):
    skill = add_skill(session)
    has_skill = add_employee(session, skills={skill: 5})
    new = add_employee(session)

    response = bulk_assign(
        client, [has_skill, new], skill.id, 2, on_conflict="overwrite"
    )

    assert response.status_code == 200
    assert response.json() == {
        "created": [str(new.id)],
        "updated": [str(has_skill.id)],
        "skipped": [],
    }
    assert stored_levels(session, has_skill) == {skill.id: 2}


def test_bulk_processes_a_repeated_employee_once(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session)

    response = bulk_assign(client, [employee, employee], skill.id, 3)

    assert response.status_code == 200
    assert response.json()["created"] == [str(employee.id)]
    assert stored_levels(session, employee) == {skill.id: 3}


def test_bulk_with_unknown_skill_is_404(client: TestClient, session: Session):
    employee = add_employee(session)

    response = bulk_assign(client, [employee], uuid.uuid4(), 3)

    assert response.status_code == 404
    assert stored_levels(session, employee) == {}


def test_bulk_with_soft_deleted_skill_is_404(client: TestClient, session: Session):
    deleted = add_skill(session, deleted_at=datetime.now(UTC))
    employee = add_employee(session)

    response = bulk_assign(client, [employee], deleted.id, 3)

    assert response.status_code == 404
    assert stored_levels(session, employee) == {}


def test_bulk_with_unknown_employee_is_404_and_writes_nothing(
    client: TestClient, session: Session
):
    skill = add_skill(session)
    employee = add_employee(session)
    deleted = add_employee(session, deleted_at=datetime.now(UTC))

    response = bulk_assign(client, [employee, deleted], skill.id, 3)

    assert response.status_code == 404
    assert str(deleted.id) in response.json()["detail"]
    assert stored_levels(session, employee) == {}


def test_bulk_with_invalid_input_is_422(client: TestClient, session: Session):
    skill = add_skill(session)
    employee = add_employee(session)

    assert bulk_assign(client, [], skill.id, 3).status_code == 422
    assert bulk_assign(client, [employee], skill.id, 6).status_code == 422
    assert (
        bulk_assign(client, [employee], skill.id, 3, on_conflict="merge").status_code
        == 422
    )
    assert stored_levels(session, employee) == {}
