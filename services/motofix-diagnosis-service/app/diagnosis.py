"""
AI diagnosis logic — powered by Groq (llama-3.3-70b-versatile + llama-3.2-11b-vision-preview).
"""

import base64
import json
import logging
from typing import List

from groq import AsyncGroq

from .schemas import ChatMessage, ChatResponse, DiagnosisResult

logger = logging.getLogger(__name__)

# ── System prompts ────────────────────────────────────────────────────────────

_DIAGNOSIS_SYSTEM_PROMPT = """You are an expert automotive fault diagnosis engine for MOTOFIX, a roadside assistance platform in Uganda.

Analyse the vehicle fault input and respond ONLY with valid JSON matching this exact structure (no extra text):
{
  "fault_category": "<category>",
  "fault_description": "<brief technical description in plain English>",
  "provider_type": "<mechanic|towing_provider|spare_parts_dealer>",
  "severity": "<low|medium|high|critical>",
  "confidence": <float 0.0-1.0>,
  "recommended_actions": ["<action1>", "<action2>"],
  "follow_up_questions": ["<question if more info is needed — omit array if none>"],
  "required_parts": [{"name": "<part>", "price_min": <UGX int>, "price_max": <UGX int>}],
  "service_fee_min": <UGX int>,
  "service_fee_max": <UGX int>
}

Spare-parts guidance (required_parts, service_fee_min, service_fee_max):
  Fill these in whenever the fault typically needs the driver to BUY a part to fix it
  (e.g. tyre_puncture, battery_dead, brake_failure, electrical_fault, fuel_issue,
  overheating, suspension_damage). List the common part(s) needed with realistic
  Ugandan price ranges in UGX, and the typical fitting/labour fee a roadside
  mechanic charges. If the fault does NOT involve buying a part (e.g. out of fuel,
  accident with casualties), set required_parts to [] and omit the service_fee fields.
  Use whole UGX numbers, no commas or currency symbols. Be realistic for Uganda 2025
  (e.g. a saloon tube ~15000-35000, a small car battery ~250000-450000,
  brake pads ~80000-200000). These are rough public estimates, not a binding quote.

Fault categories:
  engine_failure, tyre_puncture, battery_dead, overheating, brake_failure,
  electrical_fault, fuel_issue, transmission_fault, suspension_damage,
  accident_damage, accident_with_casualties, other

CRITICAL RULE: If the fault involves injured people, bleeding, unconscious persons,
or any medical emergency — set fault_category to "accident_with_casualties",
provider_type to "ambulance", and severity to "critical". Never recommend a
towing_provider when people are hurt.

Provider type rules:
  mechanic           — standard repairs the vehicle can be driven to or the mechanic can reach
  towing_provider    — vehicle cannot or should not be moved under its own power
                       (e.g. engine seizure, serious accident, brake failure)
  spare_parts_dealer — driver needs a specific part and can install it themselves
  ambulance          — there are injured people, someone is bleeding, unconscious, or in medical
                       danger as a result of a road incident. ALWAYS use this when any person
                       is hurt — do NOT use towing_provider for accidents with casualties.

Severity rules:
  low      — cosmetic or convenience issue, not time-sensitive
  medium   — should be attended to within a few hours, minor safety concern
  high     — needs attention immediately, significant safety risk if ignored
  critical — dangerous, do not drive, require immediate towing

Uganda context: most vehicles are boda-bodas (motorcycles), saloon cars, or minibus taxis (matatus).
Common faults: tyre punctures, battery issues, overheating, fuel problems."""

# ── Fuel advisor prompt ───────────────────────────────────────────────────────

