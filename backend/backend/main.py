import asyncio
import contextlib

from fastapi import FastAPI, Path
from fastapi.middleware.cors import CORSMiddleware

from .cache import TTLCache
from .models import GraphData, ScanResult
from .scanner import ROS2DomainScanner

scanner: ROS2DomainScanner | None = None
cache = TTLCache(ttl=1.0)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    global scanner
    scanner = ROS2DomainScanner()

    # Background task to clean up stale domain nodes
    async def cleanup_loop():
        while True:
            await asyncio.sleep(30)
            if scanner:
                scanner.cleanup_stale(max_age=60.0)

    task = asyncio.create_task(cleanup_loop())

    yield

    task.cancel()
    if scanner:
        scanner.shutdown()


app = FastAPI(title="ROS2 Dashboard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/scan/{domain_id}", response_model=ScanResult)
async def scan_domain(domain_id: int = Path(ge=0, le=232)):
    assert scanner is not None

    def do_scan():
        return scanner.scan_all(domain_id)

    result = await asyncio.to_thread(
        cache.get_or_compute, f"scan:{domain_id}", do_scan
    )
    return result


@app.get("/api/v1/graph/{domain_id}", response_model=GraphData)
async def get_graph(domain_id: int = Path(ge=0, le=232)):
    assert scanner is not None

    def do_graph():
        return scanner.get_graph(domain_id)

    result = await asyncio.to_thread(
        cache.get_or_compute, f"graph:{domain_id}", do_graph
    )
    return result


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
