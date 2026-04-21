---
name: image-fetcher
description: Search public image sources and download images that match a requested description, optional tags, and preferred resolution. Use when users want images discovered by criteria from sources such as Google Images, Unsplash, Wikimedia Commons, Pexels, Pixabay, or when they already have direct image URLs to download.
---

# Image Fetcher Skill

This skill is for finding and downloading images from public web sources. It still supports direct URL downloads, but its default mode is search-first:

- accept a `description`
- accept optional `tags`
- accept an optional `resolution`
- search public image sources for matching results
- download the best match or best matches locally

## When to Use This Skill

Use this skill when the user requests:
- Finding images by content instead of by exact URL
- Searching public sources such as Google Images or Unsplash
- Downloading reference, stock, editorial, or illustrative images
- Saving images locally for embedding in documents, chats, or prototypes
- Batch downloading multiple images that match the same brief
- Downloading images from specific URLs that the user already has

## Accepted Input

The user can provide the request in natural language or as explicit fields:

- `description` (required): what the image should contain
- `tags` (optional): style, mood, color, orientation, exclusions, subject modifiers, or usage constraints
- `resolution` (optional): exact or minimum size, for example `1024x1024`, `1920x1080`, `at least 2048px wide`, or `4k`
- `count` (optional): number of images to download; default `1`
- `sources` (optional): preferred sources such as `unsplash`, `google images`, `wikimedia commons`, `pexels`, or `pixabay`
- `output_directory` (optional): directory to save downloaded files
- `filename_prefix` (optional): prefix to use when naming saved files

If the user only gives natural language, infer these fields before searching.

## Supported Sources

Use public sources only. Typical discovery and download sources include:

- Google Images for discovery
- Unsplash
- Wikimedia Commons
- Pexels
- Pixabay
- Public image pages found through normal web search

Google Images should usually be treated as a discovery layer. Prefer downloading the full image from the underlying source page instead of saving a low-resolution thumbnail or a transient preview URL.

## Supported Image Formats

The skill automatically detects and handles these formats:
- JPG/JPEG
- PNG
- GIF
- WebP
- BMP
- SVG
- ICO
- TIFF/TIF

## Core Workflows

### Search by Description, Tags, and Resolution

Use this as the default workflow.

1. Normalize the request into search parameters.
2. Build one or more search queries from `description`, `tags`, and `resolution`.
3. Search public sources and collect candidate images.
4. Filter candidates for relevance, image quality, and size.
5. Download the best match or best matches with the existing fetch scripts.
6. Report the saved file paths and source links.

### Query Construction

Start with the description, then add tags and resolution hints.

Examples:

```text
description: cozy Japanese cafe interior
tags: warm lighting, wood, no people, editorial
resolution: at least 1920x1080
```

Possible queries:

- `cozy Japanese cafe interior warm lighting wood no people editorial 1920x1080`
- `site:unsplash.com cozy Japanese cafe interior warm lighting wood`
- `site:commons.wikimedia.org cozy Japanese cafe interior`
- `cozy Japanese cafe interior Google Images 1920x1080`

### Candidate Filtering Rules

Prefer candidates that:

- clearly match the requested subject and tags
- meet or exceed the requested resolution
- have a direct image file URL or a stable source page with an original asset
- are public, not paywalled, and do not require sign-in
- are not watermarked unless the user explicitly accepts that

Avoid:

- tiny thumbnails
- screenshots of image previews
- tracking URLs
- blocked or rate-limited pages when a public alternative exists
- copyrighted images with unclear licensing if the user asked for commercial-safe assets

If the requested resolution is not available, pick the closest higher-quality match and state the actual size you found if you can determine it.

### Single Image Download from a Direct URL

To download a single image from a URL:

```bash
python scripts/fetch_image.py <image_url> [output_directory] [filename]
```

**Parameters:**
- `image_url` (required): URL of the image to download
- `output_directory` (optional): Directory to save the image (defaults to current directory)
- `filename` (optional): Custom filename for the saved image (defaults to URL filename)

**Examples:**
```bash
# Basic download to current directory
python scripts/fetch_image.py https://example.com/photo.jpg

# Download to specific directory
python scripts/fetch_image.py https://example.com/photo.jpg ./downloads

# Download with custom filename
python scripts/fetch_image.py https://example.com/photo.jpg ./downloads myimage.jpg
```

### Batch Download of Search Results

After collecting multiple direct image URLs, save them to a text file or JSON file and run:

```bash
python scripts/fetch_images_batch.py <urls_file> [output_directory]
```

Use this when the user asks for multiple options that match the same brief.

### Batch Download from Existing URLs

To download multiple images from a known list of URLs:

```bash
python scripts/fetch_images_batch.py <urls_file> [output_directory]
```