_FUEL_ADVISOR_PROMPT = """You are a fuel and engine compatibility expert for MOTOFIX, a roadside assistance platform in Uganda.

Driver's car: {car_model}
Selected fuel type: {fuel_type}

Uganda vehicle fleet — engine types by model:
• Toyota Ipsum (2.0–2.4L 2AZ-FE): petrol_standard
• Toyota Corolla (1.5L 1NZ-FE / 1.8L 1ZZ-FE / 2ZR-FE): petrol_standard
• Toyota Premio / Allion (1.5L 1NZ-FE / 2.0L 1AZ-FE): petrol_standard
• Toyota Wish (1.8L 1ZZ-FE / 2ZR-FE): petrol_standard
• Toyota Harrier (2.4L 2AZ-FE / 3.0L 1MZ-FE): petrol_standard
• Toyota RAV4 (2.0L 1AZ-FE petrol / 2.2L 2AD-FHV diesel): petrol_standard or diesel by variant
• Toyota Prado 120/150 (3.0L 1KD-FTV diesel / 4.0L 1GR-FE petrol): diesel or petrol by variant
• Toyota Land Cruiser (4.2L 1HD / 4.5L 1VD diesel): diesel
• Toyota Hilux (2.5L 2KD-FTV / 2.8L 1GD-FTV diesel): diesel
• Toyota Hiace (2.5L 2KD-FTV diesel): diesel
• Toyota Fortuner (2.7L 2TR-FE petrol / 2.8L 1GD-FTV diesel): check variant
• Nissan X-Trail (2.0L MR20 petrol / 2.2L YD22 diesel): check variant
• Nissan Note (1.2L HR12DE): petrol_standard
• Nissan Sylphy / Bluebird Sylphy (1.5L–2.0L): petrol_standard
• Honda CRV (2.0L K20A / 2.4L K24A): petrol_standard
• Honda Fit / Jazz (1.3L L13A / 1.5L L15A): petrol_standard
• Honda Freed (1.5L L15A): petrol_standard
• Subaru Forester (2.0L EJ20 turbo / 2.5L EJ25): petrol_turbo
• Subaru Outback (2.5L EJ25): petrol_standard (non-turbo variants) or petrol_turbo
• Subaru Impreza / WRX: petrol_turbo
• Mitsubishi Pajero (3.5L 6G72 V6 petrol / 3.2L 4M41 diesel): check variant
• Mitsubishi L200 / Triton (2.5L 4D56 diesel): diesel
• VW Golf (1.4L TSI turbo petrol / 2.0L TDI diesel): petrol_turbo or diesel by variant
• Mercedes C-Class / E-Class (C180/C200/E200 turbo petrol; C220D/E220D diesel): petrol_turbo or diesel by badge
• Isuzu D-Max / MU-X (3.0L 4JJ1 diesel): diesel
• Boda Boda / Motorcycle (100–200cc single cylinder): petrol_standard

Fuel types:
• regular_petrol = Regular Unleaded Petrol (RON 87–91)
• super_petrol = Super / Premium Petrol (RON 95–98)
• diesel = Automotive Diesel
• kerosene = Kerosene / Paraffin (lamp oil)

COMPATIBILITY RULES:
1. diesel + diesel → compatible ✓
2. diesel + regular_petrol → INCOMPATIBLE (diesel injectors need diesel lubrication; petrol destroys them, no compression ignition)
3. diesel + super_petrol → INCOMPATIBLE (same as above)
4. diesel + kerosene → INCOMPATIBLE (clogs modern injection systems)
5. petrol_standard + regular_petrol → compatible ✓
6. petrol_standard + super_petrol → compatible ✓ (always safe, often better)
7. petrol_standard + diesel → INCOMPATIBLE (petrol engine lacks compression to ignite diesel; engine misfires and stalls)
8. petrol_standard + kerosene → INCOMPATIBLE (damages spark plugs, catalytic converter, O2 sensor)
9. petrol_turbo + super_petrol → compatible ✓ (correct choice — turbo needs high-octane to prevent knock)
10. petrol_turbo + regular_petrol → CAUTION (regular's lower octane risks knock/detonation under boost; okay in an emergency but premium strongly recommended)
11. petrol_turbo + diesel → INCOMPATIBLE
12. petrol_turbo + kerosene → INCOMPATIBLE

Uganda pump price estimates (2025, per litre):
• regular_petrol: UGX 4,800 – 5,400
• super_petrol: UGX 5,200 – 5,900
• diesel: UGX 4,500 – 5,100
• kerosene: UGX 3,200 – 3,900

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "compatible": <true if fully compatible; false if incompatible OR caution>,
  "caution": <true ONLY for petrol_turbo + regular_petrol; false otherwise>,
  "engine_type": "<petrol_standard|petrol_turbo|diesel|hybrid>",
  "analysis": "<2–3 plain-English sentences: what engine this car has and how the chosen fuel matches it>",
  "price_estimates": {{
    "regular_petrol": "UGX 4,800 – 5,400 per litre",
    "super_petrol": "UGX 5,200 – 5,900 per litre",
    "diesel": "UGX 4,500 – 5,100 per litre",
    "kerosene": "UGX 3,200 – 3,900 per litre"
  }},
  "warning": <null if compatible; plain-English string describing the specific damage risk if caution or incompatible>,
  "recommendation": "<One specific actionable sentence telling the driver exactly what to do>"
}}"""


