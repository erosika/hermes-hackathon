> ## Documentation Index
> Fetch the complete documentation index at: https://docs.honcho.dev/llms.txt
> Use this file to discover all available pages before exploring further.

# Local Environment Setup

> Set up a local environment to run Honcho for development, testing, or self-hosting

This guide helps you set up a local environment to run Honcho for development, testing, or self-hosting.

## Overview

By the end of this guide, you'll have:

* A local Honcho server running on your machine
* A PostgreSQL database with pgvector extension
* Basic configuration to connect your applications
* A working environment for development or testing

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

* **uv** - Python package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh` or `brew install uv`
* **Git** - [Download from git-scm.com](https://git-scm.com/downloads)
* **Docker** (required for Docker setup, not needed for manual setup) - [Download from docker.com](https://www.docker.com/products/docker-desktop/)

### Database Options

You'll need a PostgreSQL database with the pgvector extension. Choose one:

* **Local PostgreSQL** - Install locally or use Docker
* **Supabase** - Free cloud PostgreSQL with pgvector
* **Railway** - Simple cloud PostgreSQL hosting
* **Your own PostgreSQL server**

## LLM Setup

Honcho uses LLMs for memory extraction, summarization, dialectic chat, and dreaming. The server will **fail to start** without a provider configured.

You need one API key and one model. Any OpenAI-compatible endpoint works — OpenRouter, Together, Fireworks, Ollama, vLLM, or a direct vendor API. Models must support tool calling (function calling).

The `.env.template` has provider and model lines ready for each feature. After copying it to `.env`, you need to set three things:

```bash  theme={null}
# 1. Your endpoint and API key (already uncommented in the template)
LLM_OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
LLM_OPENAI_COMPATIBLE_API_KEY=sk-or-v1-...

# 2. Replace "your-model-here" everywhere with your model
#    (these are spread across the Deriver, Dialectic, Summary, and Dream sections)
DERIVER_MODEL=google/gemini-2.5-flash  # e.g. google/gemini-2.5-flash
SUMMARY_MODEL=google/gemini-2.5-flash
DREAM_MODEL=google/gemini-2.5-flash
DIALECTIC_LEVELS__minimal__MODEL=google/gemini-2.5-flash
# ... same for low, medium, high, max

# 3. Everything else is already configured:
#    - PROVIDER=custom for all features (routes through your endpoint)
#    - THINKING_BUDGET_TOKENS=0 (correct for non-Anthropic models)
#    - LLM_EMBEDDING_PROVIDER=openrouter (uses same endpoint for embeddings)
```

Use find-and-replace to swap all `your-model-here` with your chosen model in one step.

<Info>
  For recommended model tiers per feature, using multiple providers, or direct vendor API keys, see the [Configuration Guide](./configuration#llm-configuration).
</Info>

<Info>
  **Community quick-start**: [elkimek/honcho-self-hosted](https://github.com/elkimek/honcho-self-hosted) provides a one-command installer with pre-configured model tiers, interactive provider setup, and Hermes Agent integration.
</Info>

## Docker Setup (Recommended)

Docker Compose handles the database, Redis, and Honcho server. The compose file **builds the image from source** (there is no pre-built image on Docker Hub). This requires Docker with BuildKit enabled — see [Troubleshooting](./troubleshooting#docker-build-fails-with-permission-errors) if the build fails.

The compose file is production-oriented by default (ports bound to `127.0.0.1`, restart policies, caching enabled). For development, uncomment the source mounts and monitoring services inside the file.

### 1. Clone the Repository

```bash  theme={null}
git clone https://github.com/plastic-labs/honcho.git
cd honcho
```

### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash  theme={null}
cp .env.template .env
```

