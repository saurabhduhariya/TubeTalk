import os

# FORCE HUGGING FACE SECURITY OVERRIDES (MUST BE AT THE TOP, before any HF imports)
os.environ["HF_TRUST_REMOTE_CODE"] = "1"
os.environ["TRUST_REMOTE_CODE"] = "True"

from dotenv import load_dotenv

load_dotenv()

# ── Validate required environment variables ───────────────────────────────────

REQUIRED_KEYS = ["GOOGLE_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_NAME", "TAVILY_API_KEY"]
for key in REQUIRED_KEYS:
    if not os.getenv(key):
        raise ValueError(f"CRITICAL: {key} is missing from your .env file!")

# ── Exported config values ────────────────────────────────────────────────────

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

# ── Shared LLM, Embeddings, Pinecone Client, Tavily Tool ─────────────────────

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_tavily import TavilySearch
from pinecone import Pinecone

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.3)

# Local open-source embeddings (768 dims). trust_remote_code is MANDATORY.
embeddings = HuggingFaceEmbeddings(
    model_name="nomic-ai/nomic-embed-text-v1.5",
    model_kwargs={
        "device": "cpu",
        "trust_remote_code": True,  # Do not remove this
    },
)

pc = Pinecone(api_key=PINECONE_API_KEY)

tavily_tool = TavilySearch(max_results=3)
