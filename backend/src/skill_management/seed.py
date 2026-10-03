import csv
import sys
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from skill_management.db import SessionLocal
from skill_management.models import Skill


def read_skills(path: Path) -> list[dict[str, str | None]]:
    """Read the seed file; any invalid row rejects the whole file."""
    # utf-8-sig strips the BOM of an Excel export
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if "name" not in (reader.fieldnames or []):
            raise ValueError(f"{path}: missing required column 'name'")

        rows = []
        for row in reader:
            name = (row["name"] or "").strip()
            if not name:
                raise ValueError(f"{path}: line {reader.line_num} has no name")
            rows.append(
                {
                    "name": name,
                    "alias": (row.get("alias") or "").strip() or None,
                    "description": (row.get("description") or "").strip() or None,
                }
            )
    return rows


def seed_skills(session: Session, path: Path) -> tuple[int, int]:
    """Insert the skills that are not in the catalog yet.

    Existing skills are matched by lower(name) and left untouched, including
    soft-deleted ones. Returns (inserted, already present).
    """
    rows = read_skills(path)
    if not rows:
        return 0, 0

    statement = (
        insert(Skill)
        .on_conflict_do_nothing(index_elements=[func.lower(Skill.name)])
        .returning(Skill.id)
    )
    inserted = len(session.execute(statement, rows).all())
    return inserted, len(rows) - inserted


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: seed-skills <path to csv>")

    try:
        with SessionLocal() as session:
            inserted, skipped = seed_skills(session, Path(sys.argv[1]))
            session.commit()
    except (OSError, ValueError) as error:
        sys.exit(f"Seed failed: {error}")

    print(f"Inserted {inserted} skills, {skipped} already present")