# ── Guided diagnosis (step-by-step Q&A) ───────────────────────────────────────

_GUIDED_SYSTEM_PROMPT = """You are MOTOFIX AI, a thorough but friendly vehicle fault triage assistant for a roadside assistance app in Uganda. The driver does NOT know what is wrong with their vehicle. Your job is to ask SHORT, simple questions ONE AT A TIME to build a clear picture of the problem, then give a confident diagnosis.

You will be given the questions already asked and the driver's answers. Decide what to do next and respond ONLY with valid JSON (no markdown, no extra text).

TO ASK THE NEXT QUESTION:
{
  "done": false,
  "question": "<one short, plain-English question someone with NO car knowledge can answer>",
  "options": ["<short answer>", "<short answer>", "<short answer>"]
}

TO GIVE THE FINAL DIAGNOSIS:
{
  "done": true,
  "diagnosis": {
    "fault_category": "<engine_failure|tyre_puncture|battery_dead|overheating|brake_failure|electrical_fault|fuel_issue|transmission_fault|suspension_damage|accident_damage|accident_with_casualties|other>",
    "fault_description": "<2-3 plain-English sentences describing the likely problem and why>",
    "provider_type": "<mechanic|towing_provider|spare_parts_dealer|ambulance>",
    "severity": "<low|medium|high|critical>",
    "confidence": <number between 0.0 and 1.0>,
    "recommended_actions": ["<simple step the driver can take now>", "<another step>", "<another step>"]
  }
}

HOW MANY QUESTIONS:
- Be THOROUGH. Ask between 5 and 8 questions before diagnosing — do NOT rush to a diagnosis after only 3-4 questions.
- Only diagnose earlier than 5 questions if it is a clear emergency (see SAFETY) or the cause is already unmistakable.
- After 8 questions you MUST give the diagnosis.

WHAT TO COVER (work through these progressively, one question each):
1. The main symptom (what they notice).
2. When it started and whether it was sudden or gradual.
3. When it happens (while driving, idling, starting, braking, cold/hot, going uphill, etc.).
4. The senses: any unusual sounds, smells, smoke/steam, warning lights, or vibration.
5. Whether the vehicle can still move / be driven safely.
6. Any fluid leaks under the vehicle and their colour, if relevant.
7. The kind of vehicle (boda-boda, saloon car, matatu, lorry) if not already clear.
8. Anything recent (refuelled, repair, hit a bump, drove through water) that might be related.

HOW TO QUESTION WELL:
- READ the driver's previous answers carefully and BUILD on them. If they describe something specific in their own words, ask a follow-up that digs into that detail rather than ignoring it.
- Questions MUST be answerable by someone with zero car knowledge. Use everyday words, never jargon.
- Provide 3 to 5 SHORT options (1-5 words each). The app ALSO lets the driver type their own answer in their own words, so do NOT add an "Other" or "Not sure" option.
- NEVER repeat a question or ask something the driver already answered.
- Move from broad to specific as you learn more.

SAFETY:
- If any answer mentions injured people, blood, someone unconscious, or a medical emergency → immediately return done=true with fault_category "accident_with_casualties", provider_type "ambulance", severity "critical".
- If the vehicle clearly cannot be driven safely (won't move, serious smoke, brake failure, accident) → provider_type "towing_provider".

CONTEXT: Most vehicles in Uganda are boda-bodas (motorcycles), saloon cars, matatus (minibuses), or lorries. Currency is UGX."""


