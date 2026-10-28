from sqlalchemy import Column, Integer, String
from app.core.database import Base


class ChannelSessionModel(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String(255), primary_key=True)
    name = Column(String(45), nullable=True)
    enemy_name = Column(String(45), nullable=True)
    health = Column(Integer)
    friend_code = Column(String, nullable=True)
