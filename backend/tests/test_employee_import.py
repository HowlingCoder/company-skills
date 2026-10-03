import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from skill_management.models import Employee


@pytest.fixture
def token() -> str:
    """Random marker in the emails, so the tests never hit dev database rows."""
    return uuid.uuid4().hex


def upload(client: TestClient, content: str | bytes) -> Response:
    if isinstance(content, str):
        content = content.encode()
    return client.post(
        "/employees/import", files={"file": ("employees.csv", content, "text/csv")}
    )


def stored(session: Session, token: str) -> list[tuple[str, str, str, int]]:
    """The employees of this test in the database, sorted by email."""
    session.expire_all()
    employees = session.scalars(
        select(Employee).where(Employee.email.contains(token)).order_by(Employee.email)
    )
    return [(e.lastname, e.firstname, e.email, e.age) for e in employees]


def test_imports_valid_rows_and_reports_only_the_users_own_data(
    client: TestClient, session: Session, token: str
):
    response = upload(
        client,
        "Lastname,Firstname,E-Mail,Age,Address\n"
        f"Muster,Max,max.{token}@example.com,30,Main Street 1\n"
        f"Adler,Anna,anna.{token}@example.com,41,Side Street 2\n",
    )

    assert response.status_code == 200
    assert response.json() == {
        "imported_count": 2,
        "failed_count": 0,
        "imported": [
            {
                "lastname": "Muster",
                "firstname": "Max",
                "email": f"max.{token}@example.com",
                "age": 30,
            },
            {
                "lastname": "Adler",
                "firstname": "Anna",
                "email": f"anna.{token}@example.com",
                "age": 41,
            },
        ],
        "errors": [],
    }
    assert stored(session, token) == [
        ("Adler", "Anna", f"anna.{token}@example.com", 41),
        ("Muster", "Max", f"max.{token}@example.com", 30),
    ]


def test_imported_employees_appear_in_the_overview(client: TestClient, token: str):
    upload(client, f"lastname,firstname,email,age\nMuster,Max,max.{token}@x.io,30\n")

    employees = client.get("/employees", params={"q": token}).json()

    assert [e["firstname"] for e in employees] == ["Max"]
    assert employees[0]["skills"] == []


def test_excel_export_with_semicolons_and_bom_is_imported(
    client: TestClient, session: Session, token: str
):
    content = (
        "Lastname;Firstname;E-Mail;Age;Address\r\n"
        f"Müller;Zoë;zoe.{token}@example.com;28;Main Street 1, Munich\r\n"
    ).encode("utf-8-sig")

    response = upload(client, content)

    assert response.status_code == 200
    assert stored(session, token) == [("Müller", "Zoë", f"zoe.{token}@example.com", 28)]


def test_headers_are_matched_regardless_of_case_whitespace_and_order(
    client: TestClient, session: Session, token: str
):
    response = upload(
        client,
        f" AGE , e-mail ,FIRSTNAME, LastName \n30,max.{token}@example.com,Max,Muster\n",
    )

    assert response.status_code == 200
    assert stored(session, token) == [("Muster", "Max", f"max.{token}@example.com", 30)]


def test_existing_employee_is_updated_by_email_ignoring_case(
    client: TestClient, session: Session, token: str
):
    employee = Employee(
        firstname="Max", lastname="Muster", email=f"max.{token}@example.com", age=30
    )
    session.add(employee)
    session.flush()

    response = upload(
        client,
        "lastname,firstname,email,age\n"
        f"Meier,Maximilian, MAX.{token}@Example.com ,31\n",
    )

    assert response.json()["imported_count"] == 1
    assert stored(session, token) == [
        ("Meier", "Maximilian", f"max.{token}@example.com", 31)
    ]
    assert session.scalars(
        select(Employee.id).where(Employee.email.contains(token))
    ).all() == [employee.id]


