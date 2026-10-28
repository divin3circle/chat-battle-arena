import uuid
import socketio
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.utils import compute_damage_based_on_attack_id
from models.channel_session import ChannelSessionModel
from schemas.attack import AttackPayload

router = APIRouter()

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)


async def _emit_attack(sio, attack_data, room):
    await sio.emit("attack", attack_data, room=room)


async def _emit_damage(sio, damage_amount, side, room):
    await sio.emit("damage", {"damage": damage_amount, "side": side}, room=room)


async def _get_sessions(db, sender_session_id):
    host_session = (
        db.query(ChannelSessionModel)
        .filter(ChannelSessionModel.channel_id == sender_session_id)
        .first()
    )

    if not host_session:
        return None, None, False

    friend_session = (
        db.query(ChannelSessionModel)
        .filter(ChannelSessionModel.channel_id == host_session.friend_code)
        .first()
    )

    is_friend_session = (
        friend_session and friend_session.friend_code == host_session.channel_id
    )

    if not friend_session:
        return host_session, None, False

    return host_session, friend_session, is_friend_session


def _ensure_session(db, channel_id):
    session = (
        db.query(ChannelSessionModel)
        .filter(ChannelSessionModel.channel_id == channel_id)
        .first()
    )
    if session:
        return session

    next_id = (db.query(func.max(ChannelSessionModel.id)).scalar() or 0) + 1
    session = ChannelSessionModel(
        id=next_id,
        channel_id=channel_id,
        health=50,
        name=channel_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/spawn_attack")
async def spawn_attack(
    payload: AttackPayload,
    db: Session = Depends(get_db),
):
    _ensure_session(db, payload.sender_session_id)
    damage = compute_damage_based_on_attack_id(payload.attack_id)
    host_session, friend_session, is_friend_session = await _get_sessions(
        db, payload.sender_session_id
    )

    if not host_session:
        return {"message": "Session not found"}

    attack = {
        "id": str(uuid.uuid4()),
        "channel_id": host_session.channel_id,
        "attack_id": payload.attack_id,
        "side": "left",
        "user_name": payload.user_name,
        "damage": damage,
        "transaction_id": payload.transaction_id,
        "product_sku": payload.product_sku,
        "bits_cost": payload.bits_cost,
    }

    # emit host attack on A
    await _emit_attack(sio, attack, host_session.channel_id)

    if is_friend_session:
        # emit enemy attack on B
        attack.update({"side": "right", "channel_id": friend_session.channel_id})
        await _emit_attack(sio, attack, friend_session.channel_id)

    await sio.sleep(5)
    new_db = SessionLocal()
    host_session, friend_session, is_friend_session = await _get_sessions(
        new_db, payload.sender_session_id
    )

    if not host_session:
        return {"message": "Session not found"}

    host_session.health = min(100, host_session.health + damage)

    if is_friend_session:
        friend_session.health = max(0, friend_session.health - damage)

    if host_session.health == 100:
        await sio.emit(
            "game_over",
            {"winner": host_session.name},
            room=host_session.channel_id,
        )
        host_session.health = 50
        if is_friend_session:
            await sio.emit(
                "game_over",
                {"winner": host_session.name},
                room=friend_session.channel_id,
            )
            friend_session.health = 50
        new_db.commit()
        new_db.close()
        return {"message": "Game Over"}

    new_db.commit()
    new_db.close()
    return {"message": "Attack created with ID: {} was successful".format(attack["id"])}


@sio.event
async def connect(sid, env):
    print("Client connected:", sid)
    # Assuming the client sends the channel_id as a query parameter
    query_string = env.get("QUERY_STRING", "")
    channel_id = (
        query_string.split("channel=")[1].split("&")[0]
        if "channel=" in query_string
        else ""
    )
    await sio.enter_room(sid, channel_id)
    db = SessionLocal()

    # Fetch current session from database
    session = (
        db.query(ChannelSessionModel)
        .filter(ChannelSessionModel.channel_id == channel_id)
        .first()
    )

    if not session:
        # Create new session with default health of 50
        session = _ensure_session(db, channel_id)

    # Initialize session data with database values
    session_data = {
        "leftName": session.name,
        "rightName": "Auto",
        "health": session.health if session else 50,
    }

    if session.friend_code:
        # Fetch friend session from database
        friend_session = (
            db.query(ChannelSessionModel)
            .filter(ChannelSessionModel.channel_id == session.friend_code)
            .first()
        )

        if friend_session:
            session_data["rightName"] = friend_session.name

    db.close()
    await sio.emit("initialize", session_data, to=sid)


@sio.event
async def disconnect(sid):
    print("Client disconnected:", sid)
    # You may want to handle room leaving logic here if necessary
