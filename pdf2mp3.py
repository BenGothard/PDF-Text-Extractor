import sys
import subprocess
from pathlib import Path
import re
import itertools
import tempfile
import os

def check_and_install_dependencies():
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

from PyPDF2 import PdfReader
from pydub import AudioSegment

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF file."""
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text

def clean_text(text):
    """Clean and format text for better speech synthesis."""
    # Remove multiple newlines
    text = re.sub(r'\n\s*\n', '\n', text)
    # Remove special characters that might cause issues
    text = re.sub(r'[^\w\s.,!?-]', '', text)
    return text.strip()

def text_to_speech(text, output_path):
    """Convert text to speech using macOS's say command."""
    # Create a temporary file for the text
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as temp_file:
        temp_file.write(text)
        temp_file_path = temp_file.name

    try:
        # Use the say command to create an AIFF file
        aiff_path = output_path.with_suffix('.aiff')
        subprocess.run(['say', '-f', temp_file_path, '-o', str(aiff_path)], check=True)
        
        # Convert AIFF to MP3 using pydub
        audio = AudioSegment.from_file(str(aiff_path), format="aiff")
        audio.export(str(output_path), format="mp3")
        
        # Clean up temporary files
        os.unlink(temp_file_path)
        os.unlink(str(aiff_path))
        
    except subprocess.CalledProcessError as e:
        print(f"Error during text-to-speech conversion: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error during audio processing: {e}")
        sys.exit(1)

def main():
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
    
    # Extract and clean text
    text = extract_text_from_pdf(pdf_path)
    text = clean_text(text)
    
    # Convert to speech
    output_path = pdf_path.with_suffix('.mp3')
    text_to_speech(text, output_path)
    
    print(f"Conversion complete! Output saved to: {output_path}")

if __name__ == "__main__":
    main() 