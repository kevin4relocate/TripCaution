#!/usr/bin/env python3
"""Validate, upload and rename 200 WebP files according to the committed manifest."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUCKET = "tripcaution-media"
FOLDER = ROOT / "Images/Batch-004"
MAX_SIZE = 5 * 1024 * 1024

def manifest():
    data = json.loads((ROOT / "content/batch-004/image-manifest.json").read_text(encoding="utf-8"))
    items = data.get("images", [])
    if len(items) != 200:
        raise ValueError("Manifest must contain exactly 200 slots")
    for i, item in enumerate(items, start=1):
        if (item.get("number") != i
            or item.get("upload_filename") != f"Gen_{i:03d}.webp"
            or item.get("article_number") != (i+1)//2
            or item.get("role") != ("hero" if i%2 else "inline")
            or item.get("r2_key") != "editorial/" + item.get("target_filename", "")
            or item.get("public_path") != "/media/" + item.get("r2_key", "")
            or "/" in item.get("target_filename", "")
            or "\\" in item.get("target_filename", "")):
            raise ValueError(f"Invalid manifest slot {i}")
    if len({x["target_filename"] for x in items}) != 200:
        raise ValueError("Duplicate final image filename")
    return items

def validate(items):
    result = []
    missing = []
    for item in items:
        source = FOLDER / item["upload_filename"]
        if not source.is_file():
            missing.append(source.name)
            continue
        size = source.stat().st_size
        if not 24 <= size <= MAX_SIZE:
            raise ValueError(f"Invalid image size: {source} ({size})")
        with source.open("rb") as handle:
            head = handle.read(16)
        if head[0:4] != b"RIFF" or head[8:12] != b"WEBP" or head[12:16] not in (b"VP8 ", b"VP8L", b"VP8X"):
            raise ValueError(f"Invalid WebP header: {source}. Re-encode; do not rename JPEG/PNG to WebP.")
        destination = FOLDER / item["target_filename"]
        if destination.exists() and destination != source:
            raise ValueError(f"Target already exists, refusing overwrite: {destination}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        result.append((item, source, size, digest))
    if missing:
        raise ValueError(f"Missing {len(missing)} images: {', '.join(missing[:15])}")
    print(f"VALIDATED {len(result)} images; {sum(x[2] for x in result)} bytes.")
    return result

def upload(items):
    import boto3
    from botocore.exceptions import ClientError
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    key = os.environ.get("R2_ACCESS_KEY_ID", "")
    secret = os.environ.get("R2_SECRET_ACCESS_KEY", "")
    if not all((account, key, secret)):
        raise ValueError("Required Cloudflare R2 credentials are missing")
    client = boto3.client("s3", endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                          aws_access_key_id=key, aws_secret_access_key=secret, region_name="auto")
    sent = 0
    skipped = 0
    for item, path, size, digest in items:
        object_key = item["r2_key"]
        try:
            old = client.head_object(Bucket=BUCKET, Key=object_key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
            old = None
        if old is not None:
            if old.get("Metadata", {}).get("sha256") == digest and old.get("ContentLength") == size:
                skipped += 1
                continue
            raise ValueError(f"R2 object already exists with different or unknown hash: {object_key}")
        with path.open("rb") as stream:
            client.put_object(Bucket=BUCKET, Key=object_key, Body=stream,
                              ContentType="image/webp",
                              CacheControl="public, max-age=3600, stale-while-revalidate=86400",
                              Metadata={"sha256": digest, "batch": "004"})
        verified = client.head_object(Bucket=BUCKET, Key=object_key)
        if verified.get("Metadata", {}).get("sha256") != digest or verified.get("ContentLength") != size:
            raise ValueError(f"R2 post-upload verification failed: {object_key}")
        print("UPLOADED", path.name, "->", object_key)
        sent += 1
    print(f"UPLOAD COMPLETE: uploaded={sent}, already_identical={skipped}")

def rename(items):
    for item, path, _, _ in items:
        newpath = FOLDER / item["target_filename"]
        path.rename(newpath)
        print("RENAMED", path.name, "->", newpath.name)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("validate", "upload", "rename"), required=True)
    args = parser.parse_args()
    items = validate(manifest())
    if args.mode == "upload":
        upload(items)
    elif args.mode == "rename":
        rename(items)

if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as exc:
        print("ERROR:", exc, file=sys.stderr)
        raise SystemExit(1)
