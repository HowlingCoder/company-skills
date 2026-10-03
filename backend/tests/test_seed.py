import csv
import uuid
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from skill_management import seed
from skill_management.models import Skill
from skill_management.seed import seed_skills

SEED_FILE = Path(__file__).parent.parent / "data" / "skills.csv"


def unique(prefix: str) -> str:
    """Random suffix, so test data never collides with rows in the dev database."""
    return f"{prefix}-{uuid.uuid4().hex}"


def write_csv(path: Path, header: list[str], *rows: list[str]) -> Path:
    with path.open("w", encoding="utf-8", newline="") as file:
        csv.writer(file).writerows([header, *rows])
    return path


def get_skills(session: Session, *names: str) -> list[Skill]:
    lowered = [name.lower() for name in names]
    return list(
        session.scalars(select(Skill).where(func.lower(Skill.name).in_(lowered)))
    )


def test_seed_file_fills_the_catalog(session: Session):
    with SEED_FILE.open(encoding="utf-8", newline="") as file:
        names = [row["name"] for row in csv.DictReader(file)]

    inserted, skipped = seed_skills(session, SEED_FILE)

    assert inserted + skipped == len(names) == 100
    assert len(get_skills(session, *names)) == 100


def test_seed_inserts_new_skills(session: Session, tmp_path: Path):
    with_alias, without_alias = unique("Skill"), unique("Skill")
    path = write_csv(
        tmp_path / "skills.csv",
        ["name", "alias", "description"],
        [f"  {with_alias} ", "al", "Some description"],
        [without_alias, "", ""],
    )

    assert seed_skills(session, path) == (2, 0)

    first, second = (
        get_skills(session, name)[0] for name in (with_alias, without_alias)
    )
    assert (first.name, first.alias, first.description) == (
        with_alias,
        "al",
        "Some description",
    )
    assert (second.alias, second.description) == (None, None)


def test_seed_is_idempotent(session: Session, tmp_path: Path):
    name = unique("Skill")
    path = write_csv(tmp_path / "skills.csv", ["name"], [name], [name.upper()])

    assert seed_skills(session, path) == (1, 1)
    assert seed_skills(session, path) == (0, 2)
    assert len(get_skills(session, name)) == 1


def test_seed_leaves_existing_skills_untouched(session: Session, tmp_path: Path):
    name = unique("Skill")
    session.add(Skill(name=name.lower(), alias="keep", description="keep"))
    session.flush()
    path = write_csv(
        tmp_path / "skills.csv",
        ["name", "alias", "description"],
        [name, "new", "new"],
    )

    assert seed_skills(session, path) == (0, 1)

    [skill] = get_skills(session, name)
    assert (skill.name, skill.alias, skill.description) == (
        name.lower(),
        "keep",
        "keep",
    )


def test_seed_rejects_file_without_name_column(session: Session, tmp_path: Path):
    path = write_csv(tmp_path / "skills.csv", ["alias", "description"], ["py", "x"])

    with pytest.raises(ValueError, match="missing required column 'name'"):
        seed_skills(session, path)


def test_seed_rejects_whole_file_on_empty_name(session: Session, tmp_path: Path):
    name = unique("Skill")
    path = write_csv(tmp_path / "skills.csv", ["name", "alias"], [name, ""], [" ", "x"])

    with pytest.raises(ValueError, match="line 3 has no name"):
        seed_skills(session, path)

    assert get_skills(session, name) == []


def test_main_exits_with_message_for_missing_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    monkeypatch.setattr("sys.argv", ["seed-skills", str(tmp_path / "missing.csv")])

    with pytest.raises(SystemExit, match="Seed failed"):
        seed.main()
