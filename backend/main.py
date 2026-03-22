import os

# 1. FORCE HUGGING FACE SECURITY OVERRIDES (MUST BE AT THE TOP)
os.environ["HF_TRUST_REMOTE_CODE"] = "1"
os.environ["TRUST_REMOTE_CODE"] = "True"

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Modern LangChain & Pinecone Imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders import YoutubeLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from pinecone import Pinecone

# Pure LCEL Imports (No legacy chains)
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

required_keys = ["GOOGLE_API_KEY", "PINECONE_API_KEY", "PINECONE_INDEX_NAME"]
for key in required_keys:
    if not os.getenv(key):
        raise ValueError(f"CRITICAL: {key} is missing from your .env file!")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    url: str
    question: str

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = os.getenv("PINECONE_INDEX_NAME")

# Track videos we've already indexed in this session to avoid Pinecone's delayed stats issue
indexed_videos = set()

# 2. LOCAL OPEN SOURCE EMBEDDING SETUP
# Outputs exactly 768 dimensions for Pinecone. trust_remote_code is MANDATORY here.
embeddings = HuggingFaceEmbeddings(
    model_name="nomic-ai/nomic-embed-text-v1.5",
    model_kwargs={
        'device': 'cpu', 
        'trust_remote_code': True  # Do not remove this
    } 
)

def get_vector_store(video_url: str):
    video_id = video_url.split("v=")[-1].split("&")[0] 
    
    vectorstore = PineconeVectorStore(
        index_name=index_name,
        embedding=embeddings,
        namespace=video_id
    )

    # 1. Fast check: Have we processed this video since the server started?
    if video_id in indexed_videos:
        print(f"--- Video {video_id} already indexed (Local Cache Hit) ---")
        return vectorstore

    # 2. Fallback check: Check Pinecone directly (note: can be delayed by a few minutes)
    index = pc.Index(index_name)
    stats = index.describe_index_stats()
    
    if video_id not in stats.get('namespaces', {}):
        print(f"--- Indexing New Video: {video_id} ---")
        try:
            # Setting add_video_info=False bypasses pytube which is currently broken (HTTP 400 errors)
            loader = YoutubeLoader.from_youtube_url(video_url, add_video_info=False)
            data = loader.load()
            
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            docs = text_splitter.split_documents(data)
            
            vectorstore.add_documents(docs)
            indexed_videos.add(video_id) # Mark as done!
            print(f"--- Successfully Uploaded to Pinecone ---")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    else:
        indexed_videos.add(video_id) # It was already in Pinecone from an older session
    
    return vectorstore

# Helper function to format the retrieved documents for the prompt
def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

@app.post("/chat")
async def chat_with_video(request: ChatRequest):
    try:
        vector_store = get_vector_store(request.url)
        retriever = vector_store.as_retriever(search_kwargs={'k': 5})
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)
        
        prompt = ChatPromptTemplate.from_template("""
        You are a helpful YouTube video assistant. Answer the user's question based strictly on the video transcript context below. 
        If the answer is not in the context, say "I cannot find the answer in this video's transcript." Do not make up information.

        Context:
        {context}

        Question: {input}
        """)
        
        # The LCEL RAG Pipeline: Retriever -> Formatter -> Prompt -> LLM -> String
        rag_chain = (
            {"context": retriever | format_docs, "input": RunnablePassthrough()}
            | prompt
            | llm
            | StrOutputParser()
        )
        
        # Execute
        response = rag_chain.invoke(request.question)
        
        return {"answer": response}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)