import json
from typing import Literal
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel

from app.graph_repository import get_graph
from app.prediction import PredictionRequest, predict_impact
from app.optimize import OptimizationRequest, optimize_impact


@tool
def run_mcts_optimization(node_id: str, budget: int, severity: str = "severe", duration_steps: int = 6) -> str:
    """Run the Monte Carlo Tree Search (MCTS) optimization engine to find the best infrastructure nodes to protect.
    
    Args:
        node_id: The ID of the node where the failure originated (e.g., 'hospital-st-marys').
        budget: The number of nodes that can be hardened/protected.
        severity: The severity of the initial failure ('mild', 'moderate', 'severe').
        duration_steps: The duration of the failure in steps.
        
    Returns:
        A JSON string containing the optimal nodes to protect and the impact reduction metrics.
    """
    graph = get_graph()
    req = OptimizationRequest(
        graph_version=graph.graph_version,
        node_id=node_id,
        severity=severity,
        budget=budget,
        duration_steps=duration_steps
    )
    result = optimize_impact(graph, req)
    # Keep only what the LLM needs to reason about; the full result (including
    # the re-run cascade's raw events) is large and burns tokens for no benefit.
    simplified = {
        "algorithm_used": result["algorithm_used"],
        "baseline_damage": result["objective"]["baseline_damage"],
        "mitigated_damage": result["objective"]["mitigated_damage"],
        "absolute_improvement": result["objective"]["absolute_improvement"],
        "percentage_improvement": result["objective"]["percentage_improvement"],
        "protected_nodes": [p["node_id"] for p in result["selected_protections"]],
        "iterations": result["search_stats"]["iterations"],
    }
    return json.dumps(simplified, indent=2)


@tool
def get_predicted_impact(node_id: str, severity: str = "severe") -> str:
    """Get the predicted blast radius and cascading impact of a failure before any protections are applied.
    
    Args:
        node_id: The ID of the node where the failure originated.
        severity: The severity of the failure.
        
    Returns:
        A JSON string containing the predicted blast radius, affected assets, and domain breakdowns.
    """
    graph = get_graph()
    req = PredictionRequest(
        graph_version=graph.graph_version,
        node_id=node_id,
        severity=severity
    )
    result = predict_impact(graph, req)
    # Simplify the output so we don't blow up the LLM context window
    simplified = {
        "blast_radius_km": result.blast_radius_km,
        "critical_assets_at_risk": result.critical_assets_at_risk,
        "priority_weighted_risk_score": result.priority_weighted_risk_score,
        "executive_summary": result.executive_summary,
        "affected_nodes_count": len(result.affected_nodes),
        "domain_breakdowns": [d.model_dump() for d in result.domain_breakdowns]
    }
    return json.dumps(simplified, indent=2)


# ==========================================
# Agents
# ==========================================
import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model

load_dotenv()

def get_llm():
    return init_chat_model(
        "openai/gpt-oss-20b",
        model_provider="groq",
        api_key=os.environ.get("GROQ_API_KEY")
    )


def get_management_agent():
    system_prompt = """You are a senior City Planner and Emergency Director.
Your job is to advise city executives on infrastructure resilience investments.
You have access to a deterministic Monte Carlo Tree Search (MCTS) optimization tool that can tell you exactly which infrastructure nodes to protect given a budget.

When a crisis occurs at a specific node:
1. First, check the baseline predicted impact.
2. Then, run the MCTS optimizer with the given budget to find the optimal intervention.
3. Synthesize the results into a concise, professional executive briefing.
Focus on ROI (Return on Investment), operational metrics, and the strategic value of the recommended interventions.

Keep the briefing under 120 words total. No markdown tables. Use a short title, at most 3 bullet points, and one closing sentence. Do not restate raw numbers you already showed in a bullet.
"""
    tools = [run_mcts_optimization, get_predicted_impact]
    llm = get_llm()
    return create_react_agent(llm, tools, prompt=system_prompt)


def get_citizen_agent():
    system_prompt = """You are a Crisis Communicator and Public Relations Officer for the city.
Your job is to translate complex infrastructure failures into clear, reassuring, and actionable advice for citizens.
You have access to an MCTS optimization tool that calculates how the city is mitigating the crisis.

When a crisis occurs:
1. Check the baseline predicted impact to understand what domains (power, water, etc.) are at risk.
2. Run the MCTS optimizer to see what the city is successfully protecting.
3. Write a public advisory notice.
Focus on human impact: what services will stay online (thanks to the interventions), what might go down, and safety instructions for the public. Keep the tone calm, empathetic, and clear.

Keep the notice under 100 words total. No markdown tables, no headers with dates/timestamps. Use a short title, at most 3 bullet points, and one closing sentence.
"""
    tools = [run_mcts_optimization, get_predicted_impact]
    llm = get_llm()
    return create_react_agent(llm, tools, prompt=system_prompt)


class AgentChatRequest(BaseModel):
    node_id: str
    budget: int
    severity: Literal["mild", "moderate", "severe"] = "severe"
    agent_type: Literal["management", "citizen"]

class AgentChatResponse(BaseModel):
    response: str

def run_agent_chat(request: AgentChatRequest) -> AgentChatResponse:
    agent = get_management_agent() if request.agent_type == "management" else get_citizen_agent()
    
    user_prompt = f"A {request.severity} failure has occurred at {request.node_id}. We have a budget to protect {request.budget} facilities. Analyze the situation and provide your report."
    
    result = agent.invoke({"messages": [HumanMessage(content=user_prompt)]})
    return AgentChatResponse(response=result["messages"][-1].content)
