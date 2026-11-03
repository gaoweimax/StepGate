export type StreamCallbacks = {
  onText: (text: string) => void;
  onDone: () => void;
};

const textKeys = ["token", "content", "text", "delta", "chunk", "output", "narrative", "message"];

function extractText(data: string): string {
  if (data === "[DONE]") return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return data;
  }
  if (typeof parsed === "string") return parsed;
  if (!parsed || typeof parsed !== "object") return "";
  const record = parsed as Record<string, unknown>;
  if (typeof record.error === "string") throw new Error(record.error);
  for (const key of textKeys) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const delta = (choices[0] as Record<string, unknown>).delta;
    if (delta && typeof delta === "object") {
      const content = (delta as Record<string, unknown>).content;
      if (typeof content === "string") return content;
    }
  }
  return "";
}

function consumeFrame(frame: string, callbacks: StreamCallbacks): boolean {
  const lines = frame.split(/\r\n|\r|\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return false;
  if (event === "error") throw new Error(data);
  if (data === "[DONE]") {
    callbacks.onDone();
    return true;
  }
  const text = extractText(data);
  if (text) callbacks.onText(text);
  return false;
}

export async function consumeSseResponse(
  response: Response,
  callbacks: StreamCallbacks,
  signal: AbortSignal,
): Promise<void> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `请求失败（HTTP ${response.status}）`);
  }
  if (!response.body) throw new Error("服务器未返回可读取的流。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let delimiter = /\r\n\r\n|\n\n|\r\r/;
    let match = delimiter.exec(buffer);
    while (match) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      if (consumeFrame(frame, callbacks)) {
        await reader.cancel();
        return;
      }
      delimiter = /\r\n\r\n|\n\n|\r\r/;
      match = delimiter.exec(buffer);
    }
  }
  if (signal.aborted) return;
  buffer += decoder.decode();
  if (buffer.trim()) consumeFrame(buffer, callbacks);
  if (signal.aborted) return;
  callbacks.onDone();
}