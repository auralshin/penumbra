# Penumbra fixture — Python (tint: amber)
from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class User:
    id: int
    name: str
    active: bool = True
    tags: List[str] = field(default_factory=list)


def greet(user: User) -> Optional[str]:
    """Return a greeting if the user is active, else None."""
    if not user.active:
        return None
    return f"Hello, {user.name} ({len(user.tags)} tags)"


users = [
    User(1, "Ada", tags=["admin"]),
    User(2, "Grace", active=False),
]

if __name__ == "__main__":
    for u in users:
        msg = greet(u)
        print(msg or f"<inactive: {u.name}>")
