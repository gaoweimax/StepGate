import { useCallback, useRef, useState } from "react";
import { consumeSseResponse } from "../services/sse_consumer";

export type StreamStatus = "idle" | "connecting" | "streaming" | "complete" | "error";

export function useArchiveStream() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus((current) => (current === "connecting" || current === "streaming" ? "idle" : current));
  }, []);

  const generate = useCallback(async (truthInput: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setText("");
    setError("");
    setStatus("connecting");
    console.info("[Fault Archive] Generate requested", { endpoint: import.meta.env.VITE_ARCHIVE_STREAM_URL || "/api/v1/archive/stream" });
    try {
      const endpoint = import.meta.env.VITE_ARCHIVE_STREAM_URL || "/api/v1/archive/stream";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
        body: JSON.stringify({ truth_input: truthInput }),
        signal: controller.signal,
      });
      console.info("[Fault Archive] Stream response", response.status, response.headers.get("content-type"));
      await consumeSseResponse(
        response,
        {
          onText: (chunk) => {
            setStatus("streaming");
            setText((current) => current + chunk);
          },
          onDone: () => setStatus("complete"),
        },
        controller.signal,
      );
    } catch (reason) {
      if (controller.signal.aborted) return;
      const message = reason instanceof Error ? reason.message : "生成失败，请稍后重试。";
      console.error("[Fault Archive] Stream request failed", reason);
      setError(message);
      setStatus("error");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  return { text, status, error, generate, stop };
}