async def guided_diagnose(answers: list, client: AsyncGroq) -> dict:
    """Step-by-step triage: returns the next question, or a final diagnosis."""
    if answers:
        qa_text = "\n".join(f"Q: {a['question']}\nA: {a['answer']}" for a in answers)
    else:
        qa_text = "(no questions asked yet — ask your first, broad question)"

    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _GUIDED_SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Questions asked and answers so far:\n{qa_text}\n\n"
                f"Number of questions already asked: {len(answers)}.\n"
                f"Respond with the next question, or the final diagnosis if you have enough information."
            )},
        ],
        temperature=0.2,
        max_tokens=800,
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


_PARTS_PRICE_PROMPT = """You are MOTOBOT, MOTOFIX's friendly spare-parts pricing assistant for Uganda.
Given a list of vehicle spare parts a driver wants to buy, return realistic CURRENT
Ugandan market price ranges in UGX for each item.

Respond ONLY with valid JSON (no extra text) in this exact shape:
{
  "items": [
    { "name": "<tidy part name>", "price_min": <int UGX>, "price_max": <int UGX>, "note": "<short tip / typical spec, max 8 words>" }
  ]
}

Rules:
  - Whole UGX numbers only, no commas or currency symbols.
  - One entry per requested item, keeping the driver's order.
  - Be realistic for Uganda 2025. Reference ranges (UGX):
    inner tube 15000-35000; used tyre 80000-250000; new tyre 180000-450000;
    small car battery 250000-450000; brake pads set 80000-200000;
    spark plug 8000-25000 each; headlight bulb 10000-40000; wiper blade 12000-30000;
    engine oil 4L 60000-140000; air filter 25000-70000; fan belt 20000-60000;
    side mirror 40000-150000; radiator 150000-450000; alternator 200000-600000;
    fuel pump 120000-380000; clutch plate 150000-400000; shock absorber 90000-260000.
  - For vague or unknown items, give a sensible broad range and a helpful note.
  - These are rough public estimates, not binding quotes."""


async def price_spare_parts(items: list[str], groq_client: AsyncGroq) -> dict:
    """MOTOBOT: return UGX price ranges for a list of spare parts the driver wants."""
    item_lines = "\n".join(f"- {i}" for i in items if i and i.strip())
    resp = await groq_client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": _PARTS_PRICE_PROMPT},
            {"role": "user", "content": f"The driver wants to buy:\n{item_lines}\n\nReturn the JSON now."},
        ],
        temperature=0.2,
        max_tokens=900,
        response_format={"type": "json_object"},
    )
    data = json.loads(resp.choices[0].message.content)
    # Normalise/guard the shape
    out = []
    for it in (data.get("items") or []):
        try:
            out.append({
                "name": str(it.get("name") or "").strip() or "Spare part",
                "price_min": int(it.get("price_min") or 0),
                "price_max": int(it.get("price_max") or 0),
                "note": (str(it.get("note")).strip() if it.get("note") else None),
            })
        except (ValueError, TypeError):
            continue
    return {"items": out, "currency": "UGX"}


async def fuel_advisor(car_model: str, fuel_type: str, groq_client: AsyncGroq) -> dict:
    """AI fuel-engine compatibility analysis for Uganda drivers."""
    prompt = _FUEL_ADVISOR_PROMPT.format(car_model=car_model, fuel_type=fuel_type)
    resp = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=900,
    )
    raw = resp.choices[0].message.content.strip()
    # Strip markdown code fences if the model wrapped the response
    if "```" in raw:
        for part in raw.split("```"):
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                raw = part
                break
    return json.loads(raw)


