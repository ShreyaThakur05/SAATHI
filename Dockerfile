# Root-level Dockerfile for hosts that build from the repo root (e.g. a Render web service created by hand).
# The Render Blueprint (render.yaml) builds api/Dockerfile directly; this one produces the same image.
FROM python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1
WORKDIR /app
COPY api/pyproject.toml api/uv.lock api/.python-version ./
RUN uv sync --frozen --no-dev --no-install-project
COPY api/ .
RUN useradd -m saathi && chown -R saathi /app
USER saathi
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
HEALTHCHECK CMD python -c "import os, urllib.request as u; u.urlopen('http://localhost:' + os.environ.get('PORT', '8000') + '/healthz')" || exit 1
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
