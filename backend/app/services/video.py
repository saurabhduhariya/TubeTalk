from typing import List
import yt_dlp

from fastapi import HTTPException
from langchain_community.document_loaders import YoutubeLoader
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.config import pc, embeddings, PINECONE_INDEX_NAME

# Track videos already indexed in this session to avoid Pinecone's delayed stats
_indexed_videos: set = set()


def get_vector_store(video_url: str) -> PineconeVectorStore:
    """Return a PineconeVectorStore for the given video, indexing it if needed."""
    video_id = video_url.split("v=")[-1].split("&")[0]

    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings,
        namespace=video_id,
    )

    if video_id in _indexed_videos:
        print(f"--- Video {video_id} already indexed (Local Cache Hit) ---")
        return vectorstore

    index = pc.Index(PINECONE_INDEX_NAME)
    stats = index.describe_index_stats()

    if video_id not in stats.get("namespaces", {}):
        print(f"--- Indexing New Video: {video_id} ---")
        try:
            loader = YoutubeLoader.from_youtube_url(
                video_url, 
                add_video_info=False,
                language=["en", "en-US", "en-GB", "en-IN", "hi", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh-Hans", "zh-Hant"]
            )
            data = loader.load()

            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=100
            )
            docs = text_splitter.split_documents(data)

            vectorstore.add_documents(docs)
            _indexed_videos.add(video_id)
            print("--- Successfully Uploaded to Pinecone ---")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Transcription failed: {str(e)}"
            )
    else:
        _indexed_videos.add(video_id)

    return vectorstore


def format_docs(docs: List[Document]) -> str:
    """Stringify a list of Documents for the LLM prompt."""
    if not docs:
        return "No relevant context found."
    return "\n\n".join(doc.page_content for doc in docs)

def get_video_metadata(video_url: str) -> str:
    """Extract the YouTube video title, description, and chapters."""
    try:
        ydl_opts = {'skip_download': True, 'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
        title = info.get('title', 'Unknown Title')
        description = info.get('description', 'No description available.')
        chapters = info.get('chapters')
        
        metadata_str = f"Title: {title}\nDescription: {description}\n"
        
        if chapters:
            metadata_str += "\nChapters:\n"
            for chapter in chapters:
                start_time = int(chapter.get('start_time', 0))
                title = chapter.get('title', 'Untitled')
                minutes, seconds = divmod(start_time, 60)
                metadata_str += f"[{minutes:02d}:{seconds:02d}] {title}\n"
                
        return metadata_str
    except Exception as e:
        print(f"Error extracting metadata: {e}")
        return "Metadata extraction failed."


# Cache for comments per video
_comments_cache: dict = {}


def get_video_comments(video_url: str, max_comments: int = 30) -> str:
    """Extract top YouTube comments via YouTube's internal API (no yt-dlp/JS needed)."""
    import json
    import urllib.request
    import re

    video_id = video_url.split("v=")[-1].split("&")[0]

    if video_id in _comments_cache:
        print(f"--- Comments for {video_id} (Cache Hit) ---")
        return _comments_cache[video_id]

    print(f"--- Fetching comments for {video_id} ---")
    try:
        # Step 1: Fetch the video page and extract ytInitialData JSON
        page_url = f"https://www.youtube.com/watch?v={video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        req = urllib.request.Request(page_url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            page_html = resp.read().decode('utf-8', errors='ignore')

        yt_data_match = re.search(r'var ytInitialData\s*=\s*(\{.+?\});\s*</script>', page_html)
        if not yt_data_match:
            yt_data_match = re.search(r'window\["ytInitialData"\]\s*=\s*(\{.+?\});\s*', page_html)

        if not yt_data_match:
            print("    Could not find ytInitialData in page")
            result = "No comments available for this video."
            _comments_cache[video_id] = result
            return result

        yt_data = json.loads(yt_data_match.group(1))

        # Step 2: Find the comment continuation token from the engagement panel
        continuation = None
        panels = yt_data.get('engagementPanels', [])
        for panel in panels:
            ep = panel.get('engagementPanelSectionListRenderer', {})
            if 'comment' in ep.get('panelIdentifier', '').lower():
                slr = ep.get('content', {}).get('sectionListRenderer', {})
                for section in slr.get('contents', []):
                    isr = section.get('itemSectionRenderer', {})
                    for item in isr.get('contents', []):
                        cir = item.get('continuationItemRenderer', {})
                        token = (cir.get('continuationEndpoint', {})
                                    .get('continuationCommand', {})
                                    .get('token', ''))
                        if token:
                            continuation = token
                            break

        if not continuation:
            print("    Could not find comments continuation token")
            result = "No comments available for this video."
            _comments_cache[video_id] = result
            return result

        print(f"    Found continuation token ({len(continuation)} chars)")

        # Step 3: Call YouTube's internal API
        api_url = "https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
        payload = json.dumps({
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20231219.04.00",
                    "hl": "en",
                    "gl": "US",
                }
            },
            "continuation": continuation,
        }).encode('utf-8')

        api_req = urllib.request.Request(
            api_url,
            data=payload,
            headers={**headers, 'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(api_req, timeout=15) as resp:
            api_data = json.loads(resp.read().decode('utf-8'))

        # Step 4: Extract comments from commentThreadRenderer → comment → commentRenderer
        comments = []
        endpoints = api_data.get('onResponseReceivedEndpoints', [])

        for ep in endpoints:
            # Comments are in reloadContinuationItemsCommand.continuationItems
            for key in ('reloadContinuationItemsCommand', 'appendContinuationItemsAction'):
                items = ep.get(key, {}).get('continuationItems', [])
                for item in items:
                    # Each comment thread
                    thread = item.get('commentThreadRenderer', {})
                    renderer = thread.get('comment', {}).get('commentRenderer', {})
                    if not renderer:
                        continue

                    runs = renderer.get('contentText', {}).get('runs', [])
                    text = ''.join(run.get('text', '') for run in runs)
                    author = renderer.get('authorText', {}).get('simpleText', 'Unknown')
                    vote_str = renderer.get('voteCount', {}).get('simpleText', '0')

                    # Parse like count
                    likes = 0
                    if vote_str:
                        v = vote_str.strip().upper()
                        try:
                            if 'K' in v:
                                likes = int(float(v.replace('K', '')) * 1000)
                            elif 'M' in v:
                                likes = int(float(v.replace('M', '')) * 1_000_000)
                            else:
                                likes = int(v)
                        except (ValueError, TypeError):
                            likes = 0

                    if text.strip():
                        comments.append({'author': author, 'text': text.strip(), 'likes': likes})

        if not comments:
            print("    No comments parsed from API response")
            result = "No comments available for this video."
            _comments_cache[video_id] = result
            return result

        sorted_comments = sorted(comments, key=lambda c: c['likes'], reverse=True)[:max_comments]

        lines = []
        for i, c in enumerate(sorted_comments, 1):
            lines.append(f"[{i}] {c['author']} ({c['likes']} likes): {c['text']}")

        result = "\n".join(lines)
        _comments_cache[video_id] = result
        print(f"    Fetched {len(lines)} top comments")
        return result

    except Exception as e:
        print(f"    Error extracting comments: {e}")
        result = "Comment extraction failed."
        _comments_cache[video_id] = result
        return result

