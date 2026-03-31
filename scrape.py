import urllib.request
import json
import os
import re
import datetime

CELEBRITY_POOLS = {
    "women_pop": [
        "Britney Spears", "Madonna", "Lady Gaga", "Dua Lipa", "Rihanna",
        "Billie Eilish", "Ariana Grande", "Katy Perry", "Nicki Minaj",
        "Cardi B", "Doja Cat", "Megan Thee Stallion", "Selena Gomez", 
        "Taylor Swift", "Shakira", "Karol G"
    ],
    "men_hollywood": [
        "Tom Cruise", "Antonio Banderas", "Pedro Pascal", "Oscar Isaac",
        "Dwayne Johnson", "Leonardo DiCaprio", "Johnny Depp", 
        "Keanu Reeves", "Brad Pitt", "Will Smith", "George Clooney", 
        "Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Chris Pratt", 
        "Tom Holland", "Timothee Chalamet"
    ],
    "women_hollywood": [
        "Zendaya", "Margot Robbie", "Blake Lively", "Scarlett Johansson",
        "Florence Pugh", "Jenna Ortega", "Millie Bobby Brown", "Gal Gadot",
        "Sandra Bullock", "Jennifer Aniston", "Angelina Jolie", "Meryl Streep",
        "Halle Berry", "Nicole Kidman", "Emma Watson"
    ],
    "tech_billionaires": [
        "Jeff Bezos", "Elon Musk", "Tim Cook", "Zuckerberg", "Bill Gates", 
        "Warren Buffett"
    ],
    "men_athletes": [
        "Tiger Woods", "Cristiano Ronaldo", "Lionel Messi", "LeBron James",
        "Stephen Curry", "Tom Brady", "Lewis Hamilton", "Conor McGregor"
    ]
}

RSS_FEEDS = [
    "https://www.tmz.com/rss.xml",
    "https://www.tmz.com/category/music/rss.xml",
    "https://www.tmz.com/category/movies/rss.xml",
    "https://www.tmz.com/category/sports/rss.xml"
]

def fetch_rss(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return response.read().decode('utf-8')

def parse_rss(xml):
    items = []
    item_pattern = re.compile(r'<item>([\s\S]*?)<\/item>')
    title_pattern = re.compile(r'<title>([\s\S]*?)<\/title>')
    desc_pattern = re.compile(r'<description>([\s\S]*?)<\/description>')

    matches = item_pattern.findall(xml)
    for match in matches:
        title_match = title_pattern.search(match)
        desc_match = desc_pattern.search(match)

        title = title_match.group(1).strip() if title_match else ""
        desc = desc_match.group(1).strip() if desc_match else ""

        # Clean CDATA and HTML
        title = re.sub(r'<!\[CDATA\[|\]\]>', '', title).strip()
        desc = re.sub(r'<!\[CDATA\[|\]\]>', '', desc).strip()
        desc = re.sub(r'<[^>]+>', '', desc).strip() # Strip HTML

        if title and desc:
            items.append({"title": title, "desc": desc})
    return items

def find_celebrity(text):
    for group, celebs in CELEBRITY_POOLS.items():
        for celeb in celebs:
            if celeb.lower() in text.lower():
                return celeb, group
    return None, None

def main():
    try:
        all_items = []
        for url in RSS_FEEDS:
            try:
                print(f"Fetching live feed from {url}...")
                xml_data = fetch_rss(url)
                items = parse_rss(xml_data)
                all_items.extend(items)
                print(f"Successfully parsed {len(items)} items from {url}")
            except Exception as e:
                print(f"Failed to pull {url}: {e}")

        print(f"Total stories parsed: {len(all_items)}")

        valid_questions = []
        
        # Deduplication mapping (prevent duplicate stories)
        seen_titles = set()

        import random
        for item in all_items:
            if item['title'] in seen_titles:
                continue
            seen_titles.add(item['title'])

            celebrity, group = find_celebrity(item['title'] + " " + item['desc'])
            if celebrity:
                p_pool = CELEBRITY_POOLS[group]
                distractor = random.choice(p_pool)
                while distractor == celebrity:
                    distractor = random.choice(p_pool)

                options = [celebrity, distractor]
                if random.random() > 0.5:
                    options.reverse()

                correct_index = options.index(celebrity)

                # REDACT CELEBRITY NAMES FROM TEXT (Make it a guessing game)
                masked_text = re.sub(re.escape(celebrity), 'This Celebrity', item['desc'], flags=re.IGNORECASE)
                
                # Also redact first name if it's a two-part name (e.g., "Britney" from "Britney Spears")
                name_parts = celebrity.split(" ")
                if len(name_parts) > 1:
                    first_name = name_parts[0]
                    masked_text = re.sub(r'\b' + re.escape(first_name) + r'\b', 'This Celebrity', masked_text, flags=re.IGNORECASE)

                # CLEAN UP TEXT AND FIND SENTENCE BOUNDARIES
                # Strip leading attributions
                clean_text = re.sub(r'(?i)^(according to tmz|according to people|according to us weekly|tmz reports|tmz has learned|tmz|perez hilton|perezhilton)\s*[-—:]?\s*', '', masked_text)
                
                # Sentence Aggregator (guarantees full sentences)
                accumulated = ""
                for match in re.finditer(r'([^.!?]+[.!?])\s*', clean_text):
                    sentence = match.group(1)
                    if len(accumulated) + len(sentence) < 220:
                        accumulated += sentence + " "
                    else:
                        break

                if accumulated:
                    clean_text = accumulated.strip()
                else:
                    # If the first sentence itself is longer than 220, find the first sentence regardless of length
                    first_match = re.search(r'([^.!?]+[.!?])\s*', clean_text)
                    if first_match:
                        # Slice it if it's too long, but at a space
                        fs = first_match.group(1)
                        if len(fs) > 220:
                            sc = fs[:217].rfind(' ')
                            clean_text = fs[:sc] + '...'
                        else:
                            clean_text = fs
                    else:
                        # Fallback for weird run-on text
                        sc = clean_text[:217].rfind(' ')
                        clean_text = clean_text[:sc] + '...'

                print(f"Resolving photos for {options[0]} and {options[1]}...")
                img1 = get_wikipedia_image_url(options[0])
                img2 = get_wikipedia_image_url(options[1])

                # Skip questions if we can't find real photos for both candidates!
                if not img1 or not img2:
                    print(f"Skipping question due to missing photos for {options[0]} or {options[1]}")
                    continue

                valid_questions.append({
                    "text": clean_text,
                    "options": options,
                    "images": [img1, img2],
                    "correctIndex": correct_index
                })

        print(f"Generated {len(valid_questions)} live questions.")

        output_js = f"""// Auto-generated Questions on {datetime.datetime.now().isoformat()}
const questions_live = {json.dumps(valid_questions, indent=4)};
"""

        output_path = os.path.join(os.path.dirname(__file__), 'questions_live.js')
        with open(output_path, 'w') as f:
            f.write(output_js)
        print(f"Successfully wrote {output_path}")

    except Exception as e:
        print(f"Scrape failure: {e}")

def get_wikipedia_image_url(celebrity_name):
    api_url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "titles": celebrity_name,
        "piprop": "original",
        "formatversion": "2"
    }
    url = f"{api_url}?{urllib.parse.urlencode(params)}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            pages = data.get("query", {}).get("pages", [])
            if pages:
                page = pages[0]
                if "original" in page:
                    return page["original"]["source"]
    except Exception as e:
        print(f"Wikipedia fetch error for {celebrity_name}: {e}")
    
    return None

if __name__ == "__main__":
    main()
