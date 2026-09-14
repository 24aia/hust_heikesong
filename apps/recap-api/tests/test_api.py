from __future__ import annotations

import time

from fastapi.testclient import TestClient

from app.main import create_app
from app.providers.mock import MockProvider


def test_health_does_not_call_model(settings):
    app = create_app(settings, MockProvider(settings.summary_version))
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        capabilities = client.get("/api/v1/capabilities").json()
        assert capabilities["inputLimitCodePoints"] == 20_000


def test_job_lifecycle_and_token_isolation(settings, recap_input):
    app = create_app(settings, MockProvider(settings.summary_version))
    with TestClient(app) as client:
        created_response = client.post(
            "/api/v1/recap-jobs", json=recap_input.model_dump(by_alias=True, mode="json")
        )
        assert created_response.status_code == 202
        created = created_response.json()
        assert "jobAccessToken" in created

        assert client.get(f"/api/v1/recap-jobs/{created['jobId']}").status_code == 404
        assert (
            client.get(
                f"/api/v1/recap-jobs/{created['jobId']}",
                headers={"Authorization": "Bearer wrong-token"},
            ).status_code
            == 404
        )

        view = None
        for _ in range(40):
            response = client.get(
                f"/api/v1/recap-jobs/{created['jobId']}",
                headers={"Authorization": f"Bearer {created['jobAccessToken']}"},
            )
            view = response.json()
            if view["status"] == "succeeded":
                break
            time.sleep(0.01)
        assert view is not None
        assert view["status"] == "succeeded"
        assert view["result"]["inputHash"] == recap_input.input_hash
        assert view["result"]["items"][0]["evidence"][0]["quote"] in recap_input.paragraphs[0].text


def test_rejects_forged_hash(settings, recap_input):
    forged = recap_input.model_copy(update={"input_hash": "f" * 64})
    app = create_app(settings, MockProvider(settings.summary_version))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recap-jobs", json=forged.model_dump(by_alias=True, mode="json")
        )
    assert response.status_code == 422
    assert response.json()["code"] == "MODEL_OUTPUT_INVALID"


def test_beginning_has_no_summary(settings, recap_input):
    empty = recap_input.model_copy(update={"paragraphs": []})
    from app.hashing import compute_input_hash

    empty = empty.model_copy(update={"input_hash": compute_input_hash(empty)})
    app = create_app(settings, MockProvider(settings.summary_version))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recap-jobs", json=empty.model_dump(by_alias=True, mode="json")
        )
    assert response.status_code == 422
    assert response.json()["code"] == "INPUT_INSUFFICIENT"


def test_invalid_request_does_not_echo_source_text(settings):
    app = create_app(settings, MockProvider(settings.summary_version))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recap-jobs",
            json={"schemaVersion": 1, "privateText": "must-not-be-reflected"},
        )
    assert response.status_code == 422
    assert "must-not-be-reflected" not in response.text
