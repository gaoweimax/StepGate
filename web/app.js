(() => {
  "use strict";

  const API_URL = new URL("/api/v1/generate", window.location.origin);
  const form = document.querySelector("#archive-form");
  const truthInput = document.querySelector("#truth");
  const styleSelect = document.querySelector("#style-key");
  const generateButton = document.querySelector("#generate");
  const buttonLabel = document.querySelector(".button-label");
  const output = document.querySelector("#output");
  const status = document.querySelector("#stream-status");
  const markerStart = "<<<STAGE:";
  const stageClasses = {
    ANCHOR: "stage-anchor",
    HYPOTHESIS: "stage-hypothesis",
    FAILURE: "stage-failure",
    DISCOVERY: "stage-discovery",
  };

  let audioContext;
  let textBuffer = "";
  let sseBuffer = "";
  let currentStage = "stage-anchor";
  let activeSpan;
  let outputQueue = [];
  let typingTimer;
  let streamFinished = false;

  function unlockAudio() {
    if (!window.AudioContext) return Promise.resolve();
    audioContext ??= new AudioContext();
    return audioContext.state === "suspended" ? audioContext.resume() : Promise.resolve();
  }

  function playTone(frequency, duration = 0.018, volume = 0.009) {
    if (!audioContext || audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function queueText(text, className = currentStage) {
    for (const character of text) outputQueue.push({ character, className });
    pumpOutput();
  }

  function pumpOutput() {
    if (typingTimer) return;
    const next = outputQueue.shift();
    if (!next) {
      if (streamFinished) {
        generateButton.disabled = false;
        buttonLabel.textContent = "再次解密";
        status.textContent = "解密完成 // ARCHIVE SEALED";
      }
      return;
    }

    if (!activeSpan || activeSpan.className !== `stream-text ${next.className}`) {
      activeSpan = document.createElement("span");
      activeSpan.className = `stream-text ${next.className}`;
      output.append(activeSpan);
    }
    activeSpan.textContent += next.character;
    output.scrollTop = output.scrollHeight;
    playTone(780 + Math.random() * 180, 0.012, 0.004);
    typingTimer = window.setTimeout(() => {
      typingTimer = undefined;
      pumpOutput();
    }, 14);
  }

  function longestMarkerPrefixSuffix(text) {
    const maxLength = Math.min(markerStart.length - 1, text.length);
    for (let length = maxLength; length > 0; length -= 1) {
      if (text.endsWith(markerStart.slice(0, length))) return length;
    }
    return 0;
  }

  function consumeText(chunk, flush = false) {
    textBuffer += chunk;
    while (textBuffer) {
      const markerIndex = textBuffer.indexOf(markerStart);
      if (markerIndex < 0) {
        if (flush) {
          queueText(textBuffer);
          textBuffer = "";
          return;
        }
        const heldLength = longestMarkerPrefixSuffix(textBuffer);
        const visibleLength = textBuffer.length - heldLength;
        if (visibleLength) queueText(textBuffer.slice(0, visibleLength));
        textBuffer = heldLength ? textBuffer.slice(-heldLength) : "";
        return;
      }

      if (markerIndex > 0) queueText(textBuffer.slice(0, markerIndex));
      textBuffer = textBuffer.slice(markerIndex);
      const markerEnd = textBuffer.indexOf(">>>");
      if (markerEnd < 0) return;

      const stageName = textBuffer.slice(markerStart.length, markerEnd);
      textBuffer = textBuffer.slice(markerEnd + 3);
      currentStage = stageClasses[stageName] || "stage-discovery";
      queueText(`\n[${stageName}]\n`, currentStage);
    }
  }

  function consumeSseFrame(frame) {
    let eventName = "message";
    const data = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }

    if (eventName === "error") {
      let message = "服务端流式生成失败。";
      try {
        message = JSON.parse(data.join("\n")).error || message;
      } catch {
        // Keep the generic message for malformed error events.
      }
      throw new Error(message);
    }
    if (data.length) consumeText(data.join("\n"));
  }

  async function generate(event) {
    event.preventDefault();
    const truth = truthInput.value.trim();
    if (!truth) {
      truthInput.focus();
      return;
    }

    if (typingTimer) window.clearTimeout(typingTimer);
    typingTimer = undefined;
    textBuffer = "";
    sseBuffer = "";
    outputQueue = [];
    activeSpan = undefined;
    currentStage = "stage-anchor";
    streamFinished = false;
    output.replaceChildren();
    generateButton.disabled = true;
    buttonLabel.textContent = "解密中...";
    status.textContent = "正在连接时间线...";

    try {
      await unlockAudio();
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ truth, style_key: styleSelect.value }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `HTTP ${response.status}`);
      }
      if (!response.body) throw new Error("服务端没有返回可读取的数据流。");

      status.textContent = "已连接 // 正在解密";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        sseBuffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
        let frameEnd = sseBuffer.indexOf("\n\n");
        while (frameEnd >= 0) {
          consumeSseFrame(sseBuffer.slice(0, frameEnd));
          sseBuffer = sseBuffer.slice(frameEnd + 2);
          frameEnd = sseBuffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (sseBuffer) consumeSseFrame(sseBuffer);
      consumeText("", true);
      streamFinished = true;
      pumpOutput();
    } catch (error) {
      console.error("[Fault Archive] Stream request failed", error);
      currentStage = "stream-error";
      queueText(`\n连接失败：${error instanceof Error ? error.message : String(error)}\n`);
      streamFinished = true;
      status.textContent = "连接失败 // CHECK API";
      pumpOutput();
    }
  }

  generateButton.addEventListener("pointerenter", () => {
    unlockAudio()
      .then(() => playTone(520, 0.045, 0.007))
      .catch((error) => console.warn("[Fault Archive] Audio feedback unavailable", error));
  });
  form.addEventListener("submit", generate);
})();
