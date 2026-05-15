import pytest
import os
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from langchain_core.documents import Document
from langchain_core.messages import AIMessage

from app.graph.state import GraphState
from app.limiter import limiter

# Disable rate limiting for the test suite
limiter.enabled = False

# Make sure tests run from the project root so `.env` if needed can be found
os.environ["PYTHONPATH"] = str(Path(__file__).parent.parent)

@pytest.fixture
def client():
    # Import app here to avoid loading it before env vars are mocked if needed
    from main import app
    return TestClient(app)

@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Mock required environment variables so app can start without a .env file."""
    monkeypatch.setenv("GROQ_API_KEY", "test_groq_key")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test_openrouter_key")
    monkeypatch.setenv("VOYAGE_API_KEY", "test_voyage_key")
    monkeypatch.setenv("PINECONE_API_KEY", "test_pinecone_key")
    monkeypatch.setenv("PINECONE_INDEX_NAME", "test_index")
    monkeypatch.setenv("TAVILY_API_KEY", "test_tavily_key")

@pytest.fixture
def mock_fast_llm():
    """Mock the fast_llm (Groq)."""
    with patch("app.graph.nodes.fast_llm") as mock:
        # Default mock response, tests can override this
        mock.return_value = AIMessage(content="mocked fast llm response")
        yield mock

@pytest.fixture
def mock_reasoning_llm():
    """Mock the reasoning_llm (OpenRouter)."""
    with patch("app.graph.nodes.reasoning_llm") as mock:
        mock.return_value = AIMessage(content="mocked reasoning llm response")
        yield mock

@pytest.fixture
def mock_tavily_tool():
    """Mock the tavily_tool."""
    with patch("app.graph.nodes.tavily_tool") as mock:
        mock.invoke.return_value = [{"content": "mocked search result", "url": "http://example.com"}]
        yield mock

@pytest.fixture
def mock_get_vector_store():
    """Mock Pinecone retrieval."""
    with patch("app.graph.nodes.get_vector_store") as mock:
        mock_retriever = MagicMock()
        mock_retriever.invoke.return_value = [
            Document(page_content="mocked transcript sentence 1. mocked transcript sentence 2."),
            Document(page_content="mocked transcript sentence 3. mocked transcript sentence 4.")
        ]
        mock_vs = MagicMock()
        mock_vs.as_retriever.return_value = mock_retriever
        mock.return_value = mock_vs
        yield mock

@pytest.fixture
def mock_video_services():
    """Mock YouTube metadata and comments extractors."""
    with patch("app.routes.chat.get_video_metadata") as mock_meta, \
         patch("app.routes.chat.get_video_comments") as mock_comments:
        mock_meta.return_value = "Title: Mocked Video\nDescription: Mocked description"
        mock_comments.return_value = "[1] User1 (100 likes): Great video!"
        yield {"metadata": mock_meta, "comments": mock_comments}

@pytest.fixture
def sample_state() -> GraphState:
    """Provide a default initialized graph state."""
    return {
        "question": "what is this video about?",
        "video_url": "https://youtube.com/watch?v=123",
        "metadata": "Title: Mock Video",
        "comments": "User: Great!",
        "route": "",
        "documents": [],
        "retrieval_grade": "",
        "refined_knowledge": "",
        "web_knowledge": "",
        "generation": "",
        "generation_retries": 0,
        "hallucination_result": "",
        "loop_count": 0
    }
