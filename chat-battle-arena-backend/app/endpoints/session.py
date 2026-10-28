from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List
from app.core.auth import auth_scheme, verify_optional_credentials
from app.core.database import get_db
from models.channel_session import ChannelSessionModel
from schemas.channel_session import ChannelSession as ChannelSessionSchema
from schemas.channel_session import ChannelSessionCreate

router = APIRouter()


def _next_session_id(db: Session) -> int:
    return (db.query(func.max(ChannelSessionModel.id)).scalar() or 0) + 1


def _ensure_channel_session(db: Session, channel_id: str) -> ChannelSessionModel:
    db_session = (
        db.query(ChannelSessionModel)
        .filter(ChannelSessionModel.channel_id == channel_id)
        .first()
    )
    if db_session:
        return db_session

    db_session = ChannelSessionModel(
        id=_next_session_id(db),
        channel_id=channel_id,
        health=50,
        name=f"Streamer {channel_id}",
        enemy_name="Auto",
        friend_code=None,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/sessions", response_model=List[ChannelSessionSchema])
def get_all_channel_sessions(db: Session = Depends(get_db)):
    return db.query(ChannelSessionModel).all()


@router.get("/sessions/{channel_id}", response_model=ChannelSessionSchema)
def get_channel_session(
    channel_id: str,
    db: Session = Depends(get_db),
    token=Depends(auth_scheme),
):
    verify_optional_credentials(token)
    return _ensure_channel_session(db, channel_id)


@router.post("/sessions", response_model=ChannelSessionSchema)
def create_channel_session(
    session: ChannelSessionCreate,
    db: Session = Depends(get_db),
    token=Depends(auth_scheme),
):
    verify_optional_credentials(token)

    db_session = _ensure_channel_session(db, session.channel_id)
    db_session.friend_code = session.friend_code
    db_session.health = session.health
    db_session.name = session.name
    db_session.enemy_name = session.enemy_name
    db.commit()
    db.refresh(db_session)
    return db_session


@router.put("/sessions/{channel_id}", response_model=ChannelSessionSchema)
def update_channel_session(
    channel_id: str,
    session: ChannelSessionCreate,
    db: Session = Depends(get_db),
    token=Depends(auth_scheme),
):
    verify_optional_credentials(token)

    db_session = _ensure_channel_session(db, channel_id)
    db_session.friend_code = session.friend_code
    db_session.health = session.health
    db_session.name = session.name
    db_session.enemy_name = session.enemy_name

    db.commit()
    db.refresh(db_session)
    return db_session
