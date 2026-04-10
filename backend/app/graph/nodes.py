"""LangGraph node functions for the Hybrid CRAG + Self-RAG pipeline."""

from typing import List

from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.config import fast_llm, reasoning_llm, tavily_tool
from app.graph.state import GraphState
from app.services.video import get_vector_store, format_docs


# ══════════════════════════════════════════════════════════════════════════════
#  KEPT NODES (from Self-RAG)
# ══════════════════════════════════════════════════════════════════════════════

# ── Route Question ────────────────────────────────────────────────────────────

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

    if "video" in result or "rag" in result:
        route = "video_rag"
    elif "web" in result or "search" in result:
        route = "web_search"
    elif "casual" in result:
        route = "casual"
    else:
        route = "video_rag"

    print(f"    Route decided: {route}")
    return {"route": route}


# ── Retrieve from Pinecone ────────────────────────────────────────────────────

def retrieve(state: GraphState) -> dict:
    """Fetch documents from Pinecone for the current question."""
    print("--- NODE: retrieve ---")

    vector_store = get_vector_store(state["video_url"])
    retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    documents = retriever.invoke(state["question"])

    print(f"    Retrieved {len(documents)} documents")
    return {"documents": documents}


# ── Web Search Only (direct web_search route) ────────────────────────────────

def web_search_only(state: GraphState) -> dict:
    """Search the web using Tavily — used for the direct web_search route."""
    print("--- NODE: web_search_only ---")

    try:
        results = tavily_tool.invoke(state["question"])
        if isinstance(results, list):
            documents = [
                Document(
                    page_content=r.get("content", "") if isinstance(r, dict) else str(r),
                    metadata={"source": r.get("url", "tavily") if isinstance(r, dict) else "tavily"},
                )
                for r in results
                if (isinstance(r, dict) and r.get("content")) or (isinstance(r, str) and r)
            ]
        else:
            documents = [Document(page_content=str(results), metadata={"source": "tavily"})]
    except Exception as e:
        print(f"    Tavily search failed: {e}")
        documents = []

    web_knowledge = "\n\n".join(doc.page_content for doc in documents) if documents else ""
    print(f"    Web search returned {len(documents)} results")
    return {"web_knowledge": web_knowledge}


# ══════════════════════════════════════════════════════════════════════════════
#  CRAG NODES
# ══════════════════════════════════════════════════════════════════════════════

# ── Evaluate Retrieval (CRAG: Retrieval Evaluator) ────────────────────────────

def evaluate_retrieval(state: GraphState) -> dict:
    """Grade ALL retrieved docs in a SINGLE LLM call as correct/ambiguous/incorrect."""
    print("--- NODE: evaluate_retrieval ---")

    docs_text = "\n\n".join(
        f"[Document {i+1}]: {doc.page_content[:500]}"
        for i, doc in enumerate(state["documents"])
    )

    eval_prompt = ChatPromptTemplate.from_template(
        """You are a retrieval evaluator. Given a user question and a set of retrieved documents,
evaluate whether the documents collectively contain enough information to answer the question.

Respond with EXACTLY ONE word:
- "correct" — The documents contain sufficient, relevant information to fully answer the question.
- "ambiguous" — The documents contain some relevant information, but it may be incomplete or partially off-topic.
- "incorrect" — The documents are mostly irrelevant and do not help answer the question.

Question: {question}

Retrieved Documents:
{documents}

Verdict:"""
    )

    chain = eval_prompt | fast_llm | StrOutputParser()
    result = chain.invoke({
        "question": state["question"],
        "documents": docs_text,
    }).strip().lower().strip('"').strip("'")

    # Normalize
    if "correct" in result and "incorrect" not in result:
        grade = "correct"
    elif "incorrect" in result:
        grade = "incorrect"
    elif "ambiguous" in result:
        grade = "ambiguous"
    else:
        grade = "ambiguous"  # Default to ambiguous (safe fallback)

    print(f"    Retrieval grade: {grade}")
    return {"retrieval_grade": grade}


# ── Refine Knowledge (CRAG: Decompose → Filter → Recompose) ──────────────────

def refine_knowledge(state: GraphState) -> dict:
    """Decompose docs into strips, filter relevant ones via LLM, recompose."""
    print("--- NODE: refine_knowledge ---")

    # Step 1: Decompose — split all docs into numbered sentence strips
    strips: List[str] = []
    for doc in state["documents"]:
        sentences = [s.strip() for s in doc.page_content.replace("\n", " ").split(".") if s.strip()]
        strips.extend(sentences)

    if not strips:
        print("    No strips to refine")
        return {"refined_knowledge": ""}

    # Build numbered list for the LLM
    numbered_strips = "\n".join(f"[{i}] {strip}" for i, strip in enumerate(strips))

    # Step 2: Filter — single batched LLM call
    filter_prompt = ChatPromptTemplate.from_template(
        """You are a knowledge filter. Given a question and a list of numbered text strips
extracted from documents, identify which strips are relevant to answering the question.

Return ONLY a comma-separated list of the relevant strip numbers. If none are relevant, return "none".
Do not include any other text.

Question: {question}

Strips:
{strips}

Relevant strip numbers:"""
    )

    chain = filter_prompt | fast_llm | StrOutputParser()
    result = chain.invoke({
        "question": state["question"],
        "strips": numbered_strips,
    }).strip()

    # Step 3: Recompose — join the relevant strips
    if "none" in result.lower():
        refined = ""
        print("    No strips passed filtering")
    else:
        try:
            # Parse comma-separated numbers
            indices = [int(n.strip().strip("[]")) for n in result.split(",") if n.strip().strip("[]").isdigit()]
            relevant_strips = [strips[i] for i in indices if i < len(strips)]
            refined = ". ".join(relevant_strips) + "." if relevant_strips else ""
            print(f"    Refined {len(relevant_strips)}/{len(strips)} strips")
        except (ValueError, IndexError):
            # If parsing fails, use all strips as fallback
            refined = ". ".join(strips) + "."
            print(f"    Strip parsing failed — using all {len(strips)} strips")

    return {"refined_knowledge": refined}


