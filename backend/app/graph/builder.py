"""Assembles and compiles the Hybrid CRAG + Self-RAG LangGraph state machine."""

from langgraph.graph import StateGraph, END

from app.graph.state import GraphState
from app.graph.nodes import (
    route_question,
    retrieve,
    web_search_only,
    evaluate_retrieval,
    refine_knowledge,
    corrective_web_search,
    generate,
    hallucination_check,
)
from app.graph.edges import (
    decide_route,
    decide_after_evaluation,
    decide_after_hallucination,
)


def build_rag_graph():
    """Build and compile the Hybrid CRAG + Self-RAG graph.

    Graph topology:
        START → route_question
            → casual       → generate → hallucination_check → END
            → web_search   → web_search_only → generate → hallucination_check → END
            → video_rag    → retrieve → evaluate_retrieval
                → correct       → refine_knowledge → generate → ...
                → ambiguous     → refine_knowledge → corrective_web_search → generate → ...
                → incorrect     → corrective_web_search → generate → ...
    """
    workflow = StateGraph(GraphState)

    # ── Add all nodes ─────────────────────────────────────────────────────────
    workflow.add_node("route_question", route_question)
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("web_search_only", web_search_only)
    workflow.add_node("evaluate_retrieval", evaluate_retrieval)
    workflow.add_node("refine_knowledge", refine_knowledge)
    workflow.add_node("corrective_web_search", corrective_web_search)
    workflow.add_node("generate", generate)
    workflow.add_node("hallucination_check", hallucination_check)

    # ── Entry point ───────────────────────────────────────────────────────────
    workflow.set_entry_point("route_question")

    # ── Edge 1: Route question
    workflow.add_conditional_edges(
        "route_question",
        decide_route,
        {
            "generate": "generate",
            "retrieve": "retrieve",
            "web_search_only": "web_search_only",
        },
    )

    # ── Edge 2: retrieve → evaluate_retrieval (always)
    workflow.add_edge("retrieve", "evaluate_retrieval")

    # ── Edge 3: evaluate_retrieval → (refine | search | refine-then-search)
    # For "ambiguous", we run refine first, then corrective search sequentially.
    # This avoids Send()-based parallel merging issues and is more reliable.
    workflow.add_conditional_edges(
        "evaluate_retrieval",
        decide_after_evaluation,
        {
            "refine_only": "refine_knowledge",
            "search_only": "corrective_web_search",
            "refine_then_search": "refine_knowledge",
        },
    )

    # ── Edge 4: refine_knowledge → generate OR corrective_web_search
    # If grade was "ambiguous", refine → corrective_web_search → generate
    # If grade was "correct", refine → generate
    def after_refine(state: GraphState) -> str:
        if state.get("retrieval_grade") == "ambiguous":
            return "corrective_web_search"
        return "generate"

    workflow.add_conditional_edges(
        "refine_knowledge",
        after_refine,
        {
            "corrective_web_search": "corrective_web_search",
            "generate": "generate",
        },
    )

    # ── Edge 5: corrective_web_search → generate (always)
    workflow.add_edge("corrective_web_search", "generate")

    # ── Edge 6: web_search_only → generate (always)
    workflow.add_edge("web_search_only", "generate")

    # ── Edge 7: generate → hallucination_check (always)
    workflow.add_edge("generate", "hallucination_check")

    # ── Edge 8: hallucination_check → END or regenerate
    workflow.add_conditional_edges(
        "hallucination_check",
        decide_after_hallucination,
        {
            "end": END,
            "regenerate": "generate",
        },
    )

    return workflow.compile()


# Compile once at import time
rag_graph = build_rag_graph()
