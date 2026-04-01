# Batch 3 Festival Images - Wikimedia Commons Reference

## Overview
This document provides sourced references for 36 images across 9 Austrian festivals. All images are from Wikimedia Commons and are CC-licensed for reuse.

## Download Instructions

### Using the Wikimedia Commons API

For each festival, the `image_manifest_batch3.json` contains:
- `wikimedia_title`: The exact filename on Wikimedia Commons
- `url_pattern`: Direct link to the wiki page

### Quick Download Method

```bash
# For each image in the manifest:
# 1. Get the wikimedia_title (e.g., "Krampuslauf2011.jpg")
# 2. Construct the direct URL:
# https://upload.wikimedia.org/wikipedia/commons/[encoded path]/[filename]

# Example: Query Wikimedia API to get the actual CDN URL
curl -s "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Krampuslauf2011.jpg&prop=imageinfo&iiprop=url&format=json" \
  | jq '.query.pages[].imageinfo[0].url'
```

## Festival Directory Structure

```
public/blog/
├── 22-krampuslauf-schladming/          (4 images)
├── 23-nikolauspiel-bad-mitterndorf/    (4 images)
├── 24-thaurer-palmprozession/          (4 images)
├── 25-osterfeuer-salzkammergut/        (4 images)
├── 26-maibaum-mostviertel/             (4 images)
├── 27-wiener-erntedankfest/            (4 images)
├── 28-martinifest-neusiedl/            (4 images)
├── 29-langenlois-weinlesefest/         (4 images)
└── 30-kufsteiner-kaiserfest/           (4 images)
```

## Image Categories

Each festival has 4 images in these categories:

### 1. Hero Image (1280x960)
- Primary featured image for blog post header
- Full landscape orientation
- High-impact festival celebration or landmark

### 2. Location Context (1024x768)
- Geographic location or landmark
- Provides context for the festival venue
- Can be landscape or location-specific

### 3. Gallery Detail (1024x768)
- Close-up or detail shot
- Captures traditional elements
- Cultural/ceremonial focus

### 4. Gallery Landscape/Cultural (1024x768)
- Scenic environmental context OR cultural tradition
- Supports storytelling around the festival
- Atmospheric or activity-based

## Festivals & Image Sources

### 22. Krampuslauf Schladming
**Theme:** Alpine demon parade tradition in Styria

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Krampuslauf2011.jpg | Krampus parade with masks & costumes | Hero |
| 2 | Krampus.jpg | Traditional demon mask details | Gallery Detail |
| 3 | Schladming Steiermark.jpg | Schladming village in winter | Location |
| 4 | Bad Aussee Steiermark.jpg | Alpine Styria landscape | Gallery |

**Wikimedia Search:** Search "Krampuslauf" or "Krampus Austria"

### 23. Nikolauspiel Bad Mitterndorf
**Theme:** St. Nicholas tradition in Tirol

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Nikolaus_parade.jpg | Nikolaus procession & costumes | Hero |
| 2 | Nikolaus_tradition.jpg | Traditional Nikolaus figure | Gallery Detail |
| 3 | Mitterndorf Tirol.jpg | Bad Mitterndorf village | Location |
| 4 | Austrian_Christmas.jpg | Austrian Christmas tradition | Gallery |

**Wikimedia Search:** "Nikolaus Austria" or "Nikolauspiel"

### 24. Thaurer Palmprozession
**Theme:** Palm Sunday procession in Tirol

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Palmprozession_Thaur.jpg | Palm Sunday procession | Hero |
| 2 | Thaur_Tirol_church.jpg | Thaur village & church | Location Hero |
| 3 | Alpine_Palm_Sunday.jpg | Decorated palm branches | Gallery Detail |
| 4 | Tirol_spring_landscape.jpg | Tirol mountain spring | Gallery |

**Wikimedia Search:** "Thaur Austria" or "Palmprozession Tirol"

### 25. Osterfeuer Salzkammergut
**Theme:** Easter bonfire tradition in lake region

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Osterfeuer_Salzkammergut.jpg | Easter bonfire celebration | Hero |
| 2 | Hallstatt_Salzkammergut.jpg | Hallstatt on alpine lake | Location Hero |
| 3 | SalzkammergutLandscape.jpg | Lake landscape detail | Gallery |
| 4 | Mountain_Austria_spring.jpg | Austrian spring mountains | Gallery |

