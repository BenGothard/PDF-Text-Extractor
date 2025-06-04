"""Convert PDF documents to MP3 audio files using macOS's ``say`` command."""

import sys
import subprocess
from pathlib import Path
import re
import tempfile
import shutil
from typing import List
import importlib
from PyPDF2 import PdfReader
from pydub import AudioSegment


def check_ffmpeg() -> None:
    """Check if FFmpeg is installed."""
    if not shutil.which('ffmpeg'):
        print("Error: FFmpeg is not installed. Please install it using:")
        print("brew install ffmpeg")
        sys.exit(1)


def check_and_install_dependencies() -> None:
    """Ensure PyPDF2 and pydub are installed."""

    try:
        importlib.import_module("PyPDF2")
        importlib.import_module("pydub")
    except ImportError:
        print("Installing required dependencies...")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"]
        )
        print("Dependencies installed successfully!")


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
    # Remove multiple newlines
    text = re.sub(r'\n\s*\n', '\n', text)
    # Remove special characters that might cause issues
    text = re.sub(r'[^\w\s.,!?-]', '', text)
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
    """Convert text to speech using macOS's say command.

    Args:
        text: Text to convert to speech
        output_path: Path where the MP3 file will be saved
    """
    # Split text into chunks
    chunks = chunk_text(text)
    total_chunks = len(chunks)

    # Create temporary directory for intermediate files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        audio_segments = []

        for i, chunk in enumerate(chunks, 1):
            print(f"Processing chunk {i}/{total_chunks}...")

            # Create temporary file for the chunk
            chunk_file = temp_dir_path / f"chunk_{i}.txt"
            chunk_file.write_text(chunk)

            # Convert chunk to AIFF
            aiff_path = temp_dir_path / f"chunk_{i}.aiff"
            subprocess.run(
                ['say', '-f', str(chunk_file), '-o', str(aiff_path)],
                check=True,
            )

            # Convert AIFF to AudioSegment
            audio_segments.append(
                AudioSegment.from_file(str(aiff_path), format="aiff")
            )

        # Combine all audio segments
        print("Combining audio segments...")
        final_audio = sum(audio_segments)

        # Export as MP3
        print("Exporting to MP3...")
    final_audio.export(str(output_path), format="mp3")


def main() -> None:
    """Main function to convert PDF to MP3."""
    check_and_install_dependencies()
    check_ffmpeg()
    if len(sys.argv) != 2:
        print("Usage: python pdf2mp3.py <pdf_file>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
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
        output_path = pdf_path.with_suffix('.mp3')
        text_to_speech(text, output_path)

        print(f"Conversion complete! Output saved to: {output_path}")

    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"Error during conversion: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
