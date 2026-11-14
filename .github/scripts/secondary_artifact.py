"""Identify and verify the image archive produced by the native smoke test."""

import hashlib
import json
import os
import pathlib
import re
import sys
import tarfile


def identify(root, revision, preview_run):
    assert re.fullmatch(r"[a-f0-9]{40}", revision), "Invalid revision"
    assert type(preview_run) is int and preview_run > 0, "Invalid preview run"
    archive_path = root / "secondary-image.tar.gz"
    with archive_path.open("rb") as stream:
        archive_sha256 = hashlib.file_digest(stream, "sha256").hexdigest()
    with tarfile.open(archive_path, "r:gz") as archive:
        images = json.load(archive.extractfile("manifest.json"))
        assert len(images) == 1, "Expected one tested image"
        config_path = images[0]["Config"]
        assert re.fullmatch(r"(?:blobs/sha256/)?[a-f0-9]{64}(?:\.json)?", config_path)
        config = archive.extractfile(config_path).read()
    metadata = json.loads(config)
    assert metadata["architecture"] == "arm64" and metadata["os"] == "linux", "Wrong image platform"
    assert metadata["config"]["Labels"]["org.opencontainers.image.revision"] == revision, "Wrong image revision"
    return {
        "revision": revision,
        "preview_run": preview_run,
        "image_id": "sha256:" + hashlib.sha256(config).hexdigest(),
        "archive_sha256": archive_sha256,
    }


def main():
    operation, folder = sys.argv[1:]
    root = pathlib.Path(folder)
    manifest = root / "secondary-manifest.json"
    if operation == "write":
        result = identify(root, os.environ["GITHUB_SHA"], int(os.environ["GITHUB_RUN_ID"]))
        manifest.write_text(json.dumps(result), encoding="utf-8")
    elif operation == "verify":
        result = identify(root, os.environ["REVISION"], int(os.environ["PREVIEW_RUN"]))
        assert json.loads(manifest.read_text(encoding="utf-8")) == result, "Image manifest mismatch"
    else:
        raise ValueError("Unknown operation")


if __name__ == "__main__":
    main()
