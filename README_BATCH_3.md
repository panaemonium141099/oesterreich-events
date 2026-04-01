# Batch 3: Austrian Festival Images - Complete Reference

## Quick Start

This directory contains complete metadata and references for 36 images across 9 Austrian festivals from Wikimedia Commons. Everything is ready for image download and blog post creation.

### Key Files

- **`image_manifest_batch3.json`** - Machine-readable metadata for all 36 images
- **`BATCH_3_IMAGE_GUIDE.md`** - Implementation guide with download instructions
- **`BATCH_3_METADATA.txt`** - Plain-text reference for all image sources

### Related Files

- **`../BATCH_3_SUMMARY.md`** - Executive summary (parent directory)

## Festival Overview

| ID | Festival | Region | Theme |
|----|----------|--------|-------|
| 22 | Krampuslauf Schladming | Styria | Alpine demon parade |
| 23 | Nikolauspiel Bad Mitterndorf | Tirol | St. Nicholas tradition |
| 24 | Thaurer Palmprozession | Tirol | Palm Sunday procession |
| 25 | Osterfeuer Salzkammergut | Upper Austria | Easter bonfire |
| 26 | Maibaumaufstellen Mostviertel | Lower Austria | May pole raising |
| 27 | Wiener Erntedankfest | Vienna | Harvest festival |
| 28 | Martinifest Neusiedl am See | Burgenland | Martini wine festival |
| 29 | Langenlois Weinlesefest | Danube Valley | Wine harvest |
| 30 | Kufsteiner Kaiserfest | Tirol | Kaiser festival |

## Image Structure

Each festival has 4 images in different categories:

- **Hero** (1280x960) - Blog post header
- **Location Hero** (1280x960) - Landmark/venue
- **Gallery Detail** (1024x768) - Close-up/cultural element
- **Gallery Landscape/Cultural** (1024x768) - Scene/tradition context

## Getting Started

### 1. Review the Manifest
```bash
jq '.festivals[0]' image_manifest_batch3.json
```

### 2. Download Images
Use the API query method:
```bash
jq -r '.festivals[].images[] | "\(.url_pattern)"' image_manifest_batch3.json | while read url; do
  curl -s "$url" -o image.jpg
done
```

### 3. Create Blog Posts
Place downloaded images in the corresponding festival directory:
```bash
public/blog/22-krampuslauf-schladming/
public/blog/23-nikolauspiel-bad-mitterndorf/
# ... etc
```

## Documentation

Full implementation guides available in:
- `BATCH_3_IMAGE_GUIDE.md` - Step-by-step download & setup
- `BATCH_3_METADATA.txt` - Complete reference information
- `../BATCH_3_SUMMARY.md` - Project overview & status

## Licensing

All images are from Wikimedia Commons under CC-BY-SA 3.0 or CC-BY 4.0.
Attribution required - see manifest for photographer details.

## Source

**Wikimedia Commons:** https://commons.wikimedia.org

---
Generated: 2026-04-01 | Batch 3 | 36 Images | 9 Festivals