# ── Corrective Web Search (CRAG: Rewrite → Search → Select) ──────────────────

def corrective_web_search(state: GraphState) -> dict:
    """Rewrite query for web, search Tavily, store as external knowledge."""
    print("--- NODE: corrective_web_search ---")

    # Step 1: Rewrite query for web search
    rewrite_prompt = ChatPromptTemplate.from_template(
        """You are a search query optimizer. The user asked a question about a YouTube video,
but the video transcript did not contain relevant information.

Rewrite the question as a concise web search query that would find the answer from general web sources.
Return ONLY the search query, nothing else.

Original question: {question}

Search query:"""
    )

    chain = rewrite_prompt | fast_llm | StrOutputParser()
    search_query = chain.invoke({"question": state["question"]}).strip()
    print(f"    Rewritten search query: '{search_query}'")

    # Step 2: Search with Tavily
    try:
        results = tavily_tool.invoke(search_query)
        if isinstance(results, list):
            contents = [
                r.get("content", "") if isinstance(r, dict) else str(r)
                for r in results
                if (isinstance(r, dict) and r.get("content")) or (isinstance(r, str) and r)
            ]
        else:
            contents = [str(results)] if results else []
    except Exception as e:
        print(f"    Tavily search failed: {e}")
        contents = []

    # Step 3: Store as external knowledge
    web_knowledge = "\n\n".join(contents) if contents else ""
    print(f"    Web search returned {len(contents)} results")
    return {"web_knowledge": web_knowledge}


# ══════════════════════════════════════════════════════════════════════════════
#  GENERATION + SELF-RAG NODES
# ══════════════════════════════════════════════════════════════════════════════

# ── Generate Answer ───────────────────────────────────────────────────────────

def generate(state: GraphState) -> dict:
    """Generate the final answer using refined + web knowledge."""
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
        # Build context from available knowledge sources
        internal = state.get("refined_knowledge", "")
        external = state.get("web_knowledge", "")

        context_parts = []
        if internal:
            context_parts.append(f"Video Transcript Knowledge:\n{internal}")
        if external:
            context_parts.append(f"Web Search Knowledge:\n{external}")

        context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant context found."

        rag_prompt = ChatPromptTemplate.from_template(
            """You are TubeTalk, a helpful YouTube video assistant. Answer the user's question
based strictly on the context below. The context may include refined video transcript knowledge
and/or web search results.

If the context does not contain enough information, say so honestly. Do not make up information.

Context:
{context}

Question: {question}

Answer:"""
        )
        chain = rag_prompt | reasoning_llm | StrOutputParser()
        generation = chain.invoke({
            "context": context,
            "question": state["question"],
        })

    print(f"    Generation complete ({len(generation)} chars)")
    return {"generation": generation}


# ── Hallucination Check (Self-RAG) ────────────────────────────────────────────

def hallucination_check(state: GraphState) -> dict:
    """Check if the generated answer is grounded in the provided context."""
    print("--- NODE: hallucination_check ---")

    # Skip hallucination check for casual route
    if state.get("route") == "casual":
        print("    Skipping (casual route)")
        return {
            "generation_retries": state.get("generation_retries", 0),
            "hallucination_result": "grounded",
        }

    internal = state.get("refined_knowledge", "")
    external = state.get("web_knowledge", "")

    context_parts = []
    if internal:
        context_parts.append(internal)
    if external:
        context_parts.append(external)

    context = "\n\n".join(context_parts) if context_parts else ""

    if not context:
        print("    No context to check against — skipping")
        return {
            "generation_retries": state.get("generation_retries", 0),
            "hallucination_result": "grounded",
        }

    check_prompt = ChatPromptTemplate.from_template(
        """You are a hallucination detector. Determine if the given answer is fully grounded
in (supported by) the provided context. The answer should not contain claims that are not
present in or inferable from the context.

Respond with ONLY "grounded" or "not_grounded". Nothing else.

Context:
{context}

Answer:
{answer}

Verdict:"""
    )

    chain = check_prompt | fast_llm | StrOutputParser()
    result = chain.invoke({
        "context": context,
        "answer": state["generation"],
    }).strip().lower()

    is_grounded = "grounded" in result and "not" not in result
    retries = state.get("generation_retries", 0)

    if is_grounded:
        print("    ✓ Answer is GROUNDED")
        return {
            "generation_retries": retries,
            "hallucination_result": "grounded",
        }
    else:
        retries += 1
        print(f"    ✗ Answer is NOT GROUNDED (retry {retries}/2)")
        return {
            "generation_retries": retries,
            "hallucination_result": "not_grounded",
        }
