# PDF to MP3 Converter

A Python script that converts PDF files to MP3 audio using macOS's built-in text-to-speech engine.

## Requirements

- Python 3.6 or higher
- macOS (uses the built-in `say` command)
- FFmpeg (required by pydub for audio processing)

## Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd audiobook_maker
```

2. The script will automatically install required Python packages on first run.

3. Install FFmpeg if you haven't already:
```bash
brew install ffmpeg
```

## Usage

Run the script by providing the path to your PDF file as an argument:

```bash
# If the PDF is in the current directory:
python pdf2mp3.py my_document.pdf

# If the PDF is in another directory:
python pdf2mp3.py /path/to/your/document.pdf

# If the PDF has spaces in its name:
python pdf2mp3.py "My Document.pdf"
```

The script will:
1. Convert the PDF to text
2. Use macOS's text-to-speech engine to create audio
3. Save the output as an MP3 file in the same directory as the input PDF
   - For example, if your input is `my_document.pdf`, the output will be `my_document.mp3`

## Features

- Handles large PDFs by chunking text into manageable segments
- Uses macOS's high-quality text-to-speech engine
- Automatically cleans up temporary files
- Shows progress during conversion

## Note

This script requires macOS as it uses the built-in `say` command for text-to-speech conversion. 