# motofix-diagnosis-service

Fault diagnosis and classification for the MOTOFIX platform. Powers the MOTOBOT
assistant: text/guided diagnosis, image-based verdicts, repair-vs-replace cost
estimates, spare-parts pricing and dealer lookup, and voice-note transcription.

- **Stack:** Python / FastAPI
- **Port:** 8007
- **Database:** none (stateless)
- **External APIs:** Claude / Anthropic (text & image diagnosis), Groq Whisper (voice transcription)

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in your API keys
uvicorn app.main:app --reload --port 8007
```

## Endpoints

Interactive API docs at `/docs`. The service is stateless. Main groups:

| Group | Examples |
|-------|----------|
| Diagnosis | `POST /diagnose`, `POST /diagnose/guided`, `POST /diagnose/image`, `POST /service-estimate` |
| MOTOBOT chat | `POST /chat`, `POST /chat/image`, `POST /transcribe` (Groq Whisper voice), `GET /greetings` |
| Parts & fuel | `POST /parts-price`, `POST /parts-dealers`, `POST /fuel-advisor`, `POST /fuel-advisor/stations` |
| System | `GET /health` (reports whether Groq and Claude keys are configured) |

## Configuration (environment)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude key — text/guided diagnosis, image verdicts, chat. |
| `GROQ_API_KEY` | Groq key — Whisper voice-note transcription. |
| `SECRET_KEY` / `ALGORITHM` | JWT verification (must match the other services). |

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
