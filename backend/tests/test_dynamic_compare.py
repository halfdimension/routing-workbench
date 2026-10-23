from __future__ import annotations

import httpx
import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app import routes
from app import config
from app.engines import EngineCallResult
from app.main import app
from app.models import EngineError
from app.models import CompareRequest

BODY = {
    "start": {"lat": 28.5758348008, "lon": 77.2203734667},
    "dest": {"lat": 28.6258850168, "lon": 77.1711418469},
}


def _encode_polyline6(coords_lonlat: list[list[float]]) -> str:
    def encode_value(delta: int) -> str:
        value = ~(delta << 1) if delta < 0 else delta << 1
        chunks: list[str] = []
        while value >= 0x20:
            chunks.append(chr((0x20 | (value & 0x1F)) + 63))
            value >>= 5
        chunks.append(chr(value + 63))
        return "".join(chunks)

    previous_lat = previous_lon = 0
    encoded: list[str] = []
    for lon, lat in coords_lonlat:
        current_lat = round(lat * 1e6)
        current_lon = round(lon * 1e6)
        encoded.append(encode_value(current_lat - previous_lat))
        encoded.append(encode_value(current_lon - previous_lon))
        previous_lat, previous_lon = current_lat, current_lon
    return "".join(encoded)


async def compare(payload: dict[str, object]) -> dict[str, object]:
    response = await routes.compare(CompareRequest.model_validate(payload))
    return response.model_dump(by_alias=True, exclude_unset=True)


async def post_compare(payload: dict[str, object]) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/api/compare", json=payload)


def osrm_result(duration: float) -> EngineCallResult:
    response = httpx.Response(200, json={
        "code": "Ok",
        "routes": [{
            "geometry": _encode_polyline6([[77.22, 28.57], [77.17, 28.62]]),
            "distance": 10022.9,
            "duration": duration,
            "weight": duration,
            "legs": [{
                "annotation": {
                    "distance": [10022.9],
                    "duration": [duration],
                    "weight": [duration],
                    "speed": [5.1],
                    "datasources": [0],
                    "nodes": [101, 202],
                    "metadata": {"datasource_names": ["lua profile"]},
                }
            }],
        }],
    })
    return EngineCallResult(ok=True, response=response, http_status=200, duration_ms=2, error=None)


def valhalla_result(duration: float = 900) -> EngineCallResult:
    response = httpx.Response(200, json={
        "trip": {
            "legs": [{"shape": _encode_polyline6([[77.22, 28.57], [77.17, 28.62]])}],
            "summary": {"length": 10.0, "time": duration, "cost": duration},
        }
    })
    return EngineCallResult(ok=True, response=response, http_status=200, duration_ms=3, error=None)


async def test_legacy_default_compare_remains_osrm_5000_vs_valhalla_8002(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[tuple[str, str]] = []

    async def fake(method: str, url: str, **kwargs: object) -> EngineCallResult:
        seen.append((method, url))
        return osrm_result(1984.0) if method == "GET" else valhalla_result()

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare(BODY)
    assert set(data) >= {"osrm", "valhalla", "routingTarget"}
    assert data["osrm"]["normalizedRoutes"][0]["id"] == "osrm:0"
    assert data["valhalla"]["normalizedRoutes"][0]["id"] == "valhalla:0"
    assert ":5000/route/v1/" in seen[0][1]
    assert seen[1][1] == "http://localhost:8002/route"


async def test_osrm_vs_osrm_uses_selected_ports_and_slot_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[tuple[str, set[str]]] = []

    async def fake(method: str, url: str, **kwargs: object) -> EngineCallResult:
        seen.append((url, kwargs["allowed_hosts"]))
        return osrm_result(1984.0 if ":5000/" in url else 1395.3)

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare({
        **BODY,
        "engineA": {"type": "osrm", "port": 5000, "label": "Original"},
        "engineB": {"type": "osrm", "port": 5010, "label": "Traffic"},
    })
    assert [item[0].split("/route/")[0] for item in seen] == [
        "http://localhost:5000", "http://localhost:5010"
    ]
    assert seen[0][1] == {"localhost:5000"}
    assert seen[1][1] == {"localhost:5010"}
    assert data["engineA"]["normalizedRoutes"][0]["id"] == "a:osrm:0"
    assert data["engineB"]["normalizedRoutes"][0]["id"] == "b:osrm:0"
    delta = (
        data["engineB"]["normalizedRoutes"][0]["durationSeconds"]
        - data["engineA"]["normalizedRoutes"][0]["durationSeconds"]
    )
    assert delta == pytest.approx(-588.7)


@pytest.mark.parametrize("port", [0, 65536, -1])
def test_dynamic_compare_rejects_invalid_ports(port: int) -> None:
    with pytest.raises(ValidationError):
        CompareRequest.model_validate({
            **BODY,
            "engineA": {"type": "osrm", "port": port},
            "engineB": {"type": "valhalla", "port": 8002},
        })


async def test_http_contract_rejects_invalid_port() -> None:
    response = await post_compare({
        **BODY,
        "engineA": {"type": "osrm", "port": 0},
        "engineB": {"type": "valhalla", "port": 8002},
    })
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [("host", "example.com"), ("url", "http://example.com/route")],
)
async def test_http_contract_rejects_caller_supplied_network_targets(
    field: str,
    value: str,
) -> None:
    response = await post_compare({
        **BODY,
        "engineA": {"type": "osrm", "port": 5000, field: value},
        "engineB": {"type": "valhalla", "port": 8002},
    })
    assert response.status_code == 422