Edit `.env` and configure your LLM provider — see [LLM Setup](#llm-setup) above. The database connection is set in the compose file. Auth is disabled by default (`AUTH_USE_AUTH=false`).

### 3. Start the Services

```bash  theme={null}
cp docker-compose.yml.example docker-compose.yml
docker compose up -d --build
```

The first build takes a few minutes (compiling from source). Subsequent starts are fast.

This starts four services: **api** (port 8000), **deriver** (background worker), **database** (PostgreSQL with pgvector, port 5432), and **redis** (port 6379). All ports are bound to `127.0.0.1`. Redis caching is enabled by default.

For development, uncomment the source mount and monitoring sections inside `docker-compose.yml` to enable live reload, Prometheus, and Grafana.

### 4. Verify

Migrations run automatically on startup.

```bash  theme={null}
# Check all containers are running
docker compose ps

# Health check (confirms the process is up)
curl http://localhost:8000/health

# Check the deriver is processing (look for "polling" or "processing" in logs)
docker compose logs deriver --tail 20
```

For a full end-to-end test, see [Verify Your Setup](#verify-your-setup) below.

## Manual Setup

For more control over your environment, you can set up everything manually.

### 1. Clone and Install Dependencies

```bash  theme={null}
git clone https://github.com/plastic-labs/honcho.git
cd honcho

# Install dependencies using uv (this will also set up Python if needed)
uv sync

# Activate the virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### 2. Set Up PostgreSQL

#### Option A: Local PostgreSQL Installation

Install PostgreSQL and pgvector on your system:

**macOS (using Homebrew):**

```bash  theme={null}
brew install postgresql
brew install pgvector
```

**Ubuntu/Debian:**

```bash  theme={null}
sudo apt update
sudo apt install postgresql postgresql-contrib
# Install pgvector extension (see pgvector docs for your version)
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Option B: Docker PostgreSQL

```bash  theme={null}
docker run --name honcho-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d pgvector/pgvector:pg15
```

### 3. Enable Extensions

Connect to PostgreSQL and enable pgvector:

```bash  theme={null}
# Connect to PostgreSQL
psql -U postgres

# Enable the pgvector extension on the default database
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 4. Configure Environment

Create a `.env` file with your settings:

```bash  theme={null}
cp .env.template .env
```

Edit `.env` — configure your LLM provider (see [LLM Setup](#llm-setup) above) and set the database connection:

```bash  theme={null}
DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@localhost:5432/postgres
AUTH_USE_AUTH=false
LOG_LEVEL=DEBUG
```

### 5. Run Database Migrations

```bash  theme={null}
# Run migrations to create tables
uv run alembic upgrade head
```

### 6. Start the Server

```bash  theme={null}
# Start the development server
uv run fastapi dev src/main.py
```

The server will be available at `http://localhost:8000`.

### 7. Start the Background Worker (Deriver)

In a **separate terminal**, start the deriver background worker:

```bash  theme={null}
uv run python -m src.deriver
```

The deriver is essential for Honcho's core functionality. It processes incoming messages to extract observations, build peer representations, generate session summaries, and run dream consolidation. Without it, messages will be stored but no memory or reasoning will occur.

## Cloud Database Setup

If you prefer to use a managed PostgreSQL service:

### Supabase (Recommended)

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Enable pgvector extension** in the SQL editor:
   ```sql  theme={null}
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. **Get your connection string** from Settings > Database
4. **Update your `.env` file** with the connection string

### Railway

1. **Create a Railway project** at [railway.app](https://railway.app)
2. **Add a PostgreSQL service**
3. **Enable pgvector** in the PostgreSQL console
4. **Get your connection string** from the service variables
5. **Update your `.env` file**

## Verify Your Setup

Once your Honcho server is running, verify everything is working:

### 1. Health Check

```bash  theme={null}
curl http://localhost:8000/health
# {"status":"ok"}
```

Note: `/health` only confirms the process is running. It does not check database or LLM connectivity.

### 2. Smoke Test (database + API)

This confirms the database connection, migrations, and API are all working:

```bash  theme={null}
# Create a workspace
curl -s -X POST http://localhost:8000/v3/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}' | python3 -m json.tool
```

If you get back a workspace object with an `id`, your database is connected and migrations ran correctly.

### 3. API Documentation

Visit `http://localhost:8000/docs` to see the interactive API documentation.

### 4. Test with SDK

```python  theme={null}
from honcho import Honcho

client = Honcho(
    base_url="http://localhost:8000",
    workspace_id="test"
)

peer = client.peer("test-user")
print(f"Created peer: {peer.id}")
```

## Connect Your Application

Now that Honcho is running locally, you can connect your applications:

### Update SDK Configuration

```python  theme={null}
# Python SDK
from honcho import Honcho

client = Honcho(
    base_url="http://localhost:8000",
)
```

```typescript  theme={null}
// TypeScript SDK
import { Honcho } from '@honcho-ai/sdk';

const client = new Honcho({
  baseUrl: 'http://localhost:8000',
});
```

### Next Steps

* **Configure Honcho**: Visit the [Configuration Guide](./configuration) for model tiers, provider options, and tuning
* **Explore the API**: Check out the [API Reference](../api-reference/introduction)
* **Try the SDKs**: See our [guides](../guides) for examples
* **Join the community**: [Discord](https://discord.gg/honcho)

## Troubleshooting

Running into issues? See the [Troubleshooting Guide](./troubleshooting) for detailed solutions to common problems including:

* Startup failures (missing API keys, database issues)
* Runtime errors ("An unexpected error occurred" on every request)
* Deriver not processing messages
* Database connection and migration issues
* Docker and Redis problems

**Quick checks:**

* Verify the server is running: `curl http://localhost:8000/health`
* Check logs: `docker compose logs api` (Docker) or check terminal output (manual setup)
* Ensure migrations ran: `uv run alembic upgrade head`

## Production Considerations

The default compose file is already production-oriented — ports bound to `127.0.0.1`, restart policies, caching enabled.

### Security

* Set `AUTH_USE_AUTH=true` and generate a JWT secret with `python scripts/generate_jwt_secret.py`
* Use HTTPS via a reverse proxy in front of Honcho. Example with Caddy (automatic TLS):
  ```
  honcho.example.com {
      reverse_proxy localhost:8000
  }
  ```
  Or with nginx:
  ```nginx  theme={null}
  server {
      listen 443 ssl;
      server_name honcho.example.com;
      ssl_certificate /etc/letsencrypt/live/honcho.example.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/honcho.example.com/privkey.pem;
      location / {
          proxy_pass http://127.0.0.1:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```
* Secure your database with strong credentials and restrict network access
* The production compose binds PostgreSQL and Redis to `127.0.0.1` only — they are not accessible from the network

### Scaling the Deriver

* Increase `DERIVER_WORKERS` (default: 1) for higher message throughput
* You can also run multiple deriver processes across machines — they coordinate via the database queue
* Monitor deriver logs for processing backlog

### Caching

* The production compose enables Redis caching by default (`CACHE_ENABLED=true`)
* For the development compose, enable manually: `CACHE_ENABLED=true`
* Configure `CACHE_URL` to point to your Redis instance (or use a managed Redis service)

### Database Migrations

* Always run `uv run alembic upgrade head` after updating Honcho before starting the server
* Check current migration status with `uv run alembic current`

### LLM Providers

* Ensure your API keys are configured (see [LLM Setup](#llm-setup))
* For alternative providers or per-feature model overrides, see the [Configuration Guide](./configuration#llm-configuration)

### Monitoring

* Enable Prometheus metrics with `METRICS_ENABLED=true`. The API exposes `/metrics` on port 8000, the deriver on port 9090 (internal to its container — not published to the host by default).
* Enable Sentry error tracking with `SENTRY_ENABLED=true`
* The development compose includes Prometheus (host port 9090) and Grafana (host port 3000) for scraping and dashboards. Uncomment those services to enable them.

### Backups

* Set up regular PostgreSQL backups:
  ```bash  theme={null}
  # One-off backup
  docker compose exec database pg_dump -U postgres postgres > backup-$(date +%Y%m%d).sql

  # Restore
  cat backup.sql | docker compose exec -T database psql -U postgres postgres
  ```
* Back up your `.env` or `config.toml` configuration files


Built with [Mintlify](https://mintlify.com). 
> ## Documentation Index
> Fetch the complete documentation index at: https://docs.honcho.dev/llms.txt
> Use this file to discover all available pages before exploring further.

# Configuration Guide

> Complete reference for configuring Honcho providers, features, and infrastructure

<Info>
  Most users only need the setup from the [Self-Hosting Guide](./self-hosting#llm-setup). This page is the full reference for customizing providers, tuning features, and hardening your deployment.
</Info>

Honcho loads configuration in this priority order (highest wins):

1. **Environment variables** (always take precedence)
2. **`.env` file**
3. **`config.toml` file**
4. **Built-in defaults**

Use `.env` for secrets and overrides, `config.toml` for base settings. Or use environment variables exclusively — whatever fits your deployment. Copy the examples to get started:

```bash  theme={null}
cp .env.template .env
cp config.toml.example config.toml
```

### Environment Variable Naming

All config values map to environment variables:

* `{SECTION}_{KEY}` for section settings (e.g., `DB_CONNECTION_URI` → `[db].CONNECTION_URI`)
* `{KEY}` for app-level settings (e.g., `LOG_LEVEL` → `[app].LOG_LEVEL`)
* `{SECTION}__{NESTED}__{KEY}` for deeply nested settings (double underscore, e.g., `DIALECTIC_LEVELS__minimal__PROVIDER`)

## LLM Configuration

The [Self-Hosting Guide](./self-hosting#llm-setup) covers the basic setup: one OpenAI-compatible endpoint, one model for all features. This section covers recommended model tiers, using multiple providers, and per-feature tuning.

<Note>
  All Honcho agents (deriver, dialectic, dream) require tool calling. Your models must support the OpenAI tool calling format.
</Note>

### Choosing Models

Model choice matters more for tool-use reliability than raw intelligence:

| Tier       | Example models                  | Use case                                | Notes                                     |
| ---------- | ------------------------------- | --------------------------------------- | ----------------------------------------- |
| **Light**  | Gemini 2.5 Flash, GLM-4.7-Flash | Deriver, summary, dialectic minimal/low | High throughput, cheap, reliable tool use |
| **Medium** | Claude Haiku 4.5, Grok 4.1 Fast | Dialectic medium/high                   | Good reasoning + tool use balance         |
| **Heavy**  | Claude Sonnet 4, GLM-5          | Dream, dialectic max                    | Best quality for rare/complex tasks       |

You can mix providers freely — for example, use Gemini for the deriver and Claude for dreaming.

### Provider Types

| Provider value | What it connects to                                                               | Key env var                                                        |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `custom`       | Any OpenAI-compatible endpoint (OpenRouter, Together, Fireworks, LiteLLM, Ollama) | `LLM_OPENAI_COMPATIBLE_API_KEY` + `LLM_OPENAI_COMPATIBLE_BASE_URL` |
| `vllm`         | vLLM self-hosted models                                                           | `LLM_VLLM_API_KEY` + `LLM_VLLM_BASE_URL`                           |
| `google`       | Google Gemini (direct)                                                            | `LLM_GEMINI_API_KEY`                                               |
| `anthropic`    | Anthropic Claude (direct)                                                         | `LLM_ANTHROPIC_API_KEY`                                            |
| `openai`       | OpenAI (direct)                                                                   | `LLM_OPENAI_API_KEY`                                               |
| `groq`         | Groq (direct)                                                                     | `LLM_GROQ_API_KEY`                                                 |

### Tiered Model Setup

Once you're past initial setup, you can assign different models per feature for better cost/quality tradeoffs. This example uses OpenRouter with light/medium/heavy tiers:

```bash  theme={null}
LLM_OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1
LLM_OPENAI_COMPATIBLE_API_KEY=sk-or-v1-...

# Light tier — high throughput, cheap
DERIVER_PROVIDER=custom
DERIVER_MODEL=google/gemini-2.5-flash-lite
SUMMARY_PROVIDER=custom
SUMMARY_MODEL=google/gemini-2.5-flash
DIALECTIC_LEVELS__minimal__PROVIDER=custom
DIALECTIC_LEVELS__minimal__MODEL=google/gemini-2.5-flash-lite
DIALECTIC_LEVELS__low__PROVIDER=custom
DIALECTIC_LEVELS__low__MODEL=google/gemini-2.5-flash-lite

# Medium tier — better reasoning
DIALECTIC_LEVELS__medium__PROVIDER=custom
DIALECTIC_LEVELS__medium__MODEL=anthropic/claude-haiku-4-5
DIALECTIC_LEVELS__high__PROVIDER=custom
DIALECTIC_LEVELS__high__MODEL=anthropic/claude-haiku-4-5
DIALECTIC_LEVELS__max__PROVIDER=custom
DIALECTIC_LEVELS__max__MODEL=anthropic/claude-haiku-4-5

# Heavy tier — best quality for complex tasks
DREAM_PROVIDER=custom
DREAM_MODEL=anthropic/claude-sonnet-4-20250514
DREAM_DEDUCTION_MODEL=anthropic/claude-haiku-4-5
DREAM_INDUCTION_MODEL=anthropic/claude-haiku-4-5
```

### Direct Vendor Keys

Instead of an OpenAI-compatible proxy, you can use vendor APIs directly. Leave `PROVIDER` overrides unset and the code defaults route per feature:

```bash  theme={null}
LLM_GEMINI_API_KEY=...       # deriver, summary, dialectic minimal/low
LLM_ANTHROPIC_API_KEY=...    # dialectic medium/high/max, dream
LLM_OPENAI_API_KEY=...       # embeddings
```

### Self-Hosted (vLLM / Ollama)

```bash  theme={null}
# vLLM
LLM_VLLM_BASE_URL=http://localhost:8000/v1
LLM_VLLM_API_KEY=not-needed
DERIVER_PROVIDER=vllm
DERIVER_MODEL=your-model-name

# Ollama (uses custom provider)
LLM_OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1
LLM_OPENAI_COMPATIBLE_API_KEY=ollama
DERIVER_PROVIDER=custom
DERIVER_MODEL=llama3.3:70b
```

Set `PROVIDER` and `MODEL` for each feature the same way.

### Thinking Budget

Default configs use `THINKING_BUDGET_TOKENS` tuned for Anthropic models. Non-Anthropic providers don't support extended thinking and will error or silently fail. The [Self-Hosting Guide](./self-hosting#llm-setup) sets these to `0` by default. If you switch to Anthropic models, you can re-enable them:

```bash  theme={null}
# Anthropic models — enable thinking
DERIVER_THINKING_BUDGET_TOKENS=1024
SUMMARY_THINKING_BUDGET_TOKENS=512
DREAM_THINKING_BUDGET_TOKENS=8192
DIALECTIC_LEVELS__medium__THINKING_BUDGET_TOKENS=1024
DIALECTIC_LEVELS__high__THINKING_BUDGET_TOKENS=1024
DIALECTIC_LEVELS__max__THINKING_BUDGET_TOKENS=2048
# minimal and low stay at 0
```

### General LLM Settings

```bash  theme={null}
LLM_DEFAULT_MAX_TOKENS=2500

# Embedding provider (used when EMBED_MESSAGES=true)
LLM_EMBEDDING_PROVIDER=openai  # Options: openai, gemini, openrouter

# Tool output limits (to prevent token explosion)
LLM_MAX_TOOL_OUTPUT_CHARS=10000  # ~2500 tokens at 4 chars/token
LLM_MAX_MESSAGE_CONTENT_CHARS=2000  # Max chars per message in tool results
```

### Feature-Specific Model Configuration

Each feature can use a different provider and model. Below are all the tuning knobs.

**Dialectic API:**

The Dialectic API provides theory-of-mind informed responses. It uses a tiered reasoning system with five levels:

```bash  theme={null}
# Global dialectic settings
DIALECTIC_MAX_OUTPUT_TOKENS=8192
DIALECTIC_MAX_INPUT_TOKENS=100000
DIALECTIC_HISTORY_TOKEN_LIMIT=8192
DIALECTIC_SESSION_HISTORY_MAX_TOKENS=4096
```

**Per-Level Configuration:**

Each reasoning level has its own provider, model, and settings:

```toml  theme={null}
# config.toml example
[dialectic.levels.minimal]
PROVIDER = "google"
MODEL = "gemini-2.5-flash-lite"
THINKING_BUDGET_TOKENS = 0
MAX_TOOL_ITERATIONS = 1
MAX_OUTPUT_TOKENS = 250
TOOL_CHOICE = "any"

[dialectic.levels.low]
PROVIDER = "google"
MODEL = "gemini-2.5-flash-lite"
THINKING_BUDGET_TOKENS = 0
MAX_TOOL_ITERATIONS = 5
TOOL_CHOICE = "any"

[dialectic.levels.medium]
PROVIDER = "anthropic"
MODEL = "claude-haiku-4-5"
THINKING_BUDGET_TOKENS = 1024
MAX_TOOL_ITERATIONS = 2

[dialectic.levels.high]
PROVIDER = "anthropic"
MODEL = "claude-haiku-4-5"
THINKING_BUDGET_TOKENS = 1024
MAX_TOOL_ITERATIONS = 4

[dialectic.levels.max]
PROVIDER = "anthropic"
MODEL = "claude-haiku-4-5"
THINKING_BUDGET_TOKENS = 2048
MAX_TOOL_ITERATIONS = 10
```

Environment variables for nested levels use double underscores:

```bash  theme={null}
DIALECTIC_LEVELS__minimal__PROVIDER=google
DIALECTIC_LEVELS__minimal__MODEL=gemini-2.5-flash-lite
DIALECTIC_LEVELS__minimal__THINKING_BUDGET_TOKENS=0
DIALECTIC_LEVELS__minimal__MAX_TOOL_ITERATIONS=1
```

**Deriver (Theory of Mind):**

The Deriver extracts facts from messages and builds theory-of-mind representations of peers.

```bash  theme={null}
DERIVER_ENABLED=true

# LLM settings
DERIVER_PROVIDER=google
DERIVER_MODEL=gemini-2.5-flash-lite
DERIVER_MAX_OUTPUT_TOKENS=4096
DERIVER_THINKING_BUDGET_TOKENS=1024
DERIVER_MAX_INPUT_TOKENS=23000
DERIVER_TEMPERATURE=  # Optional override (unset by default)

# Worker settings
DERIVER_WORKERS=1  # Increase for higher throughput
DERIVER_POLLING_SLEEP_INTERVAL_SECONDS=1.0
DERIVER_STALE_SESSION_TIMEOUT_MINUTES=5

# Queue management
DERIVER_QUEUE_ERROR_RETENTION_SECONDS=2592000  # 30 days

# Observation settings
DERIVER_DEDUPLICATE=true
DERIVER_LOG_OBSERVATIONS=false
DERIVER_WORKING_REPRESENTATION_MAX_OBSERVATIONS=100
DERIVER_REPRESENTATION_BATCH_MAX_TOKENS=1024
```

**Peer Card:**

```bash  theme={null}
PEER_CARD_ENABLED=true
```

**Summary Generation:**

Session summaries provide compressed context for long conversations — short summaries (frequent) and long summaries (comprehensive).

```bash  theme={null}
SUMMARY_ENABLED=true
SUMMARY_PROVIDER=google
SUMMARY_MODEL=gemini-2.5-flash
SUMMARY_MAX_TOKENS_SHORT=1000
SUMMARY_MAX_TOKENS_LONG=4000
SUMMARY_THINKING_BUDGET_TOKENS=512
SUMMARY_MESSAGES_PER_SHORT_SUMMARY=20
SUMMARY_MESSAGES_PER_LONG_SUMMARY=60
```

**Dream Processing:**

Dream processing consolidates and refines peer representations during idle periods.

```bash  theme={null}
DREAM_ENABLED=true
DREAM_DOCUMENT_THRESHOLD=50
DREAM_IDLE_TIMEOUT_MINUTES=60
DREAM_MIN_HOURS_BETWEEN_DREAMS=8
DREAM_ENABLED_TYPES=["omni"]

# LLM settings
DREAM_PROVIDER=anthropic
DREAM_MODEL=claude-sonnet-4-20250514
DREAM_MAX_OUTPUT_TOKENS=16384
DREAM_THINKING_BUDGET_TOKENS=8192
DREAM_MAX_TOOL_ITERATIONS=20
DREAM_HISTORY_TOKEN_LIMIT=16384

# Specialist models (use same provider as main model)
DREAM_DEDUCTION_MODEL=claude-haiku-4-5
DREAM_INDUCTION_MODEL=claude-haiku-4-5
```

**Surprisal-Based Sampling (Advanced):**

Optional subsystem for identifying unusual observations during dreaming:

```bash  theme={null}
DREAM_SURPRISAL__ENABLED=false
DREAM_SURPRISAL__TREE_TYPE=kdtree
DREAM_SURPRISAL__TREE_K=5
DREAM_SURPRISAL__SAMPLING_STRATEGY=recent
DREAM_SURPRISAL__SAMPLE_SIZE=200
DREAM_SURPRISAL__TOP_PERCENT_SURPRISAL=0.10
DREAM_SURPRISAL__MIN_HIGH_SURPRISAL_FOR_REPLACE=10
DREAM_SURPRISAL__INCLUDE_LEVELS=["explicit", "deductive"]
```

## Core Configuration

### Application Settings