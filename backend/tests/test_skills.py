import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from skill_management.models import Skill


def unique(prefix: str) -> str:
    """Random suffix, so test data never collides with rows in the dev database."""
    return f"{prefix}-{uuid.uuid4().hex}"


def add_skill(session: Session, name: str, **fields) -> Skill:
    skill = Skill(name=name, **fields)
    session.add(skill)
    session.flush()
    return skill


def names(response) -> list[str]:
    return [skill["name"] for skill in response.json()]


def test_without_q_returns_all_active_skills_sorted_by_name(
    client: TestClient, session: Session
):
    token = unique("sort")
    add_skill(session, f"b-{token}")
    add_skill(session, f"A-{token}")
    add_skill(session, f"c-{token}")

    response = client.get("/skills")

    assert response.status_code == 200
    assert [name for name in names(response) if token in name] == [
        f"A-{token}",
        f"b-{token}",
        f"c-{token}",
    ]


def test_response_contains_only_the_catalog_fields(
    client: TestClient, session: Session
):
    name = unique("fields")
    skill = add_skill(session, name, alias="fl", description="A test skill")

    response = client.get("/skills", params={"q": name})

    assert response.json() == [
        {
            "id": str(skill.id),
            "name": name,
            "alias": "fl",
            "description": "A test skill",
        }
    ]


def test_q_matches_a_substring_of_the_name_case_insensitively(
    client: TestClient, session: Session
):
    token = uuid.uuid4().hex
    add_skill(session, f"Java{token}Script")

    response = client.get("/skills", params={"q": f"VA{token.upper()}scr"})

    assert names(response) == [f"Java{token}Script"]


def test_q_matches_the_alias(client: TestClient, session: Session):
    alias = unique("K8s")
    name = unique("Kubernetes")
    add_skill(session, name, alias=alias)

    response = client.get("/skills", params={"q": alias.lower()})

    assert names(response) == [name]


def test_soft_deleted_skills_are_not_returned(client: TestClient, session: Session):
    token = unique("deleted")
    add_skill(session, f"active-{token}")
    add_skill(session, f"gone-{token}", deleted_at=datetime.now(UTC))

    response = client.get("/skills", params={"q": token})

    assert names(response) == [f"active-{token}"]


def test_wildcard_characters_in_q_are_matched_literally(
    client: TestClient, session: Session
):
    token = uuid.uuid4().hex
    add_skill(session, f"100%{token}")
    add_skill(session, f"100x{token}")
    add_skill(session, f"under_{token}")
    add_skill(session, f"underx{token}")

    assert names(client.get("/skills", params={"q": f"%{token}"})) == [f"100%{token}"]
    assert names(client.get("/skills", params={"q": f"_{token}"})) == [f"under_{token}"]


def test_q_without_match_returns_an_empty_list(client: TestClient):
    response = client.get("/skills", params={"q": unique("no-such-skill")})

    assert response.status_code == 200
    assert response.json() == []