async def test_http_contract_returns_role_keyed_dynamic_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake(method: str, url: str, **kwargs: object) -> EngineCallResult:
        return osrm_result(1984.0 if ":5000/" in url else 1395.3)

    monkeypatch.setattr(routes, "call_engine", fake)
    response = await post_compare({
        **BODY,
        "engineA": {"type": "osrm", "port": 5000},
        "engineB": {"type": "osrm", "port": 5010},
    })
    assert response.status_code == 200
    assert set(response.json()) >= {"engineA", "engineB", "routingTarget"}


async def test_same_engine_debug_payload_is_role_keyed_and_collision_free(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake(method: str, url: str, **kwargs: object) -> EngineCallResult:
        return osrm_result(1984.0 if ":5000/" in url else 1395.3)

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare({
        **BODY,
        "includeDebug": True,
        "engineA": {"type": "osrm", "port": 5000},
        "engineB": {"type": "osrm", "port": 5010},
    })
    assert data["debug"]["engineA"]["slot"] == "a"
    assert data["debug"]["engineB"]["slot"] == "b"
    assert data["debug"]["engineA"]["segments"][0]["id"].startswith("a:osrm:")
    assert data["debug"]["engineB"]["segments"][0]["id"].startswith("b:osrm:")


async def test_identical_selections_are_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake(*args: object, **kwargs: object) -> EngineCallResult:
        return osrm_result(100)

    monkeypatch.setattr(routes, "call_engine", fake)
    spec = {"type": "osrm", "port": 5000, "label": "Same"}
    data = await compare({**BODY, "engineA": spec, "engineB": spec})
    assert data["engineA"]["status"] == "ok"
    assert data["engineB"]["status"] == "ok"


async def test_valhalla_vs_valhalla_and_no_alternatives(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake(*args: object, **kwargs: object) -> EngineCallResult:
        return valhalla_result()

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare({
        **BODY,
        "engineA": {"type": "valhalla", "port": 8002},
        "engineB": {"type": "valhalla", "port": 8003},
    })
    assert len(data["engineA"]["normalizedRoutes"]) == 1
    assert len(data["engineB"]["normalizedRoutes"]) == 1
    assert data["engineA"]["normalizedRoutes"][0]["id"] == "a:valhalla:0"
    assert data["engineB"]["normalizedRoutes"][0]["id"] == "b:valhalla:0"


async def test_partial_success_keeps_available_slot(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake(method: str, url: str, **kwargs: object) -> EngineCallResult:
        if ":59999/" in url:
            return EngineCallResult(
                ok=False, response=None, http_status=None, duration_ms=0,
                error=EngineError(kind="unreachable", message="Connection refused"),
            )
        return valhalla_result()

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare({
        **BODY,
        "engineA": {"type": "valhalla", "port": 8002},
        "engineB": {"type": "osrm", "port": 59999},
    })
    assert data["engineA"]["status"] == "ok"
    assert data["engineB"]["status"] == "error"
    assert data["engineB"]["error"]["kind"] == "unreachable"


async def test_wrong_engine_type_is_an_invalid_response(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake(*args: object, **kwargs: object) -> EngineCallResult:
        response = httpx.Response(200, json={"trip": {"legs": [], "summary": {}}})
        return EngineCallResult(ok=True, response=response, http_status=200, duration_ms=1, error=None)

    monkeypatch.setattr(routes, "call_engine", fake)
    data = await compare({
        **BODY,
        "engineA": {"type": "osrm", "port": 8002},
        "engineB": {"type": "osrm", "port": 8002},
    })
    assert data["engineA"]["error"]["kind"] == "invalid_response"


async def test_optional_deployment_port_allowlist_is_enforced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(config, "DYNAMIC_ENGINE_PORT_ALLOWLIST", frozenset({5000, 8002}))
    request = CompareRequest.model_validate({
        **BODY,
        "engineA": {"type": "osrm", "port": 5010},
        "engineB": {"type": "valhalla", "port": 8002},
    })
    with pytest.raises(HTTPException) as raised:
        await routes.compare(request)
    assert getattr(raised.value, "status_code", None) == 403

