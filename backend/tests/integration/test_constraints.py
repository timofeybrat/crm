from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError


def company(db, number):
    return db(
        "INSERT INTO companies (name, bin, phone) VALUES ('Demo', :bin, '00000') RETURNING id",
        {"bin": f"{number:012d}"},
    )[0]["id"]


def meeting(db, company_id, manager_id=1, starts="2026-11-23 05:00:00+00", minutes=60):
    return db(
        "INSERT INTO meetings (company_id, manager_id, starts_at, ends_at, original_starts_at) "
        "VALUES (:company, :manager, CAST(:start AS timestamptz), "
        "CAST(:start AS timestamptz) + :minutes * interval '1 minute', "
        "CAST(:start AS timestamptz)) RETURNING id",
        {
            "company": company_id,
            "manager": manager_id,
            "start": datetime.fromisoformat(starts),
            "minutes": minutes,
        },
    )[0]["id"]


def test_database_rejects_duplicate_bin(db):
    company(db, 1)
    with pytest.raises(IntegrityError):
        company(db, 1)


def test_database_rejects_overlapping_manager_meetings(db):
    meeting(db, company(db, 1))
    with pytest.raises(IntegrityError):
        meeting(db, company(db, 2), starts="2026-11-23 05:30:00+00")


def test_database_allows_adjacent_meetings(db):
    meeting(db, company(db, 1))
    meeting(db, company(db, 2), starts="2026-11-23 06:00:00+00")


def test_database_rejects_second_active_company_meeting(db):
    company_id = company(db, 1)
    meeting(db, company_id)
    with pytest.raises(IntegrityError):
        meeting(db, company_id, manager_id=2, starts="2026-11-24 06:00:00+00")


def test_database_rejects_non_hour_duration(db):
    with pytest.raises(IntegrityError):
        meeting(db, company(db, 1), minutes=30)
