"""
Weighted mechanic scoring algorithm.

Weights (must sum to 1.0):
  Proximity       40%  — closer mechanics are strongly preferred
  Specialisation  25%  — right skill for the fault type
  Rating          20%  — quality signal from past driver reviews
  Performance     15%  — reliability: completion rate vs. declines/expirations
"""

import math
from typing import Any, Dict, List, Optional

# ── Weights ───────────────────────────────────────────────────────────────────
WEIGHT_PROXIMITY = 0.40
WEIGHT_SPECIALISATION = 0.25
WEIGHT_RATING = 0.20
WEIGHT_PERFORMANCE = 0.15

# Hard cutoff — mechanics beyond this distance are not considered
MAX_DISTANCE_KM = 50.0

# ── Capability matching ────────────────────────────────────────────────────────
# A request needs a specific capability; breakdown needs BOTH (the provider can
# either fix it on-site OR tow it if it can't be fixed).
_TOW_TERMS = {"tow", "towing", "recovery", "flatbed", "winch", "haul", "wrecker"}
_MECH_TERMS = {
    "mechanic", "mechanical", "repair", "engine", "electrical", "tyre", "tire",
    "battery", "brake", "suspension", "service", "diagnos", "fuel", "transmission",
}


def _capabilities(mechanic: Dict[str, Any]) -> tuple[bool, bool]:
    """Return (can_mechanic, can_tow) from provider_type, with a specialisations fallback."""
    pt = str(mechanic.get("provider_type") or "").strip().lower()
    specs = " ".join(mechanic.get("specialisations") or []).lower() + " " + str(mechanic.get("specialty") or "").lower()
    spec_tow = any(t in specs for t in _TOW_TERMS)
    spec_mech = any(t in specs for t in _MECH_TERMS)
    if pt == "both":
        return True, True
    if pt in ("towing_provider", "towing", "tow"):
        return spec_mech, True
    if pt == "mechanic":
        return True, spec_tow
    # Unknown provider_type → infer purely from what they list (generalist = mechanic)
    return (spec_mech or not spec_tow), spec_tow


def _capability_tier(mechanic: Dict[str, Any], service_type: str) -> int:
    """How well this provider fits the request: 2 = ideal, 1 = eligible, 0 = not.

    Breakdown Rescue ("car won't move"): the provider must be able to TOW it (so an
    unfixable car can still be moved); a 'both' provider is IDEAL because they can
    also try to fix it on-site first. Mechanic-only is ineligible — they can't move
    a dead car. Mechanic & Repair just needs mechanical capability.
    """
    st = (service_type or "").lower()
    can_mech, can_tow = _capabilities(mechanic)
    if "breakdown" in st:
        if can_mech and can_tow:
            return 2          # fix-or-tow → ideal
        if can_tow:
            return 1          # tow-only → can still move the car
        return 0              # mechanic-only can't move an immovable car
    if "towing_provider" in st or any(t in st for t in ("tow", "recovery", "winch", "flatbed")):
        return 1 if can_tow else 0
    return 1 if can_mech else 0

# ── Individual scorers ────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in km between two lat/lon points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _proximity_score(distance_km: float) -> float:
    """Linear decay: 100 at 0 km → 0 at MAX_DISTANCE_KM."""
    if distance_km >= MAX_DISTANCE_KM:
        return 0.0
    return (1.0 - distance_km / MAX_DISTANCE_KM) * 100.0


def _specialisation_score(mechanic_specialisations: List[str], service_type: str) -> float:
    """
    100 — exact / direct keyword match
     50 — partial overlap with generic vehicle/fault terms
     30 — generalist (no specialisations listed)
      0 — no relevant match
    """
    if not mechanic_specialisations:
        return 30.0  # generalist — slight credit over a clear mismatch

    normalised_st = service_type.lower()
    for spec in mechanic_specialisations:
        spec_lower = spec.lower()
        if normalised_st in spec_lower or spec_lower in normalised_st:
            return 100.0

    # Partial match via generic automotive terms
    generic_terms = {
        "vehicle", "car", "motorcycle", "motorbike", "boda",
        "engine", "electrical", "tyre", "tire", "towing", "brake",
        "suspension", "transmission", "fuel", "battery",
    }
    st_words = set(normalised_st.split())
    for spec in mechanic_specialisations:
        spec_words = set(spec.lower().split())
        if st_words & spec_words & generic_terms:
            return 50.0

    return 0.0


