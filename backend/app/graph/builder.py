"""Assembles and compiles the LangGraph state machine."""

from langgraph.graph import StateGraph, END

from app.graph.state import GraphState
from app.graph.nodes import (
    route_question,
    retrieve,
    web_search,
    grade_documents,
    rewrite_query,
    generate,
)
from app.graph.edges import decide_route, decide_after_grading


def build_rag_graph():
    """Build and compile the Self-RAG + Web Search graph."""
    workflow = StateGraph(GraphState)

    # Add nodes
    workflow.add_node("route_question", route_question)
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("web_search", web_search)
    workflow.add_node("grade_documents", grade_documents)
    workflow.add_node("rewrite_query", rewrite_query)
    workflow.add_node("generate", generate)

    # Entry point
    workflow.set_entry_point("route_question")

    # Conditional edge after routing
    workflow.add_conditional_edges(
        "route_question",
        decide_route,
        {
            "generate": "generate",
            "retrieve": "retrieve",
            "web_search": "web_search",
        },
    )

    # After retrieval / web search → always grade
    workflow.add_edge("retrieve", "grade_documents")
    workflow.add_edge("web_search", "grade_documents")

    # Conditional edge after grading
    workflow.add_conditional_edges(
        "grade_documents",
        decide_after_grading,
        {
            "generate": "generate",
            "rewrite_query": "rewrite_query",
        },
    )

    # After rewriting → always re-retrieve
    workflow.add_edge("rewrite_query", "retrieve")

    # After generation → END
    workflow.add_edge("generate", END)

    return workflow.compile()


# Compile once at import time
rag_graph = build_rag_graph()