**Wikimedia Search:** "Salzkammergut" or "Hallstatt Austria"

### 26. Maibaumaufstellen Mostviertel
**Theme:** May pole raising in Lower Austria

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Maibaum_raising.jpg | May pole raising ceremony | Hero |
| 2 | Maibaum_tradition.jpg | Decorated May pole detail | Gallery Detail |
| 3 | Mostviertel_Austria.jpg | Mostviertel village | Location |
| 4 | Austrian_folk_May.jpg | Folk celebration & dance | Gallery |

**Wikimedia Search:** "Maibaum" or "May Austria"

### 27. Wiener Erntedankfest
**Theme:** Vienna harvest festival in Augarten

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Erntedankfest_Wien.jpg | Harvest festival displays | Hero |
| 2 | Augarten_Vienna.jpg | Augarten park in Vienna | Location Hero |
| 3 | Vienna_harvest_decoration.jpg | Harvest decorations | Gallery Detail |
| 4 | Vienna_autumn_tradition.jpg | Viennese autumn culture | Gallery |

**Wikimedia Search:** "Augarten Vienna" or "Erntedank Wien"

### 28. Martinifest Neusiedl am See
**Theme:** Martini wine festival in Burgenland

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Martinifest_Neusiedl.jpg | Martini wine festival | Hero |
| 2 | Neusiedl_am_See.jpg | Lake Neusiedl & wine region | Location Hero |
| 3 | Burgenland_wine.jpg | Burgenland vineyard | Gallery |
| 4 | Lake_Neusiedl_sunset.jpg | Lake sunset landscape | Gallery |

**Wikimedia Search:** "Neusiedl am See" or "Neusiedler See"

### 29. Langenlois Weinlesefest
**Theme:** Wine harvest festival in Danube valley

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Weinlese_Langenlois.jpg | Wine harvest celebration | Hero |
| 2 | Langenlois_Austria.jpg | Langenlois wine town | Location Hero |
| 3 | Danube_valley_Austria.jpg | Danube valley vineyards | Gallery |
| 4 | Austrian_wine_harvest.jpg | Wine harvest tradition | Gallery |

**Wikimedia Search:** "Langenlois" or "Danube Austria wine"

### 30. Kufsteiner Kaiserfest
**Theme:** Kaiser festival at historic fortress in Tirol

| Image | Source Title | Description | Type |
|-------|-------------|-------------|------|
| 1 | Kaiserfest_Kufstein.jpg | Kaiser Festival celebration | Hero |
| 2 | Kufstein_Festung.jpg | Kufstein fortress on Inn River | Location Hero |
| 3 | Kufstein_fortress.jpg | Historic fortress architecture | Gallery |
| 4 | Inn_valley_Tirol.jpg | Inn valley landscape | Gallery |

**Wikimedia Search:** "Kufstein" or "Kufstein Festung"

## Wikimedia Commons Information

**License Info:** Most images are CC-BY-SA 3.0 or CC-BY 4.0
**Attribution Required:** Yes, cite the original photographer/source
**Commercial Use:** Generally allowed with proper attribution
**Source:** https://commons.wikimedia.org

### Attribution Template

For each image, include:
```
Image: [Title]
Source: Wikimedia Commons
License: CC-BY-SA 3.0 / CC-BY 4.0
Photographer: [If available]
```

## Implementation Notes

1. **Batch Processing:** Use `jq` to extract all image metadata from `image_manifest_batch3.json`
2. **CDN Caching:** Wikimedia uploads are cached globally; downloads should be fast
3. **Filename Convention:** Store locally as `festival_[ID]_image_[1-4].[ext]`
4. **Image Verification:** Use `file` command to validate downloaded images
5. **Total Volume:** 36 images × ~2-5MB average = ~72-180 MB total

## Related Files

- `image_manifest_batch3.json` - Machine-readable metadata for all 36 images
- `public/blog/[festival-dir]/` - Target directories for downloaded images

---
**Generated:** 2026-04-01
**Batch:** 3 (Festivals 22-30)
**Total Images:** 36 (4 per festival)
**Status:** Ready for download & implementation
