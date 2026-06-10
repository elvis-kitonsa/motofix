import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from groq import AsyncGroq
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

load_dotenv()

import httpx
from math import radians, cos, sin, asin, sqrt
from .diagnosis import chat_diagnose, chat_with_image, diagnose_image, diagnose_text, fuel_advisor, guided_diagnose, price_spare_parts
from .schemas import (
    ChatMessage, ChatRequest, ChatResponse, DiagnosisResult, TextDiagnosisRequest,
    FuelAdvisorRequest, NearbyStationsRequest, GuidedDiagnoseRequest,
    PartPriceRequest, PartPriceResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "change_me_in_production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

groq_client: Optional[AsyncGroq] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global groq_client
    if GROQ_API_KEY:
        groq_client = AsyncGroq(api_key=GROQ_API_KEY)
        logger.info("Fault diagnosis service: Groq client ready")
    else:
        logger.warning("GROQ_API_KEY not set — /diagnose and /chat will return fallback responses")

    yield
    logger.info("Fault diagnosis service: shutdown")


app = FastAPI(
    title="MOTOFIX - Fault Diagnosis and Classification Service",
    description=(
        "Classifies driver fault descriptions and uploaded images using NLP and computer vision "
        "via the OpenAI and Google Vision APIs. Powers the AI diagnostic chatbot that guides "
        "drivers through describing their fault before a request is submitted, and determines "
        "the appropriate provider type: mechanic, towing provider, or spare parts dealer."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_ALLOWED_ORIGINS = [
    "https://customer.motofix.org",
    "https://admin.motofix.org",
    "https://motofix.org",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:8086",
    "http://localhost:8087",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8083",
    "http://127.0.0.1:8084",
    "http://192.168.1.3:8080",
    "http://192.168.1.3:5173",
    "http://192.168.1.3:3000",
    "http://192.168.1.3:8083",
    "http://192.168.1.3:8084",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)


# ── Auth ──────────────────────────────────────────────────────────────────────

def _require_token(authorization: str = Header(...)) -> dict:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    return {
        "status": "ok",
        "service": "fault-diagnosis",
        "groq_configured": groq_client is not None,
    }


@app.post("/diagnose", response_model=DiagnosisResult, tags=["diagnosis"])
async def diagnose(
    body: TextDiagnosisRequest,
    _user: dict = Depends(_require_token),
):
    """
    Classify a plain-text fault description.

    Returns a structured diagnosis including fault category, recommended provider
    type (mechanic / towing provider / spare parts dealer), severity, and
    immediate actions the driver should take.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured on this server")
    return await diagnose_text(body.description, groq_client)


@app.post("/diagnose/guided", tags=["diagnosis"])
async def diagnose_guided(body: GuidedDiagnoseRequest):
    """
    Step-by-step guided triage for drivers who don't know what's wrong.

    Send the questions asked and answers given so far. Returns either the next
    question (with quick-pick options) or, once enough is known, a final diagnosis.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="AI service not configured")
    try:
        answers = [a.model_dump() for a in body.answers]
        return await guided_diagnose(answers, groq_client)
    except json.JSONDecodeError as exc:
        logger.error("Guided diagnose — AI returned invalid JSON: %s", exc)
        raise HTTPException(status_code=500, detail="AI returned an unreadable response. Please try again.")
    except Exception as exc:
        logger.error("Guided diagnose error: %s", exc)
        raise HTTPException(status_code=500, detail="AI diagnosis failed. Please try again.")


@app.post("/diagnose/image", response_model=DiagnosisResult, tags=["diagnosis"])
async def diagnose_image_endpoint(
    file: UploadFile = File(..., description="JPEG or PNG image of the vehicle fault"),
    _user: dict = Depends(_require_token),
):
    """
    Classify a fault from an uploaded vehicle image using Groq vision AI.

    The image is sent directly to llama-3.2-11b-vision-preview which reads and
    describes the fault, then llama-3.3-70b-versatile produces a structured diagnosis.
    Accepts JPEG and PNG images up to 10 MB.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="Groq API key not configured on this server")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image files are supported")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large — maximum size is 10 MB")

    return await diagnose_image(image_bytes, content_type, groq_client)


@app.post("/chat/image", response_model=ChatResponse, tags=["chatbot"])
async def chat_image(
    file: UploadFile = File(...),
    messages: str = Form(default="[]"),
    user_text: str = Form(default=""),
    _user: dict = Depends(_require_token),
):
    """
    Image-aware chat turn. The vision model reads the uploaded photo, then the
    chatbot describes what it sees and asks follow-up questions. Returns a
    ChatResponse so it slots into the same chat flow as /chat.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="Groq API key not configured on this server")

    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image files are supported")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large — maximum size is 10 MB")

    try:
        prior = [ChatMessage(**m) for m in json.loads(messages)]
    except Exception:
        prior = []

    return await chat_with_image(image_bytes, content_type, prior, user_text.strip(), groq_client)


