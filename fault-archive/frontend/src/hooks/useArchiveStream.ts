import { useCallback, useRef, useState } from "react";
import { consumeSseResponse } from "../services/sse_consumer";

export type StreamStatus = "idle" | "connecting" | "streaming" | "complete" | "error";

const API_URL =
  import.meta.env.VITE_ARCHIVE_STREAM_URL ||
  "http://127.0.0.1:8000/api/v1/generate";

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
    console.info("[Fault Archive] Generate requested", { endpoint: API_URL });
    try {
      const response = await fetch(API_URL, {
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
      const message =
        reason instanceof TypeError
          ? `无法连接生成服务（${API_URL}）。请确认后端已启动，并检查网络与 CORS 配置。浏览器详情：${reason.message}`
          : reason instanceof Error
            ? reason.message
            : `生成失败，请检查后端连接。${String(reason)}`;
      console.error("[Fault Archive] Stream request failed", reason);
      setError(message);
      setStatus("error");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  return { text, status, error, generate, stop };
}
