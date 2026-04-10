"""Conditional edge functions for the Hybrid CRAG + Self-RAG pipeline."""

from app.graph.state import GraphState


def decide_route(state: GraphState) -> str:
    """After route_question: decide which node to go to next."""
    route = state["route"]
    if route == "casual":
        return "generate"
    elif route == "web_search":
        return "web_search_only"
    else:
        return "retrieve"


def decide_after_evaluation(state: GraphState) -> str:
    """After evaluate_retrieval: route based on CRAG 3-way verdict.

    - correct   → refine only
    - ambiguous → refine (web search will run after refine via a separate edge)
    - incorrect → corrective web search only
    """
    grade = state["retrieval_grade"]

    if grade == "correct":
        return "refine_only"
    elif grade == "incorrect":
        return "search_only"
    else:  # ambiguous
        return "refine_then_search"


def decide_after_hallucination(state: GraphState) -> str:
    """After hallucination_check: decide whether to regenerate or finish."""
    result = state.get("hallucination_result", "grounded")
    retries = state.get("generation_retries", 0)

    if result == "grounded":
        return "end"
    elif retries < 2:
        return "regenerate"
    else:
        return "end"