@app.post("/chat", response_model=ChatResponse, tags=["chatbot"])
async def chat(
    body: ChatRequest,
    _user: dict = Depends(_require_token),
):
    """
    One turn of the interactive AI diagnostic chatbot.

    The client sends the full conversation history (all previous messages plus
    the driver's latest message). The service returns the assistant's reply and,
    once enough information has been gathered, sets diagnosis_ready=true and
    includes the final DiagnosisResult.

    The client is responsible for storing conversation history between turns.
    """
    if not groq_client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured on this server")
    return await chat_diagnose(body.messages, groq_client)


# ── MOTOBOT — spare-parts pricing ──────────────────────────────────────────────

@app.post("/parts-price", response_model=PartPriceResponse, tags=["spare-parts"])
async def spare_parts_price(
    body: PartPriceRequest,
    _user: dict = Depends(_require_token),
):
    """MOTOBOT: return UGX price ranges for the spare parts a driver wants to buy."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="AI service not configured")
    items = [i for i in body.items if i and i.strip()]
    if not items:
        raise HTTPException(status_code=422, detail="No items provided")
    try:
        return await price_spare_parts(items, groq_client)
    except json.JSONDecodeError as exc:
        logger.error("MOTOBOT pricing — invalid JSON: %s", exc)
        raise HTTPException(status_code=500, detail="AI returned an unreadable response. Please try again.")
    except Exception as exc:
        logger.error("MOTOBOT pricing failed: %s", exc)
        raise HTTPException(status_code=500, detail="Pricing failed. Please try again.")


# ── Fuel Advisor ──────────────────────────────────────────────────────────────

@app.post("/fuel-advisor", tags=["fuel"])
async def fuel_advisor_endpoint(
    body: FuelAdvisorRequest,
):
    """AI fuel-engine compatibility check + Uganda pump price estimates."""
    if not groq_client:
        raise HTTPException(status_code=503, detail="AI service not configured")
    try:
        result = await fuel_advisor(body.car_model, body.fuel_type, groq_client)
        return result
    except json.JSONDecodeError as exc:
        logger.error("Fuel advisor — AI returned invalid JSON: %s", exc)
        raise HTTPException(status_code=500, detail="AI returned an unreadable response. Please try again.")
    except Exception as exc:
        logger.error("Fuel advisor error: %s", exc)
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return R * 2 * asin(sqrt(a))


# Public Overpass (OpenStreetMap) mirrors — free, no API key, no billing.
_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Some mirrors reject requests without a descriptive User-Agent (HTTP 406).
_OVERPASS_HEADERS = {"User-Agent": "MOTOFIX-RoadsideAssistance/1.0 (fuel-finder)"}

# Bundled real OpenStreetMap snapshot of Ugandan fuel stations — used when the
# live Overpass API is slow/unreachable so the demo still shows REAL stations.
_BUNDLED_STATIONS: list = []
try:
    _bundle_path = os.path.join(os.path.dirname(__file__), "ug_fuel_stations.json")
    with open(_bundle_path, encoding="utf-8") as _bf:
        _BUNDLED_STATIONS = json.load(_bf)
    logger.info("Loaded %d bundled OSM fuel stations", len(_BUNDLED_STATIONS))
except Exception as _exc:  # pragma: no cover
    logger.warning("Could not load bundled fuel stations: %s", _exc)


def _mk_station(body, oid, name, brand, vicinity, lat2, lng2, opening_hours):
    dist = _haversine_km(body.lat, body.lng, lat2, lng2)
    return {
        "place_id": oid,
        "name": name,
        "brand": brand or "",
        "vicinity": vicinity or "Uganda",
        "lat": lat2,
        "lng": lng2,
        "rating": None,
        "user_ratings_total": None,
        "open_now": True if opening_hours == "24/7" else None,
        "opening_hours": opening_hours or None,
        "distance_km": round(dist, 2),
        "maps_url": f"https://www.google.com/maps/search/?api=1&query={lat2},{lng2}",
        "directions_url": (
            f"https://www.google.com/maps/dir/?api=1"
            f"&origin={body.lat},{body.lng}"
            f"&destination={lat2},{lng2}"
            f"&travelmode=driving"
        ),
    }


async def _overpass_fuel(lat: float, lng: float, radius_m: int) -> list:
    """Query OpenStreetMap for amenity=fuel within radius_m metres of (lat,lng)."""
    query = (
        "[out:json][timeout:15];"
        "("
        f'node["amenity"="fuel"](around:{radius_m},{lat},{lng});'
        f'way["amenity"="fuel"](around:{radius_m},{lat},{lng});'
        ");"
        "out center tags;"
    )
    async with httpx.AsyncClient(timeout=5, headers=_OVERPASS_HEADERS) as client:
        for url in _OVERPASS_URLS:
            try:
                resp = await client.post(url, data={"data": query})
                if resp.status_code == 200:
                    return resp.json().get("elements", [])
                logger.warning("Overpass %s -> %s", url, resp.status_code)
            except Exception as exc:
                logger.warning("Overpass %s failed: %s", url, exc)
    return []


def _build_from_elements(body, elements: list) -> list:
    named = [e for e in elements if (e.get("tags") or {}).get("name") or (e.get("tags") or {}).get("brand")]
    elements = named or elements
    stations = []
    seen = set()
    for el in elements:
        tags = el.get("tags") or {}
        if el.get("type") == "node":
            lat2, lng2 = el.get("lat"), el.get("lon")
        else:
            center = el.get("center") or {}
            lat2, lng2 = center.get("lat"), center.get("lon")
        if lat2 is None or lng2 is None:
            continue
        oid = f"{el.get('type')}/{el.get('id')}"
        if oid in seen:
            continue
        seen.add(oid)
        name = tags.get("name") or tags.get("brand") or tags.get("operator") or "Fuel Station"
        brand = tags.get("brand") or tags.get("operator") or ""
        addr_parts = [
            tags.get("addr:street"),
            tags.get("addr:suburb") or tags.get("addr:city") or tags.get("addr:place"),
        ]
        vicinity = ", ".join([p for p in addr_parts if p]) or tags.get("addr:full") or "Uganda"
        stations.append(_mk_station(body, oid, name, brand, vicinity, lat2, lng2, tags.get("opening_hours")))
    return stations


def _build_bundled_near(body) -> list:
    if not _BUNDLED_STATIONS:
        return []
    scored = [(_haversine_km(body.lat, body.lng, r["lat"], r["lng"]), r) for r in _BUNDLED_STATIONS]
    near = [x for x in scored if x[0] <= 30]
    near = near or sorted(scored, key=lambda x: x[0])[:12]
    return [
        _mk_station(body, rec["id"], rec["name"], rec.get("brand", ""),
                    rec.get("vicinity", "") or "Uganda", rec["lat"], rec["lng"], rec.get("opening_hours"))
        for _d, rec in near
    ]


@app.post("/fuel-advisor/stations", tags=["fuel"])
async def nearby_stations_endpoint(
    body: NearbyStationsRequest,
):
    """Real nearby fuel stations from OpenStreetMap.

    Tries the live Overpass API (tightly time-boxed so the request stays snappy);
    if it is slow / unreachable we serve the bundled real OSM snapshot. Either
    way the results are real stations — never empty, never a long hang.
    """
    elements: list = []
    try:
        elements = await asyncio.wait_for(_overpass_fuel(body.lat, body.lng, 15000), timeout=4)
    except asyncio.TimeoutError:
        logger.info("Overpass slow — falling back to bundled OSM snapshot")

    live = _build_from_elements(body, elements)
    # Prefer live when it returned a healthy set; otherwise the comprehensive snapshot.
    stations = live if len(live) >= 4 else (_build_bundled_near(body) or live)

    stations.sort(key=lambda s: s["distance_km"])
    return {"stations": stations[:12]}
