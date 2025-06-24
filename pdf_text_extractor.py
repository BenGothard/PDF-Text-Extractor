"""Utility to convert PDF files into spoken MP3 audiobooks."""
# pylint: disable=wrong-import-position, import-outside-toplevel
# pylint: disable=broad-exception-caught

import sys
import subprocess
from pathlib import Path
import re
import tempfile
from typing import List
import shutil
import importlib
import argparse
import platform


def check_ffmpeg() -> None:
    """Check if FFmpeg is installed."""
    if not shutil.which('ffmpeg'):
        print("Error: FFmpeg is not installed. Please install it using:")
        print("brew install ffmpeg")
        sys.exit(1)


def check_and_install_dependencies() -> None:
    """Ensure external Python dependencies are present."""
    try:
        importlib.import_module("PyPDF2")
        importlib.import_module("pydub")
    except ImportError:
        print("Installing required dependencies...")
        req_file = Path(__file__).with_name("requirements.txt")
        cmd = [sys.executable, "-m", "pip", "install"]
        if req_file.exists():
            cmd.extend(["-r", str(req_file)])
        else:
            cmd.extend(["PyPDF2", "pydub", "gTTS", "pyttsx3"])
        subprocess.check_call(cmd)
        print("Dependencies installed successfully!")


def determine_tts_engine() -> str:
    """Determine which text-to-speech backend to use.

    Preference order:
    1. macOS ``say`` command
    2. Windows SAPI via ``pyttsx3``
    3. Google Text-to-Speech

    Returns:
        One of ``"say"``, ``"pyttsx3"``, or ``"gtts"``.
    """

    if shutil.which("say"):
        return "say"

    if platform.system() == "Windows":
        try:
            importlib.import_module("pyttsx3")
        except Exception:
            print("Installing pyttsx3 for Windows TTS...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyttsx3"])
        return "pyttsx3"

    print(
        "Warning: native TTS not found. Falling back to gTTS for "
        "speech synthesis."
    )

    try:
        importlib.import_module("gtts")
    except Exception:
        print("Installing gTTS for fallback...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gTTS"])

    return "gtts"



