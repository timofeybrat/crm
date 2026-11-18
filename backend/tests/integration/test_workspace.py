from test_meetings import create_company, create_meeting


def test_search_is_paginated_and_matches_literal_text(client):
    client.post("/companies", json={"name": "Demo 100%", "bin": "000000000001", "phone": "00000"})
    client.post("/companies", json={"name": "Other", "bin": "000000000002", "phone": "12345"})
    assert client.get("/companies?search=demo").json()["total"] == 1
    assert client.get("/companies?search=12345").json()["total"] == 1
    assert client.get("/companies?search=000000000002").json()["total"] == 1
    assert client.get("/companies", params={"search": "%"}).json()["total"] == 1
    assert client.get("/companies?search=demo&status=refused").json()["total"] == 0


def test_company_workspace_exposes_calls_and_meetings(client):
    company = create_company(client)
    meeting = create_meeting(client, company).json()
    client.post("/calls", json={"company_id": company, "result": "no_answer"})
    data = client.get(f"/companies/{company}").json()
    assert data["active_meeting"]["id"] == meeting["id"]
    assert data["recent_calls"][0]["result"] == "no_answer"
    client.patch(f"/meetings/{meeting['id']}", json={"action": "cancel"})
    data = client.get(f"/companies/{company}").json()
    assert data["active_meeting"] is None
    assert data["recent_meetings"][0]["status"] == "cancelled"
    assert client.get("/companies/99999").status_code == 404


def test_schedule_exposes_company_name(client):
    create_meeting(client, create_company(client))
    data = client.get("/managers/1/schedule?date=2026-11-23").json()
    assert data["meetings"][0]["company_name"] == "Demo"
