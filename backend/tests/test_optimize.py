
# pyrefly: ignore [missing-import]
import pytest
from app.optimize import OptimizationRequest, optimize_impact, MCTSOptimizer, MCTSNode
from app.models import Graph
from app.graph_repository import get_graph

@pytest.fixture
def graph():
    return get_graph()

def test_mcts_node_creation():
    node = MCTSNode(state=frozenset(["n1"]))
    assert node.state == frozenset(["n1"])
    assert node.parent is None
    assert node.visits == 0
    assert not node.is_terminal
    assert node.is_fully_expanded()

def test_mcts_selection_and_expansion(graph: Graph):
    # Select a node to inject failure that has protectable children
    req = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id="hospital-st-marys",
        severity="severe",
        budget=2,
        duration_steps=6,
        seed=123
    )
    optimizer = MCTSOptimizer(graph, req)
    
    actions = optimizer.generate_legal_actions(frozenset())
    assert len(actions) > 0
    assert "hospital-st-marys" not in actions # Should not protect the root of failure
    
    root = MCTSNode(state=frozenset())
    root.untried_actions = optimizer.generate_legal_actions(root.state)
    
    # Simulate expansion
    action = root.untried_actions.pop()
    child = MCTSNode(state=frozenset([action]), parent=root, action=action)
    root.children[action] = child
    
    assert not root.is_fully_expanded()
    assert len(root.children) == 1

def test_optimization_endpoint(graph: Graph):
    req = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id="hospital-st-marys",
        severity="severe",
        budget=1,
        duration_steps=6,
        seed=42
    )
    
    result = optimize_impact(graph, req)
    
    assert result["algorithm_used"] == "mcts"
    assert "optimization_id" in result
    assert result["objective"]["baseline_damage"] >= result["objective"]["mitigated_damage"]
    assert len(result["selected_protections"]) <= req.budget

def test_optimization_zero_budget(graph: Graph):
    req = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id="hospital-st-marys",
        severity="severe",
        budget=0,
        duration_steps=6,
        seed=42
    )
    
    result = optimize_impact(graph, req)
    
    assert result["algorithm_used"] == "no_action"
    assert len(result["selected_protections"]) == 0
    assert result["objective"]["baseline_damage"] == result["objective"]["mitigated_damage"]

def test_reproducibility(graph: Graph):
    req1 = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id="hospital-st-marys",
        severity="severe",
        budget=2,
        duration_steps=6,
        seed=100
    )
    
    req2 = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id="hospital-st-marys",
        severity="severe",
        budget=2,
        duration_steps=6,
        seed=100
    )
    
    res1 = optimize_impact(graph, req1)
    res2 = optimize_impact(graph, req2)
    
    assert res1["selected_protections"] == res2["selected_protections"]
    assert res1["objective"] == res2["objective"]