**Input file formats:**
1. Text file with one URL per line
2. JSON file with array of URLs: `["url1", "url2", ...]`

**Examples:**
```bash
# Download from text file
python scripts/fetch_images_batch.py urls.txt

# Download to specific directory
python scripts/fetch_images_batch.py urls.json ./images

# Create a URL list on the fly
echo -e "https://example.com/img1.jpg\nhttps://example.com/img2.png" > urls.txt
python scripts/fetch_images_batch.py urls.txt ./downloads
```

The batch script creates a `fetch_results.json` file with detailed results for each download.

## Integration with Claude Workflow

### Search Then Download

For a criteria-based request:

1. Parse `description`, `tags`, and `resolution`.
2. Search preferred public sources first.
3. Open the best candidate pages.
4. Extract the direct image URL when possible.
5. Download with `fetch_image.py` or `fetch_images_batch.py`.
6. Return file paths plus source attribution.

### For Document Embedding

When fetching images to embed in documents (DOCX, PPTX, etc.):

1. Download the image to a temporary location
2. Use the returned file path to embed the image in the document
3. Clean up temporary files if needed

```bash
# Download image
python scripts/fetch_image.py https://example.com/chart.png /home/claude/temp

# The script outputs the full path which can be used for embedding
# Example output: /home/claude/temp/chart.png
```

### For Chat Display

When downloading images to display in chat:

1. Download to `/mnt/user-data/outputs/` directory
2. Provide the user with a link to the downloaded image

```bash
python scripts/fetch_image.py https://example.com/image.jpg /mnt/user-data/outputs
```

### Search Integration

When combined with browser or web search tools:

1. Search by `description`, `tags`, and `resolution`
2. Use source-specific queries when the user names a preferred source
3. Open result pages and extract the best direct image URLs
4. Download the selected files with this skill's scripts

## Preferred Source Strategy

Use the source mix that best fits the request:

- For stock-like photography, prefer Unsplash, Pexels, and Pixabay
- For encyclopedic or historical material, prefer Wikimedia Commons
- For broad discovery, use Google Images to find relevant source pages
- For branded or site-specific assets, search the target site directly first

If the user requests a source explicitly, honor that first before broadening the search.

## Error Handling

The scripts handle common scenarios:
- Invalid URLs
- Network timeouts
- Unsupported formats
- Permission errors
- Missing directories (auto-created)

Failed downloads are reported with clear error messages.

## Output Information

Each successful download provides:
- Full path to saved file
- File size in KB
- Content-Type from server
- Success confirmation

For search-based requests, also provide when possible:

- Source page URL
- Original image URL
- Actual image dimensions
- Short note about how closely the result matched the requested criteria

## Best Practices

1. Validate direct image URLs before downloading.
2. Prefer original source assets over preview thumbnails.
3. Use source pages to confirm relevance, size, and licensing when needed.
4. Use batch downloading when collecting multiple matching options.
5. Specify an output directory so results stay organized.
6. Tell the user when any assumption was inferred from a vague request.
7. Do not bypass authentication, paywalls, or anti-bot controls.

## Common Use Cases

**Use Case 1: Search by brief**

```text
description: minimalist home office desk setup
tags: natural light, white oak, no people
resolution: at least 1600x900
count: 3
sources: unsplash, google images
```

Search those sources, collect the best matching URLs, then download them with the batch script.

**Use Case 2: Embedding web images in presentations**

```bash
# User: "Add this chart to my presentation: https://data.com/chart.png"
python scripts/fetch_image.py https://data.com/chart.png /home/claude/temp
# Then use the path to embed in PPTX
```

**Use Case 3: Creating image gallery from search results**

```text
description: matcha dessert close-up
tags: studio lighting, shallow depth of field
resolution: 2048x2048
count: 5
```

Search, collect 5 direct image URLs, save them to `urls.txt`, then run:

```bash
python scripts/fetch_images_batch.py urls.txt /mnt/user-data/outputs/gallery
```

**Use Case 4: Creating image gallery from URLs**

```bash
# User: "Download these product images and save them"
# Create urls.txt with image URLs
python scripts/fetch_images_batch.py urls.txt /mnt/user-data/outputs/gallery
```

**Use Case 5: Logo download for branding**

```bash
# User: "Get the company logo from their website"
python scripts/fetch_image.py https://company.com/logo.svg /home/claude/assets logo.svg
```

## Technical Notes

- Search is tool-driven and source-dependent; downloading is handled by the bundled Python scripts
- The download scripts use `requests` with browser-like headers
- Files are streamed to disk for memory efficiency
- Each download uses a 30-second timeout
- File type is inferred from the URL and response content-type
- Output directories are created automatically when they do not exist
