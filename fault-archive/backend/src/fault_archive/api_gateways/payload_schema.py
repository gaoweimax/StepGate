"""请求体模型。"""

from pydantic import BaseModel, Field


class ArchiveRequest(BaseModel):
    """生成逆向历史所需的用户事实。"""

    truth_input: str = Field(..., min_length=1, max_length=240)