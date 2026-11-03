"""SSE API：以兼容前端消费格式的事件流输出逆向历史。"""

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from fault_archive.api_gateways.payload_schema import ArchiveRequest

router = APIRouter(prefix="/api/v1/archive", tags=["archive"])


async def _stream_narrative(truth_input: str) -> AsyncIterator[str]:
    """逐小段输出演示故事；接入模型后可替换此生成器。"""

    narrative = (
        f"档案室的另一份记录显示：「{truth_input}」发生时，"
        "历史本身正忙着填写一张更正申请。申请在时间线上绕行了三百年，"
        "最终被一只不愿配合的鸽子盖章退回。于是，所有人都记住了原来的版本，"
        "而这份档案被悄悄归入了“越解释越可疑”一栏。"
    )

    for offset in range(0, len(narrative), 4):
        chunk = narrative[offset : offset + 4]
        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        await asyncio.sleep(0.025)

    yield "data: [DONE]\n\n"


@router.post("/stream")
async def stream_archive(request: ArchiveRequest) -> StreamingResponse:
    """接收事实并返回 SSE 事件流。"""

    truth_input = request.truth_input.strip()
    if not truth_input:
        raise HTTPException(status_code=422, detail="truth_input 不能为空。")

    return StreamingResponse(
        _stream_narrative(truth_input),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )