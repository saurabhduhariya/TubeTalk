"""LangGraph node functions for the Self-RAG + Web Search pipeline."""

from typing import List

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.config import fast_llm, reasoning_llm, tavily_tool
from app.graph.state import GraphState
from app.services.video import get_vector_store, format_docs


# ── Node 1: Route Question ───────────────────────────────────────────────────

def route_question(state: GraphState) -> dict:
    """Use LLM to classify the question into one of three routes."""
    print("--- NODE: route_question ---")

    router_prompt = ChatPromptTemplate.from_template(
        """You are a router for a YouTube video chatbot. Classify the user's question
into exactly ONE of the following categories. Reply with ONLY the category label, nothing else.

Categories:
- "casual" — Greetings or meta questions (e.g. "hi", "hello", "who are you?", "what can you do?")
- "video_rag" — Questions that require the video's transcript content (e.g. "what did they say about X?", "summarize the video", "explain the part about Y")
- "web_search" — General knowledge questions not specific to any video (e.g. "what is quantum computing?", "who is Elon Musk?", "latest news about AI")

Question: {question}

Category:"""
    )

    chain = router_prompt | fast_llm | StrOutputParser()
    result = chain.invoke({"question": state["question"]}).strip().lower().strip('"').strip("'")

    # Normalize to one of the three valid routes
    if "video" in result or "rag" in result:
        route = "video_rag"
    elif "web" in result or "search" in result:
        route = "web_search"
    elif "casual" in result:
        route = "casual"
    else:
        route = "video_rag"  # Default to video RAG

    print(f"    Route decided: {route}")
    return {"route": route}


# ── Node 2: Retrieve from Pinecone ───────────────────────────────────────────

def retrieve(state: GraphState) -> dict:
    """Fetch documents from Pinecone for the current question."""
    print("--- NODE: retrieve ---")

    vector_store = get_vector_store(state["video_url"])
    retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    documents = retriever.invoke(state["question"])

    print(f"    Retrieved {len(documents)} documents")
    return {"documents": documents}


# ── Node 3: Web Search via Tavily ─────────────────────────────────────────────

def web_search(state: GraphState) -> dict:
    """Search the web using Tavily and wrap results as Documents."""
    print("--- NODE: web_search ---")

    try:
        results = tavily_tool.invoke(state["question"])
        # TavilySearch returns a list of dicts or a string; normalize to docs
        if isinstance(results, list):
            documents = [
                Document(
                    page_content=r.get("content", "") if isinstance(r, dict) else str(r),
                    metadata={"source": r.get("url", "tavily_search") if isinstance(r, dict) else "tavily_search"},
                )
                for r in results
                if (isinstance(r, dict) and r.get("content")) or (isinstance(r, str) and r)
            ]
        else:
            documents = [Document(page_content=str(results), metadata={"source": "tavily_search"})]
    except Exception as e:
        print(f"    Tavily search failed: {e}")
        documents = []

    print(f"    Web search returned {len(documents)} documents")
    return {"documents": documents}


# ── Node 4: Grade Documents ──────────────────────────────────────────────────

def grade_documents(state: GraphState) -> dict:
    """Grade each document for relevance; keep only 'yes' docs."""
    print("--- NODE: grade_documents ---")

    grader_prompt = ChatPromptTemplate.from_template(
        """You are a strict relevance grader. Given a user question and a retrieved document,
decide if the document contains information relevant to answering the question.

Respond with ONLY "yes" or "no". Nothing else.

Question: {question}
Document: {document}

Relevant:"""
    )

    grader_chain = grader_prompt | fast_llm | StrOutputParser()

    relevant_docs: List[Document] = []
    for doc in state["documents"]:
        score = grader_chain.invoke({
            "question": state["question"],
            "document": doc.page_content,
        }).strip().lower()

        if "yes" in score:
            relevant_docs.append(doc)
            print(f"    ✓ Doc graded RELEVANT (source: {doc.metadata.get('source', 'pinecone')})")
        else:
            print("    ✗ Doc graded IRRELEVANT")

    print(f"    {len(relevant_docs)}/{len(state['documents'])} docs passed grading")
    return {"documents": relevant_docs}


# ── Node 5: Rewrite Query ────────────────────────────────────────────────────

def rewrite_query(state: GraphState) -> dict:
    """Rewrite the question for better semantic search retrieval."""
    print("--- NODE: rewrite_query ---")

    rewriter_prompt = ChatPromptTemplate.from_template(
        """You are a query rewriter. The original question failed to retrieve relevant documents
from a YouTube video transcript. Rewrite it to improve semantic search retrieval.

Keep the core intent but use different words, synonyms, or rephrase for clarity.
Return ONLY the rewritten question, nothing else.

Original question: {question}

Rewritten question:"""
    )

    chain = rewriter_prompt | fast_llm | StrOutputParser()
    new_question = chain.invoke({"question": state["question"]}).strip()
    new_loop_count = state["loop_count"] + 1

    print(f"    Rewritten: '{state['question']}' → '{new_question}'")
    print(f"    Loop count: {new_loop_count}/2")
    return {"question": new_question, "loop_count": new_loop_count}


# ── Node 6: Generate Answer ──────────────────────────────────────────────────

def generate(state: GraphState) -> dict:
    """Generate the final answer."""
    print("--- NODE: generate ---")

    if state.get("route") == "casual":
        casual_prompt = ChatPromptTemplate.from_template(
            """You are TubeTalk, a friendly YouTube video assistant. The user sent a casual
greeting or meta question. Respond warmly and briefly explain what you can do:
you help users chat with YouTube videos by answering questions about their content,
and you can also search the web for general knowledge questions.

User message: {question}

Response:"""
        )
        chain = casual_prompt | reasoning_llm | StrOutputParser()
        generation = chain.invoke({"question": state["question"]})
    else:
        context = format_docs(state.get("documents", []))
        source_label = (
            "video transcript" if state.get("route") == "video_rag" else "web search results"
        )

        rag_prompt = ChatPromptTemplate.from_template(
            """You are TubeTalk, a helpful YouTube video assistant. Answer the user's question
based strictly on the {source} context below.
If the context does not contain enough information, say so honestly. Do not make up information.

Context:
{context}

Question: {question}

Answer:"""
        )
        chain = rag_prompt | reasoning_llm | StrOutputParser()
        generation = chain.invoke({
            "source": source_label,
            "context": context,
            "question": state["question"],
        })

    print(f"    Generation complete ({len(generation)} chars)")
    return {"generation": generation}
