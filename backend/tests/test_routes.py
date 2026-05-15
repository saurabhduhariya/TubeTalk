import pytest
from unittest.mock import patch

def test_chat_route_success(client, mock_video_services):
    """Test the /chat endpoint returns a successful response and uses overrides."""
    request_payload = {
        "question": "what is this video about?",
        "url": "https://www.youtube.com/watch?v=123"
    }
    
    headers = {
        "x-api-key-GROQ_API_KEY": "user_groq_key"
    }

    # Mock the rag_graph.invoke call
    with patch("app.routes.chat.rag_graph.invoke") as mock_invoke:
        mock_invoke.return_value = {"generation": "This is a mocked answer."}

        response = client.post("/chat", json=request_payload, headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "This is a mocked answer."
    
    # Ensure video services were called with the correct URL
    mock_video_services["metadata"].assert_called_once_with("https://www.youtube.com/watch?v=123")
    mock_video_services["comments"].assert_called_once_with("https://www.youtube.com/watch?v=123")
    
    # Ensure graph was invoked with the initial state
    mock_invoke.assert_called_once()
    initial_state = mock_invoke.call_args[0][0]
    assert initial_state["question"] == "what is this video about?"
    assert initial_state["video_url"] == "https://www.youtube.com/watch?v=123"
    assert "metadata" in initial_state
    assert "comments" in initial_state


def test_chat_route_exception_handling(client, mock_video_services):
    """Test the /chat endpoint correctly handles exceptions."""
    request_payload = {
        "question": "test question",
        "url": "https://www.youtube.com/watch?v=123"
    }

    with patch("app.routes.chat.rag_graph.invoke", side_effect=Exception("Graph error")):
        response = client.post("/chat", json=request_payload)

    assert response.status_code == 500
    assert "Graph error" in response.json()["detail"]
