Conceptuele specificatie: code-interpreter-proxy voor LibreChat + LLM Sandbox

Doel:
Een service code-interpreter-proxy die:

Naar buiten toe de Code Interpreter API aanbiedt zoals LibreChat die verwacht

Auth via x-api-key

Base URL configureerbaar via LIBRECHAT_CODE_BASEURL 
librechat.ai
+1

Intern llm-sandbox gebruikt als sandbox-engine voor code-executie

Multi-language, resource-limits, isolated containers 
GitHub
+1

Als Docker-service meedraait in jullie LibreChat-fork (docker-compose) en automatisch gebruikt wordt als Code Interpreter door LibreChat.

Let op: endpointnamen zijn zo gekozen dat ze logisch en stabiel zijn. Als de officiële API op een paar punten anders heet, kun je dat later in de router aanpassen. Het idee/contract blijft hetzelfde.

1. High-level architectuur
1.1 Componenten

LibreChat API

Leest LIBRECHAT_CODE_API_KEY & LIBRECHAT_CODE_BASEURL uit .env. 
librechat.ai
+1

Stuurt code + file-requests naar de Code Interpreter API.

code-interpreter-proxy (nieuwe service)

FastAPI-app met endpoints onder /v1/librechat/…

Validatie van x-api-key header (moet matchen met LIBRECHAT_CODE_API_KEY). 
librechat.ai
+1

Houdt sessies en bestanden bij.

Gebruikt llm-sandbox om code in containers uit te voeren.

LLM Sandbox runtime

Python library llm-sandbox draait in dezelfde container als de proxy

Of: aparte service; maar voor eenvoud: library-embedded variant.

Backends: Docker / Podman / Kubernetes. 
GitHub
+1

1.2 Datastromen

LibreChat → code-interpreter-proxy:

POST /v1/librechat/runs met code, taal, sessie-id, optioneel file-refs.

Proxy:

Zoekt / maakt een SandboxSession voor deze sessie (llm-sandbox). 
GitHub
+1

Synct bestanden van host naar container.

Voert code uit.

Bepaalt welke nieuwe/gewijzigde files er zijn.

Proxy → LibreChat:

Stuurt stdout, stderr, exit-code, stats (CPU, geheugen, tijd) + file-metadata terug. 
librechat.ai
+1

2. API-contract: Code Interpreter interface (conceptueel)

