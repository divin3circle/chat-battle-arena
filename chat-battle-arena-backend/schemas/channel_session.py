from typing import Optional
from pydantic import BaseModel


class ChannelSessionBase(BaseModel):
    channel_id: str
    friend_code: Optional[str]
    name: Optional[str]
    enemy_name: Optional[str]
    health: int


class ChannelSessionCreate(ChannelSessionBase):
    pass


class ChannelSession(ChannelSessionBase):
    id: int

    class Config:
        orm_mode = True
