import json
import uuid
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# In-memory room store — resets on server restart, fine for MVP
rooms: Dict[str, Set[WebSocket]] = {}
room_players: Dict[str, Dict[str, dict]] = {}  # room_id → {player_id → {progress, wpm, finished}}


@router.websocket("/race/{room_id}")
async def race_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    player_id = str(uuid.uuid4())[:8]

    if room_id not in rooms:
        rooms[room_id] = set()
        room_players[room_id] = {}

    rooms[room_id].add(websocket)
    room_players[room_id][player_id] = {"progress": 0, "wpm": 0, "finished": False}

    await broadcast(room_id, {"type": "joined", "playerId": player_id, "total": len(rooms[room_id])})

    try:
        async for raw in websocket.iter_text():
            msg = json.loads(raw)
            if msg.get("type") == "progress":
                room_players[room_id][player_id]["progress"] = msg.get("wordsCompleted", 0)
                room_players[room_id][player_id]["wpm"] = msg.get("wpm", 0)
                await broadcast(room_id, {
                    "type": "update",
                    "players": room_players[room_id],
                })
            elif msg.get("type") == "finished":
                room_players[room_id][player_id]["finished"] = True
                await broadcast(room_id, {
                    "type": "finished",
                    "playerId": player_id,
                    "wpm": msg.get("wpm", 0),
                    "players": room_players[room_id],
                })
    except WebSocketDisconnect:
        rooms[room_id].discard(websocket)
        room_players[room_id].pop(player_id, None)
        if not rooms[room_id]:
            del rooms[room_id]
            del room_players[room_id]
        else:
            await broadcast(room_id, {"type": "left", "playerId": player_id, "total": len(rooms[room_id])})


async def broadcast(room_id: str, data: dict) -> None:
    if room_id not in rooms:
        return
    dead: Set[WebSocket] = set()
    for ws in rooms[room_id]:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            dead.add(ws)
    rooms[room_id] -= dead
