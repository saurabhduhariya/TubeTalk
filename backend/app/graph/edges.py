"""Conditional edge functions that control the graph's routing logic."""

from app.graph.state import GraphState


def decide_route(state: GraphState) -> str:
    """After route_question: decide which node to go to next."""
    route = state["route"]
    if route == "casual":
        return "generate"
    elif route == "web_search":
        return "web_search"
    else:
        return "retrieve"


def decide_after_grading(state: GraphState) -> str:
    """After grade_documents: decide whether to generate, rewrite, or give up."""
    if state["documents"]:
        return "generate"

    # No relevant docs — should we retry?
    if state["route"] == "video_rag" and state["loop_count"] < 2:
        return "rewrite_query"

    # Loop cap hit or web_search route — just generate with empty context
    return "generate"