# These will be initialized in ``main`` after checking dependencies.
TTS_ENGINE = None
PdfReader = None
AudioSegment = None


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from PDF file.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Extracted text from the PDF
    """
    reader = PdfReader(pdf_path)
    text = ""
    total_pages = len(reader.pages)

    for i, page in enumerate(reader.pages, 1):
        print(f"Extracting text from page {i}/{total_pages}...")
        text += page.extract_text() + "\n"

    return text


def clean_text(text: str) -> str:
    """Clean and format text for better speech synthesis.

    Args:
        text: Raw text to clean

    Returns:
        Cleaned text
    """
    # Remove common PDF metadata lines like "Title: ..." or "Author: ..."
    cleaned_lines = []
    for line in text.splitlines():
        if re.match(
            r"^(Title|Author|Creator|Producer|CreationDate|ModDate|Subject|Keywords|Date)\s*:",
            line.strip(),
        ):
            continue
        cleaned_lines.append(line)

    text = "\n".join(cleaned_lines)

    # Remove multiple newlines
    text = re.sub(r"\n\s*\n", "\n", text)
    # Remove special characters that might cause issues
    text = re.sub(r"[^\w\s.,!?-]", "", text)
    return text.strip()


def chunk_text(text: str, max_chars: int = 10000) -> List[str]:
    """Split text into chunks for better processing.

    Args:
        text: Text to split into chunks
        max_chars: Maximum characters per chunk

    Returns:
        List of text chunks
    """
    # Split by sentences (rough approximation)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(current_chunk) + len(sentence) < max_chars:
            current_chunk += sentence + " "
        else:
            chunks.append(current_chunk.strip())
            current_chunk = sentence + " "

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks


def text_to_speech(text: str, output_path: Path) -> None:
    """Convert text to speech using the best available engine.

    Preference order is macOS ``say``, Windows ``pyttsx3`` (SAPI),
    and finally Google Text-to-Speech.

    Args:
        text: Text to convert to speech
        output_path: Path where the MP3 file will be saved
    """
    # Split text into manageable chunks
    chunks = chunk_text(text)
    total_chunks = len(chunks)

    # Temporary directory for intermediate files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        audio_segments = []

        for i, chunk in enumerate(chunks, 1):
            print(f"Processing chunk {i}/{total_chunks}...")

            if TTS_ENGINE == "say":
                # Use macOS say command
                chunk_file = temp_dir_path / f"chunk_{i}.txt"
                chunk_file.write_text(chunk)
                aiff_path = temp_dir_path / f"chunk_{i}.aiff"
                subprocess.run(
                    ["say", "-f", str(chunk_file), "-o", str(aiff_path)],
                    check=True,
                )
                audio_segments.append(
                    AudioSegment.from_file(str(aiff_path), format="aiff")
                )
            elif TTS_ENGINE == "pyttsx3":
                import pyttsx3  # type: ignore
                engine = pyttsx3.init()
                wav_path = temp_dir_path / f"chunk_{i}.wav"
                engine.save_to_file(chunk, str(wav_path))
                engine.runAndWait()
                audio_segments.append(
                    AudioSegment.from_file(str(wav_path), format="wav")
                )
            else:
                from gtts import gTTS  # type: ignore[import]
                mp3_path = temp_dir_path / f"chunk_{i}.mp3"
                gTTS(chunk).save(str(mp3_path))
                audio_segments.append(
                    AudioSegment.from_file(str(mp3_path), format="mp3")
                )

        print("Combining audio segments...")
        final_audio = sum(audio_segments)

        print("Exporting to MP3...")
        final_audio.export(str(output_path), format="mp3")


def main() -> None:
    """Main function to convert PDF to MP3."""
    parser = argparse.ArgumentParser(
        description="Convert a PDF to an MP3 audiobook"
    )
    parser.add_argument(
        "pdf",
        nargs="?",
        type=Path,
        help="Path to the PDF file to convert (default: first PDF in current folder)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Path where the MP3 will be saved. Defaults to <pdf>.mp3",
    )

    # Show help without triggering dependency installation
    if any(arg in {"-h", "--help"} for arg in sys.argv[1:]):
        parser.print_help()
        return

    args = parser.parse_args()

    # Dependencies and environment checks happen only for real runs
    check_and_install_dependencies()
    check_ffmpeg()

    global TTS_ENGINE, PdfReader, AudioSegment
    TTS_ENGINE = determine_tts_engine()
    from PyPDF2 import PdfReader as _PdfReader  # type: ignore
    from pydub import AudioSegment as _AudioSegment  # type: ignore
    PdfReader = _PdfReader
    AudioSegment = _AudioSegment

    pdf_path = args.pdf
    if pdf_path is None:
        search_dirs = [Path(".")]
        script_dir = Path(__file__).resolve().parent
        if script_dir != Path(".").resolve():
            search_dirs.append(script_dir)

        pdfs: List[Path] = []
        for d in search_dirs:
            pdfs.extend(sorted(d.glob("*.pdf")))

        # Remove duplicates while preserving order
        seen = set()
        unique_pdfs = []
        for p in pdfs:
            if p not in seen:
                unique_pdfs.append(p)
                seen.add(p)

        if len(unique_pdfs) == 1:
            pdf_path = unique_pdfs[0]
            print(f"Using detected PDF: {pdf_path}")
        elif len(unique_pdfs) == 0:
            print(
                "Error: No PDF found. Move your document next to pdf_text_extractor.py "
                "or run 'python pdf_text_extractor.py <file>'."
            )
            sys.exit(1)
        else:
            print("Error: Multiple PDFs found. Please specify which one to use.")
            for p in unique_pdfs:
                print(f" - {p}")
            sys.exit(1)

    if not pdf_path.exists():
        print(f"Error: File {pdf_path} does not exist")
        sys.exit(1)

    if pdf_path.suffix.lower() != '.pdf':
        print("Error: Input file must be a PDF")
        sys.exit(1)

    print(f"Converting {pdf_path} to MP3...")

    try:
        # Extract and clean text
        text = extract_text_from_pdf(pdf_path)
        text = clean_text(text)

        # Convert to speech
        output_path = args.output if args.output else pdf_path.with_suffix('.mp3')
        text_to_speech(text, output_path)

        print(f"Conversion complete! Output saved to: {output_path}")

    except Exception as e:
        print(f"Error during conversion: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