def _rating_score(avg_rating: float, rating_count: int) -> float:
    """
    Scale 0–5 stars to 0–100, with a Bayesian confidence damper.
    New mechanics with no reviews get a neutral 50.
    """
    if rating_count == 0:
        return 50.0
    raw = (avg_rating / 5.0) * 100.0
    # Blend with neutral 50 when count is low (full confidence at 20+ reviews)
    confidence = min(1.0, rating_count / 20.0)
    return confidence * raw + (1.0 - confidence) * 50.0


def _performance_score(jobs_completed: int, jobs_declined: int, jobs_expired: int) -> float:
    """
    Completion rate as a percentage.
    New mechanics with no job history get a neutral 50.
    """
    total = jobs_completed + jobs_declined + jobs_expired
    if total == 0:
        return 50.0
    return (jobs_completed / total) * 100.0


# ── Composite scorer ──────────────────────────────────────────────────────────

def score_mechanic(
    mechanic: Dict[str, Any],
    request_lat: float,
    request_lon: float,
    service_type: str,
    excluded_ids: Optional[List[int]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Score a single mechanic against a breakdown request.
    Returns None if the mechanic is ineligible (excluded, unverified, too far).
    """
    if excluded_ids and mechanic.get("id") in excluded_ids:
        return None

    if not mechanic.get("is_verified"):
        return None

    # Accept both explicit is_available flag (if present) and absence of it
    if mechanic.get("is_available") is False:
        return None

    m_lat = mechanic.get("latitude")
    m_lon = mechanic.get("longitude")

    if m_lat is None or m_lon is None:
        distance_km = MAX_DISTANCE_KM  # treat missing location as max distance
    else:
        distance_km = haversine_km(request_lat, request_lon, float(m_lat), float(m_lon))

    if distance_km >= MAX_DISTANCE_KM:
        return None

    prox = _proximity_score(distance_km)
    spec = _specialisation_score(mechanic.get("specialisations") or [], service_type)
    rat = _rating_score(
        float(mechanic.get("avg_rating") or 0),
        int(mechanic.get("rating_count") or 0),
    )
    perf = _performance_score(
        int(mechanic.get("jobs_completed") or 0),
        int(mechanic.get("jobs_declined") or 0),
        int(mechanic.get("jobs_expired") or 0),
    )

    total = (
        prox * WEIGHT_PROXIMITY
        + spec * WEIGHT_SPECIALISATION
        + rat * WEIGHT_RATING
        + perf * WEIGHT_PERFORMANCE
    )

    return {
        "mechanic_id": mechanic["id"],
        "mechanic_name": (
            mechanic.get("full_name")
            or mechanic.get("name")
            or f"Mechanic {mechanic['id']}"
        ),
        "phone": mechanic.get("phone"),
        "fcm_token": mechanic.get("fcm_token"),
        "distance_km": round(distance_km, 2),
        "capability_tier": _capability_tier(mechanic, service_type),
        "total_score": round(total, 2),
        "score_breakdown": {
            "proximity": round(prox, 2),
            "specialisation": round(spec, 2),
            "rating": round(rat, 2),
            "performance": round(perf, 2),
        },
        "weights": {
            "proximity": WEIGHT_PROXIMITY,
            "specialisation": WEIGHT_SPECIALISATION,
            "rating": WEIGHT_RATING,
            "performance": WEIGHT_PERFORMANCE,
        },
    }


def rank_mechanics(
    mechanics: List[Dict[str, Any]],
    request_lat: float,
    request_lon: float,
    service_type: str,
    excluded_ids: Optional[List[int]] = None,
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """Score all mechanics, prefer those with the required capability, return top N.

    Capability is a *preferred* hard gate: providers who can actually do the job
    (e.g. only 'both' providers for a breakdown) are returned first. If none are
    capable we fall back to the rest by score, so a request is never left with no
    candidates purely on capability.
    """
    scored = []
    for m in mechanics:
        result = score_mechanic(m, request_lat, request_lon, service_type, excluded_ids)
        if result is not None:
            scored.append(result)
    eligible = [s for s in scored if s.get("capability_tier", 0) >= 1]
    pool = eligible if eligible else scored
    # Sort by capability tier first (ideal 'both' over tow-only for breakdown), then score.
    pool.sort(key=lambda x: (x.get("capability_tier", 0), x["total_score"]), reverse=True)
    return pool[:top_n]
