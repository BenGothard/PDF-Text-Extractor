import importlib.util
import os
import sys
from pathlib import Path


def import_pdf2mp3_with_fake_ffmpeg(tmp_path):
    # ensure repository root is in sys.path
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    fake_ffmpeg = tmp_path / "ffmpeg"
    fake_ffmpeg.write_text("")
    fake_ffmpeg.chmod(0o755)
    os.environ["PATH"] = f"{tmp_path}{os.pathsep}" + os.environ.get("PATH", "")

    if "pdf2mp3" in sys.modules:
        del sys.modules["pdf2mp3"]

    spec = importlib.util.spec_from_file_location("pdf2mp3", repo_root / "pdf2mp3.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_chunk_text_short(tmp_path):
    pdf2mp3 = import_pdf2mp3_with_fake_ffmpeg(tmp_path)
    text = "Hello world. This is a test."
    chunks = pdf2mp3.chunk_text(text, max_chars=20)
    assert chunks == ["Hello world.", "This is a test."]
