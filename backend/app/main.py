"""FastAPI entry point for the ResiliCity MVP."""

# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
import networkx as nx
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from app.graph_repository import get_graph, get_network_graph
from app.models import Graph
from app.settings import get_allowed_origins


API_VERSION = "0.2.0"


class HealthResponse(BaseModel):
    status: str
    service: str
    api_version: str
    graph_version: str


class TopologyResponse(BaseModel):
    graph_version: str
    engine: str
    nodes: int
    edges: int
    weakly_connected_components: int
    strongly_connected_components: int
    isolates: int
    density: float


app = FastAPI(
    title="ResiliCity API",
    description="Deterministic infrastructure resilience scenario API.",
    version=API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type", "X-Request-ID"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="resilicity-api",
        api_version=API_VERSION,
        graph_version=get_graph().graph_version,
    )


@app.get("/graph", response_model=Graph, tags=["network"])
def graph() -> Graph:
    """Return the validated, locally cached OSM-backed graph."""
    return get_graph()


@app.get("/graph/topology", response_model=TopologyResponse, tags=["network"])
def graph_topology() -> TopologyResponse:
    """Return topology metrics computed from the cached NetworkX graph."""
    graph = get_graph()
    network = get_network_graph()
    return TopologyResponse(
        graph_version=graph.graph_version,
        engine=f"NetworkX {nx.__version__}",
        nodes=network.number_of_nodes(),
        edges=network.number_of_edges(),
        weakly_connected_components=nx.number_weakly_connected_components(network),
        strongly_connected_components=nx.number_strongly_connected_components(network),
        isolates=len(list(nx.isolates(network))),
        density=round(nx.density(network), 6),
    )


# pyrefly: ignore [missing-import]
from fastapi import HTTPException
from app.cascade import CascadeRequest, simulate
from app.prediction import PredictionRequest, ImpactPrediction, predict_impact


@app.post('/cascade', tags=['simulation'])
def cascade(request: CascadeRequest) -> dict:
    try:
        return simulate(get_graph(), request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post('/predict', response_model=ImpactPrediction, tags=['analytics'])
def predict(request: PredictionRequest) -> ImpactPrediction:
    try:
        return predict_impact(get_graph(), request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


from app.optimize import OptimizationRequest, optimize_impact

@app.post('/optimize', tags=['simulation'])
def optimize(request: OptimizationRequest) -> dict:
    try:
        return optimize_impact(get_graph(), request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


