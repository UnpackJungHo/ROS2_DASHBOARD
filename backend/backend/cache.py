import time
import threading
from typing import TypeVar, Callable

T = TypeVar("T")


class TTLCache:
    """Simple TTL cache for scan results."""

    def __init__(self, ttl: float = 1.0):
        self._ttl = ttl
        self._store: dict[str, tuple[float, object]] = {}
        self._lock = threading.Lock()

    def get_or_compute(self, key: str, compute_fn: Callable[[], T]) -> T:
        with self._lock:
            if key in self._store:
                ts, value = self._store[key]
                if time.time() - ts < self._ttl:
                    return value  # type: ignore

        result = compute_fn()

        with self._lock:
            self._store[key] = (time.time(), result)

        return result

    def invalidate(self, key: str | None = None):
        with self._lock:
            if key is None:
                self._store.clear()
            else:
                self._store.pop(key, None)
