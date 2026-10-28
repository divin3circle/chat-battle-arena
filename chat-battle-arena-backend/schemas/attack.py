from typing import Optional
from pydantic import BaseModel


class AttackPayload(BaseModel):
    sender_session_id: str
    attack_id: int
    user_name: str
    transaction_id: Optional[str] = None
    product_sku: Optional[str] = None
    bits_cost: Optional[int] = None
