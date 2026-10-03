import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from skill_management.models import Employee, Skill, SkillAssignment


@pytest.fixture
def token() -> str:
    """Random marker in the test data, so searches never hit dev database rows."""
    return uuid.uuid4().hex


def add_employee(
    session: Session,
    token: str,
    firstname: str,
    lastname: str = "Muster",
    skills: dict[Skill, int] | None = None,
    **fields,
) -> Employee:
    employee = Employee(
        firstname=firstname,
        lastname=lastname,
        email=f"{firstname}.{lastname}.{token}@example.com".lower(),
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


def add_skill(session: Session, name: str, **fields) -> Skill:
    skill = Skill(name=name, **fields)
    session.add(skill)
    session.flush()
    return skill


def search(client: TestClient, token: str, **params) -> list[dict]:
    """Search limited to the employees of this test via the token in the email."""
    q = f"{params.pop('q', '')} {token}"
    response = client.get("/employees", params={"q": q, **params})
    assert response.status_code == 200
    return response.json()


def firstnames(employees: list[dict]) -> list[str]:
    return [employee["firstname"] for employee in employees]


def test_without_parameters_returns_all_active_employees_sorted_by_name(
    client: TestClient, session: Session, token: str
):
    add_employee(session, token, "Zoe", "Adler")
    add_employee(session, token, "Ben", "Zimmer")
    add_employee(session, token, "anna", "Adler")
    add_employee(session, token, "Gone", "Adler", deleted_at=datetime.now(UTC))

    response = client.get("/employees")

    assert response.status_code == 200
    own = [e for e in response.json() if token in e["email"]]
    assert firstnames(own) == ["anna", "Zoe", "Ben"]


def test_employee_carries_own_data_and_skills_sorted_by_level(
    client: TestClient, session: Session, token: str
):
    low = add_skill(session, f"low-{token}", alias="lo")
    high = add_skill(session, f"high-{token}")
    employee = add_employee(session, token, "Max", skills={low: 2, high: 5})

    assert search(client, token) == [
        {
            "id": str(employee.id),
            "firstname": "Max",
            "lastname": "Muster",
            "email": employee.email,
            "age": 30,
            "skills": [
                {
                    "skill_id": str(high.id),
                    "name": high.name,
                    "alias": None,
                    "proficiency_level": 5,
                    "matched": False,
                },
                {
                    "skill_id": str(low.id),
                    "name": low.name,
                    "alias": "lo",
                    "proficiency_level": 2,
                    "matched": False,
                },
            ],
        }
    ]


def test_employee_without_skills_has_an_empty_skill_list(
    client: TestClient, session: Session, token: str
):
    add_employee(session, token, "Max")

    assert search(client, token)[0]["skills"] == []


@pytest.mark.parametrize("q", ["maxi", "STERM", "milian.must", "mil musterm"])
def test_q_matches_substrings_of_firstname_lastname_and_email(
    client: TestClient, session: Session, token: str, q: str
):
    add_employee(session, token, "Maximilian", "Mustermann")
    add_employee(session, token, "Erika", "Beispiel")

    assert firstnames(search(client, token, q=q)) == ["Maximilian"]


def test_wildcard_characters_in_q_are_matched_literally(
    client: TestClient, session: Session, token: str
):
    add_employee(session, token, "Max")

    assert search(client, token, q="M_x") == []
    assert search(client, token, q="M%") == []


def test_skill_term_is_an_exact_case_insensitive_match_on_name_or_alias(
    client: TestClient, session: Session, token: str
):
    c = add_skill(session, f"C{token}")
    c_sharp = add_skill(session, f"C{token}#", alias=f"csharp{token}")
    add_employee(session, token, "Plain", skills={c: 3})
    add_employee(session, token, "Sharp", skills={c_sharp: 3})

    assert firstnames(search(client, token, skills=f"c{token}")) == ["Plain"]
    assert firstnames(search(client, token, skills=f"CSHARP{token}")) == ["Sharp"]


def test_star_is_a_wildcard_and_like_characters_are_literal(
    client: TestClient, session: Session, token: str
):
    c = add_skill(session, f"C{token}")
    c_sharp = add_skill(session, f"C{token}#")
    add_employee(session, token, "Plain", skills={c: 3})
    add_employee(session, token, "Sharp", skills={c_sharp: 3})

    assert firstnames(search(client, token, skills=f"c{token}*")) == ["Plain", "Sharp"]
    assert search(client, token, skills=f"c{token}%") == []
    assert search(client, token, skills=f"c{token}_") == []


def test_skill_match_and_requires_every_term_or_only_one(
    client: TestClient, session: Session, token: str
):
    python = add_skill(session, f"python-{token}")
    docker = add_skill(session, f"docker-{token}")
    add_employee(session, token, "Both", skills={python: 3, docker: 3})
    add_employee(session, token, "Docker", skills={docker: 3})
    add_employee(session, token, "None")
    terms = [python.name, docker.name]

    assert firstnames(search(client, token, skills=terms)) == ["Both"]
    assert firstnames(search(client, token, skills=terms, skill_match="or")) == [
        "Both",
        "Docker",
    ]


def test_min_level_applies_to_every_skill_term(
    client: TestClient, session: Session, token: str
):
    python = add_skill(session, f"python-{token}")
    docker = add_skill(session, f"docker-{token}")
    add_employee(session, token, "Expert", skills={python: 4, docker: 5})
    add_employee(session, token, "Mixed", skills={python: 4, docker: 2})
    terms = [python.name, docker.name]

    assert firstnames(search(client, token, skills=terms, min_level=4)) == ["Expert"]
    assert firstnames(
        search(client, token, skills=terms, min_level=4, skill_match="or")
    ) == ["Expert", "Mixed"]


def test_min_level_without_skills_needs_one_skill_at_that_level(
    client: TestClient, session: Session, token: str
):
    skill = add_skill(session, f"python-{token}")
    add_employee(session, token, "Senior", skills={skill: 4})
    add_employee(session, token, "Junior", skills={skill: 3})
    add_employee(session, token, "None")

    assert firstnames(search(client, token, min_level=4)) == ["Senior"]


def test_q_and_skills_are_combined_with_and(
    client: TestClient, session: Session, token: str
):
    skill = add_skill(session, f"python-{token}")
    add_employee(session, token, "Max", skills={skill: 3})
    add_employee(session, token, "Erika", skills={skill: 3})
    add_employee(session, token, "Maximus")

    assert firstnames(search(client, token, q="max", skills=skill.name)) == ["Max"]


def test_matched_marks_the_skills_that_satisfy_the_search(
    client: TestClient, session: Session, token: str
):
    python = add_skill(session, f"python-{token}")
    docker = add_skill(session, f"docker-{token}")
    java = add_skill(session, f"java-{token}")
    add_employee(session, token, "Max", skills={python: 5, docker: 2, java: 4})

    [employee] = search(
        client, token, skills=[python.name, docker.name], skill_match="or", min_level=3
    )

    assert {s["name"]: s["matched"] for s in employee["skills"]} == {
        python.name: True,
        docker.name: False,
        java.name: False,
    }


def test_soft_deleted_skills_are_neither_searched_nor_returned(
    client: TestClient, session: Session, token: str
):
    gone = add_skill(session, f"gone-{token}", deleted_at=datetime.now(UTC))
    add_employee(session, token, "Max", skills={gone: 3})

    assert search(client, token, skills=gone.name) == []
    assert search(client, token)[0]["skills"] == []


@pytest.mark.parametrize(
    "params",
    [{"min_level": 0}, {"min_level": 6}, {"min_level": "high"}, {"skill_match": "xor"}],
)
def test_invalid_parameters_are_rejected(client: TestClient, params: dict):
    response = client.get("/employees", params=params)

    assert response.status_code == 422
