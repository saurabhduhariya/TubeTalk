"""Debug: Check what YouTube's first API call returns and find the next continuation."""
import json
import urllib.request
import re
import sys

video_id = sys.argv[1] if len(sys.argv) > 1 else "NPIvhbIcPN4"
page_url = f"https://www.youtube.com/watch?v={video_id}"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
}

print(f"Step 1: Fetching page for {video_id}...")
req = urllib.request.Request(page_url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    page_html = resp.read().decode('utf-8', errors='ignore')

yt_match = re.search(r'var ytInitialData\s*=\s*(\{.+?\});\s*</script>', page_html)
yt_data = json.loads(yt_match.group(1))

# Find engagement panel token
def find_panel_token(data):
    panels = data.get('engagementPanels', [])
    for panel in panels:
        ep = panel.get('engagementPanelSectionListRenderer', {})
        if 'comment' in ep.get('panelIdentifier', '').lower():
            slr = ep.get('content', {}).get('sectionListRenderer', {})
            for section in slr.get('contents', []):
                isr = section.get('itemSectionRenderer', {})
                for item in isr.get('contents', []):
                    cir = item.get('continuationItemRenderer', {})
                    token = cir.get('continuationEndpoint', {}).get('continuationCommand', {}).get('token', '')
                    if token:
                        return token
    return None

token1 = find_panel_token(yt_data)
print(f"  Token 1: {token1[:50]}... ({len(token1)} chars)")

def call_api(token):
    api_url = "https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
    payload = json.dumps({
        "context": {"client": {"clientName": "WEB", "clientVersion": "2.20231219.04.00", "hl": "en", "gl": "US"}},
        "continuation": token,
    }).encode('utf-8')
    api_req = urllib.request.Request(api_url, data=payload, headers={**headers, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(api_req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

print(f"\nStep 2: First API call...")
data1 = call_api(token1)
data1_str = json.dumps(data1)
print(f"  Response: {len(data1_str)} bytes")
print(f"  commentRenderer count: {data1_str.count('commentRenderer')}")
print(f"  continuationItemRenderer count: {data1_str.count('continuationItemRenderer')}")

# Find all continuation tokens in the response
tokens2 = re.findall(r'"token":"([^"]{50,})"', data1_str)
print(f"  Continuation tokens found: {len(tokens2)}")

# Check top-level keys
top_keys = list(data1.keys())
print(f"  Top-level keys: {top_keys}")

# Check for onResponseReceivedEndpoints
endpoints = data1.get('onResponseReceivedEndpoints', [])
print(f"  onResponseReceivedEndpoints: {len(endpoints)}")
for i, ep in enumerate(endpoints):
    ep_keys = list(ep.keys())
    print(f"    [{i}] keys: {ep_keys}")
    
    # Check for appendContinuationItemsAction or reloadContinuationItemsCommand
    for key in ep_keys:
        action = ep[key]
        if isinstance(action, dict):
            items = action.get('continuationItems', [])
            print(f"      continuationItems: {len(items)}")
            for j, item in enumerate(items[:3]):
                item_keys = list(item.keys())
                print(f"        [{j}] {item_keys}")

# If we find a second token, try it
if tokens2:
    print(f"\nStep 3: Second API call with token ({len(tokens2[0])} chars)...")
    data2 = call_api(tokens2[0])
    data2_str = json.dumps(data2)
    print(f"  Response: {len(data2_str)} bytes")
    print(f"  commentRenderer count: {data2_str.count('commentRenderer')}")
    
    if data2_str.count('commentRenderer') > 0:
        # Extract a sample comment
        def find_first_comment(obj):
            if isinstance(obj, dict):
                if 'commentRenderer' in obj:
                    r = obj['commentRenderer']
                    runs = r.get('contentText', {}).get('runs', [])
                    text = ''.join(run.get('text', '') for run in runs)
                    author = r.get('authorText', {}).get('simpleText', 'Unknown')
                    print(f"\n  Sample comment: {author}: {text[:100]}...")
                    return True
                for v in obj.values():
                    if find_first_comment(v):
                        return True
            elif isinstance(obj, list):
                for item in obj:
                    if find_first_comment(item):
                        return True
            return False
        find_first_comment(data2)
