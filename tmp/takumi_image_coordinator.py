#!/usr/bin/env python3
from __future__ import annotations

import json
import multiprocessing as mp
import os
import re
import subprocess
import sys
import time
import shutil
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path("/Users/manav/Documents/Repo/folio")
MARKDOWN = ROOT / "src/app/takumi-market-demo/image-replacer.md"
OUTPUT_DIR = ROOT / "public/takumi-market-demo/images/products"
STATUS_DIR = ROOT / "tmp/takumi-image-fetch-status"
SECTION_NAME = "7.1 Product Images"
SOURCE_CACHE: dict[str, Path] = {}

SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg", ".ico")
STOPWORDS = {
    "a", "an", "and", "or", "the", "with", "on", "in", "of", "for", "to", "from", "showing", "show", "detail",
    "close", "up", "side", "view", "natural", "light", "bright", "white", "pale", "soft", "minimal", "styled",
    "style", "japanese", "ceramic", "linen", "wood", "bowl", "plate", "knife", "runner", "tray", "stool",
}

BASE_QUERIES = {
    "kuro-oribe": ["tea bowl", "kuro oribe tea bowl", "oribe tea bowl", "raku bowl"],
    "morning-mist": ["ceramic plate", "celadon plate", "plate"],
    "limited-raku": ["raku bowl", "tea bowl", "black raku tea bowl"],
    "chawan": ["matcha bowl", "tea bowl", "ceremonial matcha"],
    "kettle": ["brass tea kettle", "tea kettle", "tea kettle and stand"],
    "gyuto": ["japanese chef knife wooden handle", "gyuto knife", "chef knife"],
    "petty": ["petty knife", "small knife", "knife"],
    "bread": ["bread knife", "serrated knife", "knife"],
    "kiridashi": ["kiridashi knife", "marking knife", "knife"],
    "runner": ["linen runner", "table runner", "runner"],
    "noren": ["noren curtain", "shop curtain", "linen curtain"],
    "cushion": ["sashiko textile", "cushion cover", "cushion"],
    "letterset": ["stationery", "paper stationery", "handmade paper stationery"],
    "journal": ["notebook writing", "thread bound notebook", "journal notebook"],
    "lantern": ["paper lantern", "white paper lantern", "lantern"],
    "board": ["wooden cutting board", "cutting board", "wood board"],
    "tea-tray": ["tea tray matcha", "tea tray", "serving tray"],
    "stool": ["oak stool", "wooden stool", "stool"],
    "drip": ["coffee pour over", "coffee pour over setup", "pour over coffee"],
    "incense": ["incense tray", "incense holder tray", "tray for incense"],
}

BASE_HINTS = {
    "kuro-oribe": ["tea bowl", "bowl", "oribe", "raku", "glaze"],
    "morning-mist": ["plate", "celadon", "ceramic"],
    "limited-raku": ["raku", "tea bowl", "bowl"],
    "chawan": ["matcha", "tea bowl", "bowl", "chasen", "chashaku"],
    "kettle": ["tea kettle", "kettle", "brass"],
    "gyuto": ["knife", "gyuto", "chef knife"],
    "petty": ["petty knife", "knife"],
    "bread": ["bread knife", "knife", "serrated"],
    "kiridashi": ["kiridashi", "marking knife", "knife"],
    "runner": ["runner", "table runner", "linen"],
    "noren": ["noren", "curtain", "shop curtain"],
    "cushion": ["cushion", "cover", "sashiko"],
    "letterset": ["stationery", "paper", "envelope", "letter"],
    "journal": ["notebook", "journal", "writing"],
    "lantern": ["lantern", "paper lantern"],
    "board": ["board", "cutting board", "wood"],
    "tea-tray": ["tray", "tea tray", "tea"],
    "stool": ["stool", "wood"],
    "drip": ["coffee", "pour over", "drip"],
    "incense": ["incense", "tray"],
}

BAD_TERMS = {
    "icon", "logo", "diagram", "poster", "map", "pdf", "djvu", "scan", "scientific",
}


@dataclass(frozen=True)
class Item:
    filename: str
    description: str
    tags: str
    resolution: str
    base: str


def parse_resolution(text: str) -> tuple[int, int]:
    m = re.search(r"(\d+)\s*[×x]\s*(\d+)", text)
    if not m:
        raise ValueError(f"Could not parse resolution: {text}")
    return int(m.group(1)), int(m.group(2))


def base_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    stem = re.sub(r"-(?:hero|process-\d+|\d+)$", "", stem)
    return stem