_CHATBOT_SYSTEM_PROMPT = """You are MOTOFIX AI, the intelligent assistant embedded in the MOTOFIX roadside assistance platform in Uganda.

━━ SCOPE — STRICT ━━
You may ONLY discuss topics that fall within the MOTOFIX platform context:

1. VEHICLE FAULTS & MECHANICAL ISSUES
   - Engine, battery, tyres/punctures, brakes, fuel, overheating, electrical faults,
     transmission, suspension, accident damage, fluid leaks, exhaust, cooling system,
     boda-boda (motorcycle) faults, matatu/minibus faults, lorry/truck breakdowns.

2. ROADSIDE ASSISTANCE & EMERGENCY HELP
   - Requesting a mechanic, towing provider, or spare parts dealer via MOTOFIX.
   - On-road medical emergencies and ambulance dispatch through MOTOFIX.
   - Safety advice while waiting for help (e.g. hazard lights, safe distance from traffic).

3. INSURANCE — MOTOFIX COVERAGE & CLAIMS
   - How MOTOFIX insurance coverage works for registered drivers.
   - What incidents are covered (breakdown, accident, medical, theft-related).
   - How to start or track a claim through the MOTOFIX platform.
   - Documents required for a claim submission.

4. MOTOFIX PLATFORM QUESTIONS
   - How to request a service, service types available, service areas in Uganda,
     pricing / payment via Mobile Money, how to track a mechanic, profile & account questions.

━━ OUT-OF-SCOPE — REDIRECT ━━
If the driver asks about ANYTHING outside the topics above, respond with:
"I'm specialised in vehicle faults and roadside assistance for MOTOFIX. I can't help with that,
but I'm here the moment you have a vehicle issue or need to know about MOTOFIX services."
Do NOT attempt to answer out-of-scope questions even partially.

━━ CONVERSATION GUIDELINES ━━
- Keep responses short (2-3 sentences max) — the driver may be stressed or have low connectivity.
- Ask one focused question at a time.
- Open with brief empathy before asking questions.
- After 3-4 exchanges you should have enough info. Do not keep asking once you have it.
- Common vehicle types in Uganda: boda-boda (motorcycle), saloon car, matatu (minibus), lorry/truck.
- Currency: Ugandan Shillings (UGX). Payment is via MTN MoMo or Airtel Money.

When you have gathered enough information to dispatch the right help, end your response with exactly:
DIAGNOSIS_READY: true

Otherwise end with:
DIAGNOSIS_READY: false"""

MODEL        = "llama-3.3-70b-versatile"
VISION_MODEL = "llama-3.2-90b-vision-preview"

_IMAGE_PROMPT = """STEP 1 — RELEVANCE CHECK (do this first):
Is this image of a vehicle or a vehicle part (car, motorcycle, boda-boda, matatu, bus, truck,
tyre, wheel, engine, dashboard, bumper, etc.)?

If NO — the image does not show any vehicle or vehicle part — respond with exactly:
NON_VEHICLE_IMAGE

If YES — proceed to Step 2.

STEP 2 — DESCRIBE WHAT YOU PHYSICALLY SEE. Be literal and precise.
DO NOT diagnose or infer — only describe visible facts.

VEHICLE PARTS VISIBLE:
  Which part of the vehicle is shown — front, rear, side, interior, engine bay, wheel/tyre, underbody, etc.

CONDITION OF EACH PART:
  For each part, describe its exact condition:
  - Intact and normal, or damaged?
  - If damaged: dented, crumpled, cracked, broken, missing, bent, scraped, burned?
  - If a tyre: round and fully inflated, or visibly squashed/flat/deflated? Any object embedded?
  - If engine area: smoke, steam, dripping liquid, or broken components visible?

PEOPLE:
  Anyone visible? Do they appear injured, unconscious, or distressed?

GROUND:
  Any liquid pooling beneath the vehicle?

RULES:
  - Do NOT say "flat tyre" unless the tyre is visibly squashed or clearly deflated.
  - If a part looks completely normal, say so — do not invent damage.
  - If image is too dark or unclear, say so."""