def test_invalid_rows_are_reported_with_their_line_and_valid_rows_still_imported(
    client: TestClient, session: Session, token: str
):
    response = upload(
        client,
        "lastname,firstname,email,age\n"
        f"Muster,Max,max.{token}@example.com,30\n"
        f"Alt,Ada,ada.{token}@example.com,abc\n"
        f"Null,Nora,nora.{token}@example.com,0\n"
        f",Otto,otto.{token}@example.com,40\n"
        "Kein,Karl,not-an-email,40\n"
        f"Short,Sam,sam.{token}@example.com\n"
        f"Ende,Eva,eva.{token}@example.com,50\n",
    )

    assert response.status_code == 200
    report = response.json()
    assert report["imported_count"] == 2
    assert report["failed_count"] == 5
    assert report["errors"] == [
        {"line": 3, "message": "age must be a whole number between 1 and 150"},
        {"line": 4, "message": "age must be a whole number between 1 and 150"},
        {"line": 5, "message": "lastname is required"},
        {"line": 6, "message": "email is not a valid email address"},
        {"line": 7, "message": "Unreadable row: expected 4 columns, found 3"},
    ]
    assert [e[1] for e in stored(session, token)] == ["Eva", "Max"]


def test_row_with_several_problems_reports_all_of_them(client: TestClient):
    response = upload(client, "lastname,firstname,email,age\n,,nobody,-1\n")

    assert response.json()["errors"] == [
        {
            "line": 2,
            "message": (
                "lastname is required; firstname is required; "
                "email is not a valid email address; "
                "age must be a whole number between 1 and 150"
            ),
        }
    ]


def test_duplicate_email_in_file_keeps_first_occurrence(
    client: TestClient, session: Session, token: str
):
    response = upload(
        client,
        "lastname,firstname,email,age\n"
        f"Muster,Max,max.{token}@example.com,30\n"
        f"Other,Otto,MAX.{token}@example.com,40\n",
    )

    report = response.json()
    assert report["imported_count"] == 1
    assert report["errors"] == [
        {
            "line": 3,
            "message": (
                f"Duplicate email max.{token}@example.com: already used in line 2"
            ),
        }
    ]
    assert stored(session, token) == [("Muster", "Max", f"max.{token}@example.com", 30)]


def test_soft_deleted_employee_is_neither_updated_nor_reactivated(
    client: TestClient, session: Session, token: str
):
    employee = Employee(
        firstname="Gone",
        lastname="Muster",
        email=f"gone.{token}@example.com",
        age=30,
        deleted_at=datetime.now(UTC),
    )
    session.add(employee)
    session.flush()

    response = upload(
        client,
        f"lastname,firstname,email,age\nNew,Name,gone.{token}@example.com,44\n",
    )

    assert response.status_code == 200
    report = response.json()
    assert report["imported"] == []
    assert report["errors"] == [
        {
            "line": 2,
            "message": (
                f"Employee gone.{token}@example.com was deleted and is not reactivated"
            ),
        }
    ]
    session.refresh(employee)
    assert employee.firstname == "Gone"
    assert employee.deleted_at is not None


def test_line_numbers_count_blank_lines_and_multiline_fields(
    client: TestClient, token: str
):
    response = upload(
        client,
        "lastname,firstname,email,age,address\n"
        "\n"
        f'Muster,Max,max.{token}@example.com,30,"Main Street 1\nMunich"\n'
        "Bad,Row,nobody,30,\n",
    )

    report = response.json()
    assert report["imported_count"] == 1
    assert [error["line"] for error in report["errors"]] == [5]


def test_header_without_data_rows_returns_empty_report(client: TestClient):
    response = upload(client, "lastname,firstname,email,age\n")

    assert response.status_code == 200
    assert response.json() == {
        "imported_count": 0,
        "failed_count": 0,
        "imported": [],
        "errors": [],
    }


@pytest.mark.parametrize(
    ("content", "detail"),
    [
        (b"", "File is empty"),
        (b"\n  \n", "File is empty"),
        (
            b"lastname,firstname,age\nMuster,Max,30\n",
            "Missing required columns: email",
        ),
        (
            b"name;mail\nMax;max@example.com\n",
            "Missing required columns: lastname, firstname, email, age",
        ),
        ("lastname,firstname,email,age\n".encode("utf-16"), "File is not UTF-8"),
        (b"PK\x03\x04\x00\x00\x00", "File is not a text file"),
    ],
)
def test_unusable_file_is_rejected_as_a_whole(
    client: TestClient, content: bytes, detail: str
):
    response = upload(client, content)

    assert response.status_code == 400
    assert response.json()["detail"].startswith(detail)


def test_rejected_file_imports_nothing(
    client: TestClient, session: Session, token: str
):
    response = upload(
        client, f"lastname,firstname,email\nMuster,Max,max.{token}@x.io\n"
    )

    assert response.status_code == 400
    assert stored(session, token) == []


def test_request_without_file_is_a_client_error(client: TestClient):
    response = client.post("/employees/import")

    assert response.status_code == 422