def extract_items() -> list[Item]:
    text = MARKDOWN.read_text()
    lines = text.splitlines()
    in_section = False
    items: list[Item] = []
    pattern = re.compile(
        r'- \[ \] `(?P<filename>[^`]+)` — Description: (?P<description>.*?)(?: Tags/search terms: `(?P<tags>[^`]*)`)?\. Resolution: `(?P<resolution>[^`]+)`\.'
    )
    for line in lines:
        if line.startswith("### 7.1 Product Images"):
            in_section = True
            continue
        if in_section and line.startswith("### 7.2"):
            break
        if not in_section:
            continue
        m = pattern.search(line)
        if m:
            filename = m.group("filename")
            items.append(
                Item(
                    filename=filename,
                    description=m.group("description").strip(),
                    tags=(m.group("tags") or "").strip(),
                    resolution=m.group("resolution").strip(),
                    base=base_from_filename(filename),
                )
            )
    return items


def tokenize(text: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s-]+", " ", text.lower())
    tokens = []
    for token in cleaned.replace("-", " ").split():
        if token and token not in STOPWORDS:
            tokens.append(token)
    return tokens


def query_variants(item: Item) -> list[str]:
    variants: list[str] = []
    if item.tags:
        variants.append(item.tags)
    variants.append(item.description)
    variants.extend(BASE_QUERIES.get(item.base, []))
    # Also include the filename stem without a sequence suffix.
    stem = re.sub(r"\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif|svg|ico)$", "", item.filename, flags=re.I)
    variants.append(stem.replace("-", " "))
    seen = set()
    out = []
    for q in variants:
        q = re.sub(r"\s+", " ", q).strip()
        if q and q.lower() not in seen:
            out.append(q)
            seen.add(q.lower())
    return out


def commons_search(query: str) -> list[dict]:
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srlimit": "50",
        "srnamespace": "6",
        "srprop": "snippet",
        "format": "json",
        "origin": "*",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    return data.get("query", {}).get("search", [])


def is_image_title(title: str) -> bool:
    lowered = title.lower()
    return lowered.startswith("file:") and lowered.endswith(SUPPORTED_EXTS)


def score_candidate(title: str, snippet: str, query_tokens: list[str], hint_tokens: list[str]) -> int:
    title_l = title.lower()
    snippet_l = snippet.lower()
    score = 0

    for tok in hint_tokens:
        if tok in title_l:
            score += 8
        elif tok in snippet_l:
            score += 3

    for tok in query_tokens:
        if tok in title_l:
            score += 4
        elif tok in snippet_l:
            score += 1

    if title_l.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif")):
        score += 2
    if title_l.endswith((".svg", ".ico")):
        score -= 10

    for bad in BAD_TERMS:
        if bad in title_l:
            score -= 6
        if bad in snippet_l:
            score -= 3

    return score


def choose_candidate(item: Item) -> tuple[dict | None, str | None]:
    best = None
    best_query = None
    best_score = -10**9
    hints = BASE_HINTS.get(item.base, [])

    for query in query_variants(item):
        try:
            results = commons_search(query)
        except Exception:
            continue
        query_tokens = tokenize(query)
        for res in results:
            title = res.get("title", "")
            if not is_image_title(title):
                continue
            snippet = re.sub(r"<[^>]+>", " ", res.get("snippet", ""))
            score = score_candidate(title, snippet, query_tokens, hints)
            if score > best_score:
                best_score = score
                best = res
                best_query = query
        # If we found a very strong candidate, stop early.
        if best_score >= 18:
            break

    return best, best_query


def page_info(title: str) -> dict:
    params = {
        "action": "query",
        "titles": title,
        "prop": "info|imageinfo",
        "inprop": "url",
        "iiprop": "url|size",
        "iiurlwidth": "900",
        "format": "json",
        "origin": "*",
    }
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.load(resp)
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        raise RuntimeError(f"No page info for {title}")
    return next(iter(pages.values()))


def run_cmd(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, check=True, capture_output=True, text=True)


def get_dims(path: Path) -> tuple[int, int]:
    proc = run_cmd(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)])
    width = height = None
    for line in proc.stdout.splitlines():
        if "pixelWidth:" in line:
            width = int(line.split(":")[-1].strip())
        if "pixelHeight:" in line:
            height = int(line.split(":")[-1].strip())
    if width is None or height is None:
        raise RuntimeError(f"Could not read dimensions for {path}")
    return width, height


def fit_image(path: Path, target_w: int, target_h: int) -> list[str]:
    notes: list[str] = []
    cur_w, cur_h = get_dims(path)
    if cur_w == target_w and cur_h == target_h:
        notes.append("already exact")
        return notes

    crop_path = path.with_name(f"{path.stem}.crop{path.suffix}")
    try:
        if cur_w >= target_w and cur_h >= target_h:
            run_cmd(["sips", "-c", str(target_h), str(target_w), str(path), "--out", str(crop_path)])
            notes.append("cropped")
            run_cmd(["sips", "-z", str(target_h), str(target_w), str(crop_path), "--out", str(path)])
            notes.append("resized")
        else:
            run_cmd(["sips", "-z", str(target_h), str(target_w), str(path), "--out", str(path)])
            notes.append("resized")
    finally:
        if crop_path.exists():
            crop_path.unlink()

    final_w, final_h = get_dims(path)
    if (final_w, final_h) != (target_w, target_h):
        raise RuntimeError(f"Final dimensions mismatch for {path}: {(final_w, final_h)}")
    return notes