Base URL (zoals LibreChat 'm ziet):

${LIBRECHAT_CODE_BASEURL} = http://code-interpreter-proxy:8000


Alle endpoints zitten daaronder, met prefix:

/v1/librechat

2.1 Auth

Header: x-api-key: <string>

Vereiste: moet exact gelijk zijn aan de env var LIBRECHAT_CODE_API_KEY in LibreChat én CI_API_KEY in de proxy. 
librechat.ai
+1

2.2 Endpoints (conceptueel)
2.2.1 Code runnen

POST /v1/librechat/runs

Doel: één code-executie in een sessie.

Request body (JSON)

{
  "session_id": "string",          // logische sessie-id (per chat/conversatie)
  "language": "python",            // "python" | "javascript" | "java" | "cpp" | "go" | "r"
  "code": "print('hello')",
  "args": ["--flag"],              // optioneel
  "timeout_seconds": 15,           // optioneel, default bv 10
  "files": ["file_123", "file_456"] // optionele lijst file_id's die in de run beschikbaar moeten zijn
}


Response body (JSON)

{
  "run_id": "string",
  "session_id": "string",
  "language": "python",
  "stdout": "hello\n",
  "stderr": "",
  "exit_code": 0,
  "stats": {
    "cpu_time_seconds": 0.12,
    "memory_bytes": 10240,
    "wall_time_seconds": 0.15
  },
  "files": [
    {
      "id": "file_789",
      "name": "output.csv",
      "size_bytes": 1234,
      "mime_type": "text/csv"
    }
  ]
}


Errors

401 bij foute of missende x-api-key

400 bij invalid body

408 bij timeout (te lang draaien)

429 als je een rate-limit wilt afdwingen

500 bij interne errors

2.2.2 File upload

POST /v1/librechat/files

Multipart upload.

Request

Headers: x-api-key

Query/fields:

session_id (form field)

Body: multipart met file veld file

Response

{
  "file": {
    "id": "file_123",
    "session_id": "sess_abc",
    "name": "input.csv",
    "size_bytes": 4567,
    "mime_type": "text/csv",
    "created_at": "2025-11-13T12:34:56Z"
  }
}

2.2.3 File list (per sessie)

GET /v1/librechat/files

Query:

session_id (required)

Response:

{
  "session_id": "sess_abc",
  "files": [
    {
      "id": "file_123",
      "name": "input.csv",
      "size_bytes": 4567,
      "mime_type": "text/csv"
    }
  ]
}

2.2.4 File download

GET /v1/librechat/files/{file_id}

file_id path param

Response: binaire file + Content-Type / Content-Disposition.

2.2.5 File delete

DELETE /v1/librechat/files/{file_id}

Verwijdert file uit host-storage en eventueel uit de sandbox-sessie.

2.2.6 Health

GET /v1/librechat/health

Simpel healthcheck voor LibreChat / ops:

{
  "status": "ok",
  "backend": "llm-sandbox",
  "languages": ["python", "javascript", "java", "cpp", "go", "r"]
}


Taal-lijst mapt op de talen die llm-sandbox ondersteunt. 
GitHub
+1

3. Mapping naar LLM Sandbox
3.1 Sandbox-sessies

We modelleren een interne sessie als:

type SandboxSessionRecord = {
  sessionId: string
  lang: string
  sandbox: SandboxSession | InteractiveSandboxSession
  createdAt: Date
  lastUsedAt: Date
}


Gebruik SandboxSession voor simpele runs.

Overweeg InteractiveSandboxSession voor Python als je stateful REPL-gedrag wilt (variabelen blijven bestaan tussen runs). 
GitHub
+1

Algoritme get_or_create_session(session_id, language)

Als session_id nog niet bestaat:

Maak nieuwe SandboxSession(lang=language, backend=BACKEND, workdir="/sandbox").

Als de sessie bestaat maar lang verschilt → óf fout gooien, óf nieuwe sessie forceren (designkeuze).

Update lastUsedAt.

3.2 Code-run → SandboxSession.run

Voor een code-run:

with session:  # of persistent sessie in memory
    result = session.run(
        code,
        timeout=timeout_seconds,
        # optioneel: extra config/libraries
    )


Resultaat bevat:

stdout

stderr

exit-info

mogelijk resource-informatie (tijd, mem). 
GitHub
+1

Die map je 1-op-1 naar het RunResponse-object.

3.3 File handling via copy_to_runtime / copy_from_runtime

Bij upload:

Schrijf file naar host-pad, bijv. /data/code-interpreter/<session_id>/<file_id>.

Doe session.copy_to_runtime(host_path, "/sandbox/<name>"). 
GitHub
+1

Sla metadata op in een file-tabel (sqlite/postgres/redis/json, maakt niet uit zolang Cursor er geen burn-out van krijgt).

Na een run:

Indien je output-bestanden wilt exposen:

List bestanden in /sandbox.

Voor nieuwe of gewijzigde bestanden:

session.copy_from_runtime("/sandbox/foo.csv", host_path)

File-metadata updaten en file-id teruggeven in RunResponse.files.

4. Interne projectstructuur (voor Cursor)

Voor de service zelf (in je LibreChat-fork):

/code-interpreter-proxy
  ├─ pyproject.toml / requirements.txt
  ├─ Dockerfile
  └─ src/
      ├─ main.py              # FastAPI app entrypoint
      ├─ config.py            # env / settings
      ├─ auth.py              # x-api-key check
      ├─ api/
      │   ├─ runs.py          # /v1/librechat/runs
      │   ├─ files.py         # file endpoints
      │   └─ health.py        # health endpoint
      ├─ models/
      │   ├─ runs.py          # Pydantic models voor RunRequest / RunResponse
      │   └─ files.py         # Pydantic models voor file metadata
      ├─ sandbox/
      │   ├─ sessions.py      # SessionManager met llm-sandbox integratie
      │   └─ files.py         # File storage + sync naar sandbox
      └─ utils/
          └─ logging.py

4.1 config.py

Leest env vars:

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    api_prefix: str = "/v1/librechat"
    ci_api_key: str  # CI_API_KEY (moet matchen met LIBRECHAT_CODE_API_KEY)
    backend: str = "docker"  # llm-sandbox BACKEND
    max_memory_mb: int = 512
    max_run_timeout_seconds: int = 30
    session_ttl_minutes: int = 60
    file_storage_path: str = "/data/code-interpreter"

    class Config:
        env_prefix = "CI_"


In .env:

# door jullie docker-compose in de proxy container gezet
CI_API_KEY=${LIBRECHAT_CODE_API_KEY}
CI_BACKEND=docker
CI_FILE_STORAGE_PATH=/data/code-interpreter

4.2 auth.py

Dependency voor FastAPI:

from fastapi import Header, HTTPException, status
from .config import settings

async def require_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.ci_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

4.3 sandbox/sessions.py

SessionManager met:

class SessionManager:
    def __init__(...):
        self._sessions: dict[str, SandboxSessionRecord] = {}

    def get_or_create(self, session_id: str, language: str) -> SandboxSession:
        ...

    def cleanup_expired(self):
        ...


Eventueel in de toekomst Redis erbij, maar conceptueel is dit genoeg.

5. Docker & deployment-spec

Je wilt dat deze service automatisch meekomt in de LibreChat-fork.

5.1 Nieuwe service in docker-compose.yml van jullie fork
services:
  # bestaande LibreChat services
  api:
    # ...
    env_file:
      - .env
    depends_on:
      - mongo
      - code-interpreter-proxy
    networks:
      - librechat_net

  client:
    # ...
    networks:
      - librechat_net

  code-interpreter-proxy:
    build: ./code-interpreter-proxy
    environment:
      CI_API_KEY: ${LIBRECHAT_CODE_API_KEY}
      CI_BACKEND: docker
      CI_FILE_STORAGE_PATH: /data/code-interpreter
    volumes:
      - code_interpreter_files:/data/code-interpreter
      - /var/run/docker.sock:/var/run/docker.sock  # vereist voor Docker-backend
    networks:
      - librechat_net

networks:
  librechat_net:

volumes:
  code_interpreter_files:

5.2 LibreChat .env / config

In de .env van LibreChat (root van je fork):

LIBRECHAT_CODE_API_KEY=super-secret
LIBRECHAT_CODE_BASEURL=http://code-interpreter-proxy:8000


LibreChat documentatie zegt dat je hiermee een self-hosted instance kunt aanwijzen. 
librechat.ai
+1

6. Non-functionals: security, limieten, gedrag
6.1 Beperkingen uit LibreChat-docs meenemen

LibreChat's Code Interpreter API noemt o.a.: 
librechat.ai
+1

Geen netwerktoegang

Max 10 files per run

RAM-per-execution limieten

In de proxy/llm-sandbox:

BACKEND=docker + netwerk disablen in de container policy (no network / restricted). 
GitHub
+1

Eigen limieten:

Per run max 10 files koppelen in RunRequest.files.

In de config max_memory_mb & max_run_timeout_seconds gebruiken om llm-sandbox te configureren.

6.2 Cleanup

Sessies en bestanden:

TTL voor sessies, bv. 60 min inactiviteit → container stoppen + host-files weggooien.

Cron job / background task in FastAPI om periodiek cleanup_expired() te draaien.

7. Wat Cursor hiermee kan doen

Met deze spec kan Cursor/AI in je repo o.a.:

src/models/runs.py & src/models/files.py genereren als Pydantic-modellen op basis van de JSON-schema's.

FastAPI-routers voor /v1/librechat/runs en /v1/librechat/files genereren.

SessionManager skeleton genereren en llm-sandbox-calls invullen met SandboxSession.run, copy_to_runtime, copy_from_runtime. 
GitHub
+1

Dockerfile genereren met:

FROM python:3.11-slim

pip install fastapi uvicorn llm-sandbox[docker]

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]