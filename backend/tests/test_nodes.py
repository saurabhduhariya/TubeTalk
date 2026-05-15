import pytest
from app.graph.nodes import (
    route_question,
    retrieve,
    web_search_only,
    evaluate_retrieval,
    refine_knowledge,
    corrective_web_search,
    generate,
    hallucination_check
)
from langchain_core.documents import Document
from langchain_core.messages import AIMessage

def test_route_question(sample_state, mock_fast_llm):
    """Test routing logic based on LLM output."""
    # Test casual route
    mock_fast_llm.return_value = AIMessage(content="casual")
    result = route_question(sample_state)
    assert result["route"] == "casual"

    # Test video_rag route
    mock_fast_llm.return_value = AIMessage(content="video_rag")
    result = route_question(sample_state)
    assert result["route"] == "video_rag"

    # Test web_search route
    mock_fast_llm.return_value = AIMessage(content="web_search")
    result = route_question(sample_state)
    assert result["route"] == "web_search"

def test_retrieve(sample_state, mock_get_vector_store):
    """Test retrieving documents from Pinecone."""
    result = retrieve(sample_state)
    assert "documents" in result
    assert len(result["documents"]) == 2
    assert "mocked transcript" in result["documents"][0].page_content

def test_web_search_only(sample_state, mock_tavily_tool):
    """Test direct web search node."""
    result = web_search_only(sample_state)
    assert "web_knowledge" in result
    assert "mocked search result" in result["web_knowledge"]

def test_evaluate_retrieval(sample_state, mock_fast_llm):
    """Test retrieval grading logic."""
    sample_state["documents"] = [Document(page_content="test content")]
    
    # Test correct
    mock_fast_llm.return_value = AIMessage(content="correct")
    result = evaluate_retrieval(sample_state)
    assert result["retrieval_grade"] == "correct"

    # Test incorrect
    mock_fast_llm.return_value = AIMessage(content="incorrect")
    result = evaluate_retrieval(sample_state)
    assert result["retrieval_grade"] == "incorrect"

    # Test ambiguous
    mock_fast_llm.return_value = AIMessage(content="ambiguous")
    result = evaluate_retrieval(sample_state)
    assert result["retrieval_grade"] == "ambiguous"

def test_refine_knowledge(sample_state, mock_fast_llm):
    """Test document decomposition and filtering."""
    sample_state["documents"] = [
        Document(page_content="Relevant info. Irrelevant info. More relevant info.")
    ]
    
    # Mock LLM to select strip 0 and 2
    mock_fast_llm.return_value = AIMessage(content="0, 2")
    result = refine_knowledge(sample_state)
    
    assert "refined_knowledge" in result
    assert "Relevant info" in result["refined_knowledge"]
    assert "More relevant info" in result["refined_knowledge"]
    assert "Irrelevant info" not in result["refined_knowledge"]

def test_corrective_web_search(sample_state, mock_fast_llm, mock_tavily_tool):
    """Test corrective web search."""
    mock_fast_llm.return_value = AIMessage(content="optimized search query")
    result = corrective_web_search(sample_state)
    
    assert "web_knowledge" in result
    assert "mocked search result" in result["web_knowledge"]
    mock_tavily_tool.invoke.assert_called_once_with("optimized search query")

def test_generate(sample_state, mock_reasoning_llm):
    """Test generation with context."""
    sample_state["refined_knowledge"] = "Refined internal knowledge."
    sample_state["web_knowledge"] = "External web knowledge."
    sample_state["comments"] = "User reaction: awesome."
    
    mock_reasoning_llm.return_value = AIMessage(content="Final generated answer.")
    result = generate(sample_state)
    
    assert "generation" in result
    assert result["generation"] == "Final generated answer."
    
    # Check that context was built correctly
    call_args = mock_reasoning_llm.call_args[0][0]
    assert "Refined internal knowledge." in call_args["context"]
    assert "External web knowledge." in call_args["context"]
    assert "User reaction: awesome." in call_args["context"]

def test_hallucination_check(sample_state, mock_fast_llm):
    """Test hallucination detection and retries."""
    sample_state["refined_knowledge"] = "Context."
    sample_state["generation"] = "Answer."
    sample_state["generation_retries"] = 0
    
    # Test grounded
    mock_fast_llm.return_value = AIMessage(content="grounded")
    result = hallucination_check(sample_state)
    assert result["hallucination_result"] == "grounded"
    assert result["generation_retries"] == 0

    # Test not grounded
    mock_fast_llm.return_value = AIMessage(content="not_grounded")
    result = hallucination_check(sample_state)
    assert result["hallucination_result"] == "not_grounded"
    assert result["generation_retries"] == 1
