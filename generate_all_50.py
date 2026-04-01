#!/usr/bin/env python3
"""
Master generator: Combines all festival data and generates 50 HTML blog posts.
"""
import sys
import os

# Add current dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path

# Import the original 3 festivals from the generator
from generate_festival_blogs import FESTIVALS as ORIGINAL_FESTIVALS, generate_html_post, escape_html

# Import batches 1-5
from festivals_batch1 import FESTIVALS_BATCH1
from festivals_batch2 import FESTIVALS_BATCH2
from festivals_batch3 import FESTIVALS_BATCH3
from festivals_batch4 import FESTIVALS_BATCH4
from festivals_batch5 import FESTIVALS_BATCH5

# Combine all festivals
ALL_FESTIVALS = (
    ORIGINAL_FESTIVALS +      # 1-3
    FESTIVALS_BATCH1 +        # 4-12
    FESTIVALS_BATCH2 +        # 13-21
    FESTIVALS_BATCH3 +        # 22-30
    FESTIVALS_BATCH4 +        # 31-40
    FESTIVALS_BATCH5          # 41-50
)

# Sort by num
ALL_FESTIVALS.sort(key=lambda f: f["num"])

def main():
    output_dir = Path("/sessions/tender-lucid-curie/mnt/burgenland-events-v5/blog-posts-brauchtum")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(ALL_FESTIVALS)} festival blog posts...")
    print(f"Output directory: {output_dir}\n")

    generated_files = []

    for festival in ALL_FESTIVALS:
        html = generate_html_post(festival)
        filename = f"{festival['slug']}.html"
        filepath = output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

        generated_files.append((festival['name'], filename, festival['num']))
        print(f"  ✓ {festival['num']:02d}/{len(ALL_FESTIVALS)}: {festival['name']}")

    # Generate combined file
    print(f"\n{'='*60}")
    print("Generating combined ALLE-50-POSTS.html...")

    combined_html = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alle 50 österreichischen Brauchtumsfeste — LassTreffen.at</title>
<meta name="description" content="Vollständige Sammlung aller 50 dokumentierten österreichischen Brauchtumsfeste mit Geschichte, Traditionen, Programm und Anreise.">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#FAF8F5;--bg-dark:#1A1714;--text:#1C1917;--text2:#57534E;--muted:#A8A29E;--accent:#B45309;--accent-light:#FEF3C7;--accent-glow:#F59E0B;--border:#E7E5E4;--surface:#fff;--serif:'Playfair Display',Georgia,serif;--sans:'Inter',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace;--cw:680px}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.7}
.cover{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4rem 2rem;background:var(--bg-dark);color:#fff}
.cover h1{font-family:var(--serif);font-size:clamp(2rem,5vw,3.5rem);font-weight:900;margin-bottom:1rem}
.cover p{font-size:1.125rem;color:rgba(255,255,255,.6);max-width:600px}
.cover .count{font-family:var(--mono);font-size:.75rem;color:var(--accent-glow);letter-spacing:.2em;text-transform:uppercase;margin-bottom:2rem}
.toc-container{max-width:900px;margin:0 auto;padding:4rem 1.5rem}
.toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem;list-style:none}
.toc-grid a{display:flex;align-items:center;gap:1rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);text-decoration:none;transition:all .3s;font-size:.9375rem;font-weight:500}
.toc-grid a:hover{border-color:var(--accent);box-shadow:0 4px 12px rgba(180,83,9,.08);transform:translateY(-1px)}
.toc-grid .num{font-family:var(--mono);font-size:.75rem;color:var(--accent);min-width:28px}
.toc-grid .region{display:block;font-size:.6875rem;color:var(--muted);font-weight:400;margin-top:.15rem}
.page-break{margin:0;padding:0;border:none}
.separator{max-width:var(--cw);margin:6rem auto;display:flex;align-items:center;gap:1rem;padding:0 1.5rem}
.separator span:first-child,.separator span:last-child{flex:1;height:2px;background:var(--accent)}
.separator .num{font-family:var(--mono);font-size:.875rem;color:var(--accent);font-weight:700}
</style>
</head>
<body>

<div class="cover">
  <p class="count">LassTreffen.at · Blog-Sammlung</p>
  <h1>50 Österreichische Brauchtumsfeste</h1>
  <p>Von Perchtenläufen bis Adventmärkten — eine Reise durch die lebendigen Traditionen Österreichs.</p>
</div>

<nav class="toc-container">
  <ol class="toc-grid">
"""

    for name, filename, num in generated_files:
        slug = filename.replace('.html', '')
        # Get region from festival data
        festival = next(f for f in ALL_FESTIVALS if f['num'] == num)
        region = escape_html(festival.get('bundesland', festival.get('region', '')))
        combined_html += f'    <li><a href="#{slug}"><span class="num">{num:02d}</span><div>{escape_html(name)}<span class="region">{region}</span></div></a></li>\n'

    combined_html += """  </ol>
</nav>

"""

    # Include each post's body content
    for i, (name, filename, num) in enumerate(generated_files):
        filepath = output_dir / filename

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        if i > 0:
            combined_html += f'<div class="separator"><span></span><span class="num">{num:02d} / 50</span><span></span></div>\n'

        body_start = content.find('<body>')
        body_end = content.rfind('</body>')
        if body_start != -1 and body_end != -1:
            body_content = content[body_start + 6:body_end]
            slug = filename.replace('.html', '')
            combined_html += f'<div id="{slug}" class="page-break">{body_content}</div>\n'

    combined_html += """
</body>
</html>
"""

    combined_path = output_dir / "ALLE-50-POSTS.html"
    with open(combined_path, 'w', encoding='utf-8') as f:
        f.write(combined_html)

    print(f"  ✓ Combined file: ALLE-50-POSTS.html")
    print(f"\n{'='*60}")
    print(f"DONE: {len(generated_files)} individual + 1 combined = {len(generated_files) + 1} files")
    print(f"Location: {output_dir}")


if __name__ == "__main__":
    main()
