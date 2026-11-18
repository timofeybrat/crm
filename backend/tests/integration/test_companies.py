import pytest


def create_company(client, number=1, **changes):
    return client.post(
        "/companies",
        json={
            "name": "Demo company",
            "bin": f"{number:012d}",
            "phone": "+70000000000",
            **changes,
        },
    )


def test_company_create_duplicate_and_page(client):
    created = create_company(client)
    assert created.status_code == 201
    assert created.json()["status"] == "new"
    assert create_company(client).status_code == 409
    second = create_company(client, 2).json()
    page = client.get("/companies", params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 2
    assert [item["id"] for item in page["items"]] == [second["id"]]
    assert client.get("/companies?status=refused").json()["items"] == []


@pytest.mark.parametrize("changes", [{"name": "   "}, {"bin": "abc"}, {"phone": "1"}])
def test_invalid_company_input(client, changes):
    assert create_company(client, **changes).status_code == 422


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1", "status=invalid"])
def test_invalid_company_filters(client, query):
    assert client.get(f"/companies?{query}").status_code == 422
