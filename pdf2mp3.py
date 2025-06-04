import sys
import subprocess
from pathlib import Path
import re
import itertools
import tempfile
import os
from typing import List, Optional
import shutil

def check_ffmpeg() -> None:
    """Check if FFmpeg is installed."""
    if not shutil.which('ffmpeg'):
        print("Error: FFmpeg is not installed. Please install it using:")
        print("brew install ffmpeg")
        sys.exit(1)

def check_and_install_dependencies() -> None:
    """Check if required packages are installed, install if missing."""
    try:
        import PyPDF2
        import pydub
    except ImportError:
        print("Installing required dependencies...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
        print("Dependencies installed successfully!")

# Check dependencies before importing them
check_and_install_dependencies()
check_ffmpeg()

def check_say() -> bool:
    """Check if the macOS 'say' command is available and prepare a fallback.

    Returns:
        True if ``say`` is available, otherwise False.
    """
    if shutil.which("say"):
        return True

    print("Warning: 'say' command not found. Falling back to gTTS for speech synthesis.")

    try:
        import gtts  # type: ignore[import]
    except Exception:
        print("Installing gTTS for fallback...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "gTTS"])

    return False

# Determine whether the native 'say' command is available
HAS_SAY = check_say()

from PyPDF2 import PdfReader
from pydub import AudioSegment

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
    """Convert text to speech using either ``say`` or gTTS.

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

            if HAS_SAY:
                # Use macOS say command
                chunk_file = temp_dir_path / f"chunk_{i}.txt"
                chunk_file.write_text(chunk)
                aiff_path = temp_dir_path / f"chunk_{i}.aiff"
                subprocess.run(["say", "-f", str(chunk_file), "-o", str(aiff_path)], check=True)
                audio_segments.append(AudioSegment.from_file(str(aiff_path), format="aiff"))
            else:
                # Fallback to gTTS
                from gtts import gTTS  # type: ignore[import]
                mp3_path = temp_dir_path / f"chunk_{i}.mp3"
                gTTS(chunk).save(str(mp3_path))
                audio_segments.append(AudioSegment.from_file(str(mp3_path), format="mp3"))

        print("Combining audio segments...")
        final_audio = sum(audio_segments)

        print("Exporting to MP3...")
        final_audio.export(str(output_path), format="mp3")

def main() -> None:
    """Main function to convert PDF to MP3."""
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
        
    except Exception as e:
        print(f"Error during conversion: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 