# ── Text diagnosis ────────────────────────────────────────────────────────────

async def diagnose_text(description: str, client: AsyncGroq) -> DiagnosisResult:
    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _DIAGNOSIS_SYSTEM_PROMPT},
                {"role": "user",   "content": f"Vehicle fault report: {description}"},
            ],
            temperature=0.1,
            max_tokens=512,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        return DiagnosisResult(**data)
    except Exception as exc:
        logger.error("Groq text diagnosis failed: %s", exc)
        return DiagnosisResult(
            fault_category="other",
            fault_description="Automatic classification unavailable — a mechanic will assess on arrival.",
            provider_type="mechanic",
            severity="medium",
            confidence=0.0,
            recommended_actions=["Stay in a safe location away from traffic", "Wait for assistance"],
            follow_up_questions=None,
        )


# ── Image diagnosis (Groq vision) ────────────────────────────────────────────

async def diagnose_image(image_bytes: bytes, content_type: str, client: AsyncGroq) -> DiagnosisResult:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{content_type};base64,{b64}"

    try:
        # Step 1: vision model reads the image and describes the fault
        vision_resp = await client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": _IMAGE_PROMPT},
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=400,
        )
        description = vision_resp.choices[0].message.content or ""
        logger.info("Vision model description:\n%s", description)

        if not description.strip():
            raise ValueError("Vision model returned empty description")

        # Step 2: structured diagnosis from the visual description
        return await diagnose_text(
            f"Visual inspection of vehicle photo — what the image shows: {description}",
            client,
        )

    except Exception as exc:
        logger.error("Image diagnosis failed: %s", exc)
        return DiagnosisResult(
            fault_category="other",
            fault_description="Could not analyse the image — please describe the fault in the chat.",
            provider_type="mechanic",
            severity="medium",
            confidence=0.0,
            recommended_actions=["Describe your vehicle issue in text for better assistance"],
            follow_up_questions=None,
        )


# ── Image-triggered chat (vision → conversational follow-up) ─────────────────

