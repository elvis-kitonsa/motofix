# motofix-diagnosis-service

Fault diagnosis and classification for the MOTOFIX platform. Powers the MOTOBOT
assistant: text/guided diagnosis, image-based verdicts, repair-vs-replace cost
estimates, spare-parts pricing and dealer lookup, and voice-note transcription.

- **Stack:** Python / FastAPI
- **Port:** 8007
- **Database:** none (stateless)
- **External APIs:** OpenAI / Google Vision (diagnosis), Groq Whisper (voice)

## Running locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # note: requirements.txt is UTF-16 encoded
cp .env.example .env               # fill in your API keys
uvicorn app.main:app --reload --port 8007
```

Health check: `GET /health`.

See the [root README](../../README.md) and [docs/RUNBOOK.md](../../docs/RUNBOOK.md)
for the full platform overview.
