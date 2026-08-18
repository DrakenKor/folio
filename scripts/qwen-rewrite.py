#!/usr/bin/env python3
"""
Rewrites a post's prose through the local Qwen model in LM Studio.

    npm run blog:rewrite -- ../folio-sealed/posts/my-post.mdx

Writes <post>.rewritten.mdx next to the source and leaves the original alone.
Read the diff, then replace the original yourself. The model is not trusted to
be correct — it has garbled a fact before — so nothing lands unreviewed.

The model must be local. Sealed posts are plaintext at this stage, and a cloud
model would put that plaintext on someone else's machine, which is the one
thing this repository split exists to prevent.

Prose is rewritten. Frontmatter, headings, tables, JSX and fenced code are
copied through untouched: frontmatter is published metadata even for sealed
posts, and the tables carry the measurements.
"""

import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

URL = "http://127.0.0.1:1234/v1/chat/completions"
MODEL = "qwen3.8-27b"
WORKERS = 4
SECTION_BUDGET = 8000
PARAGRAPH_BUDGET = 6000

SYSTEM = """Rewrite the text the user gives you, expressing the same information in different wording.

Rules:
1. Keep every number, percentage, unit, model name, file name and benchmark name exactly as written.
2. Copy every markdown table through verbatim, character for character.
3. Copy every heading line through verbatim.
4. Copy every JSX tag through verbatim. You may rewrite prose inside a Callout.
5. Keep inline code spans wrapped in backticks exactly as written.
6. Add nothing: no new facts, sections, opinions or conclusions.
7. Output only the rewritten text. No preamble, no commentary, no alternatives.

Voice: neutral and understated. Minimal adjectives. No dramatising words. State
what is and let it stand. Avoid comparison framing ("unlike", "whereas",
"compared to"). Short declarative sentences. Keep first-person "I" where the
input uses it.

Answer immediately. Do not deliberate at length."""

PASSTHROUGH = ("#", "|", "<", "```")


def call(text, budget):
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": text},
        ],
        "max_tokens": budget,
        "temperature": 0.6,
    }).encode()
    request = urllib.request.Request(URL, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(request, timeout=3600) as response:
            data = json.load(response)
    except urllib.error.URLError as error:
        sys.exit(
            f"Cannot reach LM Studio at {URL}: {error}\n"
            f"Start LM Studio and load {MODEL}."
        )

    choice = data["choices"][0]
    body = re.sub(r"<think>.*?</think>", "", choice["message"]["content"], flags=re.S).strip()
    usage = data.get("usage", {})
    reasoning = usage.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
    return body, choice.get("finish_reason"), usage.get("completion_tokens", 0), reasoning


def split_paragraphs(text):
    blocks = []
    for block in re.split(r"\n\s*\n", text):
        stripped = block.strip()
        if stripped:
            blocks.append((stripped, not stripped.startswith(PASSTHROUGH)))
    return blocks


def rewrite_by_paragraph(index, section):
    """Fallback for a section the model could not finish.

    A reasoning model that is still thinking when its budget runs out emits no
    answer at all. Handing it one paragraph at a time gives it less to
    deliberate over, which is what gets it to stop.
    """
    blocks = split_paragraphs(section)
    todo = [(i, text) for i, (text, rewritable) in enumerate(blocks) if rewritable]
    print(f"  [{index:02d}] retrying {len(todo)} paragraph(s) individually", flush=True)

    def one(item):
        i, text = item
        body, finish, _, _ = call(text, PARAGRAPH_BUDGET)
        if not body or finish == "length":
            print(f"  [{index:02d}] paragraph {i} failed again, keeping original", flush=True)
            return i, text
        return i, body

    with ThreadPoolExecutor(max_workers=3) as pool:
        done = dict(pool.map(one, todo))

    return "\n\n".join(done.get(i, text) for i, (text, _) in enumerate(blocks))


def rewrite_section(item):
    index, section = item
    start = time.time()
    body, finish, completion, reasoning = call(section, SECTION_BUDGET)
    share = f"{reasoning / completion:.0%}" if completion else "n/a"
    print(
        f"  [{index:02d}] {time.time() - start:.0f}s completion={completion} "
        f"reasoning={reasoning} ({share}) finish={finish}",
        flush=True,
    )

    if not body or finish == "length":
        return index, rewrite_by_paragraph(index, section)
    return index, body


def split_sections(body):
    sections, current = [], []
    for line in body.split("\n"):
        if line.startswith("## ") and current:
            sections.append("\n".join(current).strip())
            current = [line]
        else:
            current.append(line)
    if current:
        sections.append("\n".join(current).strip())
    return [section for section in sections if section]


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: qwen-rewrite.py <path-to-post.mdx>")

    source = sys.argv[1]
    raw = open(source).read()

    match = re.match(r"^(---\n.*?\n---\n)(.*)$", raw, flags=re.S)
    if not match:
        sys.exit(f"{source}: no frontmatter block found.")
    frontmatter, body = match.group(1), match.group(2).strip()

    sections = split_sections(body)
    print(f"{source}: {len(sections)} section(s) through {MODEL}", flush=True)
    print("Thinking traces dominate generation, so this takes tens of minutes.", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = sorted(pool.map(rewrite_section, enumerate(sections)))

    rewritten = "\n\n".join(text for _, text in results)
    rewritten = re.sub(r"(?<!\n\n)\n(## )", r"\n\n\1", rewritten)
    rewritten = re.sub(r"\n{3,}", "\n\n", rewritten)

    destination = re.sub(r"\.mdx$", ".rewritten.mdx", source)
    open(destination, "w").write(frontmatter + "\n" + rewritten.strip() + "\n")

    print(f"\nWrote {destination}", flush=True)
    print(f"Read it before it ships:  diff -u {source} {destination}", flush=True)


if __name__ == "__main__":
    main()
