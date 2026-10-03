import csv
import io
import re

from pydantic import BaseModel, ValidationError, field_validator
from pydantic_core import PydanticCustomError

REQUIRED_COLUMNS = ("lastname", "firstname", "email", "age")
EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
MAX_AGE = 150


class ImportFileError(ValueError):
    """The file as a whole cannot be imported."""


class RowError(BaseModel):
    line: int
    message: str


class EmployeeRow(BaseModel):
    """One valid CSV row; only the allowlisted fields."""

    lastname: str
    firstname: str
    email: str
    age: int

    @field_validator("lastname", "firstname", mode="before")
    @classmethod
    def name_is_present(cls, value: str | None, info) -> str:
        value = (value or "").strip()
        if not value:
            raise PydanticCustomError(
                "missing", "{field} is required", {"field": info.field_name}
            )
        return value

    @field_validator("email", mode="before")
    @classmethod
    def email_is_valid(cls, value: str | None) -> str:
        # Lowercase: the email is the upsert key and the unique constraint is
        # case-sensitive
        value = (value or "").strip().lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise PydanticCustomError("email", "email is not a valid email address")
        return value

    @field_validator("age", mode="before")
    @classmethod
    def age_is_in_range(cls, value: str | None) -> int:
        value = (value or "").strip()
        # isascii: isdigit alone also accepts digits of other scripts
        if not (value.isascii() and value.isdigit() and 0 < int(value) <= MAX_AGE):
            raise PydanticCustomError(
                "age",
                "age must be a whole number between 1 and {max}",
                {"max": MAX_AGE},
            )
        return int(value)


def detect_delimiter(header_line: str) -> str:
    return ";" if header_line.count(";") > header_line.count(",") else ","


def normalize_header(header: str) -> str:
    return header.strip().lower().replace("-", "")


def parse_employees(
    content: bytes,
) -> tuple[list[tuple[int, EmployeeRow]], list[RowError]]:
    """Read an employee CSV into valid rows and row errors, both with line numbers.

    Raises ImportFileError if the file is empty, unreadable or lacks a
    required column. Line numbers match a spreadsheet: the header is line 1.
    """
    try:
        # utf-8-sig strips the BOM of an Excel export
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ImportFileError("File is not UTF-8 encoded text") from error
    if "\x00" in text:
        raise ImportFileError("File is not a text file")

    header_line = next((line for line in text.splitlines() if line.strip()), None)
    if header_line is None:
        raise ImportFileError("File is empty")

    reader = csv.reader(
        io.StringIO(text, newline=""), delimiter=detect_delimiter(header_line)
    )
    try:
        headers = next(row for row in reader if row)
    except (csv.Error, StopIteration) as error:
        raise ImportFileError("File is not a readable CSV file") from error
    headers = [normalize_header(header) for header in headers]

    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    if missing:
        raise ImportFileError(f"Missing required columns: {', '.join(missing)}")

    rows: list[tuple[int, EmployeeRow]] = []
    errors: list[RowError] = []
    first_line_by_email: dict[str, int] = {}

    while True:
        # A quoted field can span lines; report the line the row starts on
        line = reader.line_num + 1
        try:
            values = next(reader)
        except StopIteration:
            break
        except csv.Error as error:
            errors.append(RowError(line=line, message=f"Unreadable row: {error}"))
            continue

        if not any(value.strip() for value in values):
            continue
        if len(values) != len(headers):
            errors.append(
                RowError(
                    line=line,
                    message=(
                        f"Unreadable row: expected {len(headers)} columns, "
                        f"found {len(values)}"
                    ),
                )
            )
            continue

        record = dict(zip(headers, values, strict=True))
        try:
            row = EmployeeRow.model_validate(
                {column: record[column] for column in REQUIRED_COLUMNS}
            )
        except ValidationError as error:
            message = "; ".join(detail["msg"] for detail in error.errors())
            errors.append(RowError(line=line, message=message))
            continue

        if row.email in first_line_by_email:
            errors.append(
                RowError(
                    line=line,
                    message=(
                        f"Duplicate email {row.email}: already used in line "
                        f"{first_line_by_email[row.email]}"
                    ),
                )
            )
            continue
        first_line_by_email[row.email] = line
        rows.append((line, row))

    return rows, errors
