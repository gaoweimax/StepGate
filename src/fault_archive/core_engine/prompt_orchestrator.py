import json
from collections.abc import AsyncIterator
from typing import Any

import httpx


SYSTEM_PROMPT = """\
你是“谬误档案馆”的首席档案记录员。你必须以严肃、克制、一本正经的纪实口吻，
记录一段由错误假设引发的荒谬历史。文风应有历史厚重感，细节曲折，包含失败、
误会与偶然性；不得把真实结论说成错误，也不得宣称虚构事件是真实史实。

将用户给出的结论视为绝对正确的现实锚点。围绕它构造一段伪历史档案，并严格按
以下四部分顺序输出，不要添加前言、总结或 Markdown 代码围栏。每部分使用独立行
上的阶段标记（供档案终端解析），下一行必须是指定标题：

<<<STAGE:ANCHOR>>>
【档案编号：XXX】
<<<STAGE:HYPOTHESIS>>>
【错误假设】：描述一个表面合理、实际极其愚蠢的早期假设。
<<<STAGE:FAILURE>>>
【灾难实验】：描述该错误假设如何导致惨烈、曲折且带有误会的失败。
<<<STAGE:DISCOVERY>>>
【意外发现】：描述真理如何在一连串错误中被偶然发现，并回扣用户给出的正确结论。

档案编号应为独特的字母数字编号。四部分都要具体、有因果衔接；语气始终严肃，
荒谬感来自事实与推理的错位，不来自插科打诨。使用与用户输入相同的语言。
"""


def build_chat_completion_payload(
    truth: str,
    style_key: str,
    model: str,
) -> dict[str, Any]:
    """Build the OpenAI-compatible streaming request for one archive."""
    return {
        "model": model,
        "stream": True,
        "temperature": 0.9,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"正确结论（必须作为真实锚点）：{truth}\n"
                    f"叙事风格参考：{style_key}"
                ),
            },
        ],
    }


async def iter_completion_text(response: httpx.Response) -> AsyncIterator[str]:
    """Yield text deltas from an OpenAI-compatible SSE response."""
    async for line in response.aiter_lines():
        if not line.startswith("data:"):
            continue

        data = line[5:].strip()
        if not data:
            continue
        if data == "[DONE]":
            return

        try:
            payload = json.loads(data)
        except json.JSONDecodeError as exc:
            raise ValueError("LLM provider returned malformed streaming data") from exc

        if "error" in payload:
            raise ValueError("LLM provider reported a streaming error")

        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices:
            continue
        delta = choices[0].get("delta", {})
        content = delta.get("content") if isinstance(delta, dict) else None
        if isinstance(content, str) and content:
            yield content
