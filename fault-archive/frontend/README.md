# Fault Archive frontend

## Run locally

```sh
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`. The browser sends the stream
request directly to `http://127.0.0.1:8000/api/v1/generate`; the API allows
local development requests through CORS.

Start the API in a second terminal:

```sh
cd ../backend
python -m pip install -e ".[test]"
python -m uvicorn fault_archive.application_bootstrap:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Set `VITE_ARCHIVE_STREAM_URL` in `.env.local` to override the API URL. Restart
Vite after changing the environment file.

The stream request is a `POST` with JSON `{ "truth_input": "..." }` and an
`Accept: text/event-stream` header. The response is parsed as SSE; `data:` events
may contain plain text, JSON with a `token`, `content`, `text`, `delta`, `chunk`,
`output`, `narrative`, or `message` field, or OpenAI-style `choices[0].delta.content`.
An `event: error` / JSON `error` field reports a failed generation, and
`data: [DONE]` ends the stream. The current backend provides a demo counter-
history stream so the full UI works without external model credentials. Replace
the narrative generator in `backend/src/fault_archive/api_gateways/sse_endpoints.py`
when wiring a model provider.