def download_and_process(item: Item) -> dict:
    target_w, target_h = parse_resolution(item.resolution)
    local_path = OUTPUT_DIR / item.filename
    status_path = STATUS_DIR / f"{item.filename}.json"
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    STATUS_DIR.mkdir(parents=True, exist_ok=True)

    if status_path.exists():
        try:
            existing = json.loads(status_path.read_text())
            if existing.get("completed") and local_path.exists():
                return existing
        except Exception:
            pass

    best, best_query = choose_candidate(item)
    if not best:
        payload = {
            "filename": item.filename,
            "section": SECTION_NAME,
            "local_path": str(local_path),
            "source_page": None,
            "source_image_url": None,
            "final_width": None,
            "final_height": None,
            "completed": False,
            "notes": "no Commons image candidate found after query retries",
        }
        status_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True))
        return payload

    title = best["title"]
    info = page_info(title)
    source_page = info.get("fullurl")
    imageinfo = info.get("imageinfo", [{}])[0]
    source_image_url = imageinfo.get("thumburl") or imageinfo.get("url")
    if not source_image_url:
        raise RuntimeError(f"Missing image URL for {title}")

    if local_path.exists():
        local_path.unlink()

    notes: list[str] = []
    if best_query:
        notes.append(f"query={best_query}")
    notes.append(f"source_title={title}")

    cached = SOURCE_CACHE.get(source_image_url)
    if cached and cached.exists():
        shutil.copy2(cached, local_path)
        notes.append(f"cache_hit={cached.name}")
    else:
        time.sleep(2.0)
        fetch = subprocess.run(
            [
                "python3",
                "/Users/manav/.codex/skills/image-fetcher/scripts/fetch_image.py",
                source_image_url,
                str(OUTPUT_DIR),
                item.filename,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        if fetch.stdout.strip():
            notes.append(fetch.stdout.strip().splitlines()[-1])
        if local_path.exists():
            SOURCE_CACHE[source_image_url] = local_path

    fit_notes = fit_image(local_path, target_w, target_h)
    notes.extend(fit_notes)
    final_w, final_h = get_dims(local_path)

    payload = {
        "filename": item.filename,
        "section": SECTION_NAME,
        "local_path": str(local_path),
        "source_page": source_page,
        "source_image_url": source_image_url,
        "final_width": final_w,
        "final_height": final_h,
        "completed": True,
        "notes": "; ".join(notes),
    }
    status_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True))
    return payload


def worker(item: Item) -> dict:
    try:
        print(f"START {item.filename}", flush=True)
        result = download_and_process(item)
        print(f"DONE  {item.filename}", flush=True)
        return result
    except Exception as exc:
        print(f"FAIL  {item.filename}: {exc}", flush=True)
        status_path = STATUS_DIR / f"{item.filename}.json"
        status_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "filename": item.filename,
            "section": SECTION_NAME,
            "local_path": str(OUTPUT_DIR / item.filename),
            "source_page": None,
            "source_image_url": None,
            "final_width": None,
            "final_height": None,
            "completed": False,
            "notes": str(exc),
        }
        status_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True))
        return payload


def main() -> int:
    items = extract_items()
    if not items:
        print("No section 7.1 items found", file=sys.stderr)
        return 1

    pending: list[Item] = []
    completed = 0
    for item in items:
        status_path = STATUS_DIR / f"{item.filename}.json"
        local_path = OUTPUT_DIR / item.filename
        if status_path.exists() and local_path.exists():
            try:
                existing = json.loads(status_path.read_text())
                if existing.get("completed"):
                    completed += 1
                    continue
            except Exception:
                pass
        pending.append(item)

    print(f"Loaded {len(items)} items from {SECTION_NAME}")
    print(f"Already complete: {completed}; pending retry: {len(pending)}")
    if not pending:
        print("SUMMARY success=60 fail=0")
        for item in items:
            print(f"OK {item.filename}")
        return 0

    ctx = mp.get_context("fork")
    workers = 1
    with ctx.Pool(processes=workers) as pool:
        results = pool.map(worker, pending)

    success = completed + sum(1 for r in results if r.get("completed"))
    fail = len(items) - success
    print(f"SUMMARY success={success} fail={fail}")
    result_map = {r["filename"]: r for r in results}
    for item in items:
        r = result_map.get(item.filename)
        if r is None:
            print(f"OK {item.filename}")
        else:
            state = "OK" if r.get("completed") else "ERR"
            print(f"{state} {r['filename']}")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
