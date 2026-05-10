from langchain_community.document_loaders import YoutubeLoader

try:
    loader = YoutubeLoader.from_youtube_url(
        "https://www.youtube.com/watch?v=K_-oWRYBkmE", 
        add_video_info=False,
        language=["en", "hi", "en-US"]
    )
    data = loader.load()
    print("Success. Length:", len(data))
    if data:
        print(data[0].page_content[:100])
except Exception as e:
    print("Error:", str(e))
