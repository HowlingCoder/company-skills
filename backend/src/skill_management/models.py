import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skill_management.db import Base


class TimestampMixin:
    # now() is the transaction start time in PostgreSQL, so both columns get
    # the same value on insert
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Employee(TimestampMixin, Base):
    __tablename__ = "employee"
    __table_args__ = (CheckConstraint("age > 0", name="age_positive"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    firstname: Mapped[str]
    lastname: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)
    age: Mapped[int]
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    skill_assignments: Mapped[list["SkillAssignment"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )


class Skill(TimestampMixin, Base):
    __tablename__ = "skill"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column()
    description: Mapped[str | None]
    alias: Mapped[str | None]
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Explicit name: the naming convention cannot derive one from an expression
    __table_args__ = (Index("uq_skill_name_lower", func.lower(name), unique=True),)


class SkillAssignment(TimestampMixin, Base):
    __tablename__ = "skill_assignment"
    __table_args__ = (
        UniqueConstraint("employee_id", "skill_id"),
        CheckConstraint(
            "proficiency_level BETWEEN 1 AND 5", name="proficiency_level_range"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employee.id"))
    # Indexed for the skill search; the unique constraint starts with employee_id
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skill.id"), index=True)
    proficiency_level: Mapped[int]

    employee: Mapped[Employee] = relationship(back_populates="skill_assignments")
    skill: Mapped[Skill] = relationship()