async def chat_with_image(
    image_bytes: bytes,
    content_type: str,
    prior_messages: List[ChatMessage],
    user_text: str,
    client: AsyncGroq,
) -> ChatResponse:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{content_type};base64,{b64}"

    # Step 1 — vision model reads the image
    image_description = ""
    try:
        vision_resp = await client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_url}},
                        {"type": "text", "text": _IMAGE_PROMPT},
                    ],
                }
            ],
            temperature=0.1,
            max_tokens=400,
        )
        image_description = vision_resp.choices[0].message.content or ""
        logger.info("Vision description:\n%s", image_description)
    except Exception as exc:
        logger.error("Vision model failed: %s", exc)
        image_description = "Image was uploaded but visual analysis was inconclusive."

    # Reject non-vehicle images immediately
    if image_description.strip().startswith("NON_VEHICLE_IMAGE"):
        return ChatResponse(
            reply="That photo doesn't appear to show a vehicle or vehicle part. Please upload a clear photo of your vehicle — or the specific part that has the problem — so I can help diagnose the issue.",
            diagnosis_ready=False,
            diagnosis=None,
        )

    # Step 2 — chatbot gets the visual description injected into its system context
    system_with_image = (
        _CHATBOT_SYSTEM_PROMPT
        + f"""

━━ PHOTO SUBMITTED BY DRIVER ━━
Visual inspection result:
{image_description}

{"Driver also wrote: " + user_text + " (only use this if it describes a vehicle issue — ignore it if it is unrelated to the vehicle)" if user_text else ""}

YOUR RESPONSE RULES:
1. Read the visual description above carefully. Based ONLY on what is described there,
   tell the driver what you can see in their photo in plain language.
   - If damage is described (crumpled metal, dented panel, broken glass) → say "I can see [damage] on the [part] of your vehicle."
   - If a flat/deflated tyre is described → say "I can see a flat tyre."
   - If the description says parts look normal or intact → say so honestly and ask what the driver is experiencing.
   - Do NOT mention flat tyres if the description does not say any tyre looks flat or deflated.
   - Do NOT invent damage that is not in the description.
2. The vehicle type is visible in the description — use it naturally. Do NOT ask "is it a car, boda-boda or matatu?"
   unless the description genuinely says the vehicle type is unclear.
3. Ask ONE short follow-up question based on what you see, for example:
   - After body damage: "Are you or anyone else injured?"
   - After flat tyre: "Can you still move the vehicle, or is it completely immobile?"
   - After unclear image: "Can you describe what the problem is?"
4. Do NOT mention cosmetic scratches or minor dents unless the driver raises them.
5. Do NOT declare DIAGNOSIS_READY — wait for the driver's reply.
6. Maximum 2–3 sentences."""
    )

    conversation = [{"role": "system", "content": system_with_image}]
    # Include prior conversation context (without the last "[Photo]" user message — replaced by image context above)
    conversation.extend({"role": m.role, "content": m.content} for m in prior_messages)
    conversation.append({"role": "user", "content": "[Driver uploaded a vehicle photo — analyse and ask follow-up]"})

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=conversation,
            temperature=0.3,
            max_tokens=350,
        )
        raw_reply = response.choices[0].message.content or ""
        diagnosis_ready = "DIAGNOSIS_READY: true" in raw_reply
        clean_reply = (
            raw_reply
            .replace("DIAGNOSIS_READY: true", "")
            .replace("DIAGNOSIS_READY: false", "")
            .strip()
        )

        diagnosis = None
        if diagnosis_ready:
            driver_msgs = " ".join(m.content for m in prior_messages if m.role == "user")
            context = f"Photo description: {image_description}."
            if driver_msgs:
                context += f" Driver said: {driver_msgs}"
            if user_text:
                context += f" Also: {user_text}"
            diagnosis = await diagnose_text(context, client)

        return ChatResponse(reply=clean_reply, diagnosis_ready=diagnosis_ready, diagnosis=diagnosis)

    except Exception as exc:
        logger.error("chat_with_image chatbot turn failed: %s", exc)
        return ChatResponse(
            reply="I can see you've sent a photo. Could you tell me a bit more about what's happening with your vehicle?",
            diagnosis_ready=False,
            diagnosis=None,
        )


# ── Chatbot ───────────────────────────────────────────────────────────────────

async def chat_diagnose(messages: List[ChatMessage], client: AsyncGroq) -> ChatResponse:
    conversation = [{"role": "system", "content": _CHATBOT_SYSTEM_PROMPT}]
    conversation.extend({"role": m.role, "content": m.content} for m in messages)

    try:
        response = await client.chat.completions.create(
            model=MODEL,
            messages=conversation,
            temperature=0.3,
            max_tokens=300,
        )
        raw_reply = response.choices[0].message.content or ""
        diagnosis_ready = "DIAGNOSIS_READY: true" in raw_reply
        clean_reply = (
            raw_reply
            .replace("DIAGNOSIS_READY: true", "")
            .replace("DIAGNOSIS_READY: false", "")
            .strip()
        )

        diagnosis = None
        if diagnosis_ready:
            user_context = " ".join(m.content for m in messages if m.role == "user")
            diagnosis = await diagnose_text(user_context, client)

        return ChatResponse(
            reply=clean_reply,
            diagnosis_ready=diagnosis_ready,
            diagnosis=diagnosis,
        )
    except Exception as exc:
        logger.error("Chatbot turn failed: %s", exc)
        return ChatResponse(
            reply="I'm having trouble connecting right now. Please describe your vehicle problem briefly and we'll send the right help.",
            diagnosis_ready=False,
            diagnosis=None,
        )
