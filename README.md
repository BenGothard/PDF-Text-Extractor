# PDF to MP3 Converter

A Python script that converts PDF files to MP3 audio using macOS's built-in text-to-speech engine.

## 🚀 Quick Start

```bash
git clone <your-repo-url>
cd audiobook_maker
bash setup.sh
source venv/bin/activate
python pdf2mp3.py my_document.pdf
```

I was frustrated when I wanted to listen to the Deep Research results within ChatGPT, since all of the "free text to speech" providers severely capped my characters or hours. So now we can all listen to whatever we want.

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

2. Run the setup script (recommended):
```bash
bash setup.sh
source venv/bin/activate
```

3. (Alternative) Manual install: The script will automatically install required Python packages on first run.

4. (Alternative) Install FFmpeg if you haven't already:
```bash
brew install ffmpeg
```

## Usage

Run the script by providing the path to your PDF file. You can optionally
specify an output path for the generated MP3 using ``-o`` or ``--output``:

```bash
# If the PDF is in the current directory:
python pdf2mp3.py my_document.pdf

# Specify a custom output location:
python pdf2mp3.py my_document.pdf -o /path/to/output/book.mp3

# If the PDF is in another directory:
python pdf2mp3.py /path/to/your/document.pdf

# If the PDF has spaces in its name:
python pdf2mp3.py "My Document.pdf"
```

The script will:
1. Convert the PDF to text
2. Use macOS's text-to-speech engine to create audio
3. Save the output as an MP3 file (by default next to the input PDF)
   - For example, if your input is `my_document.pdf`, the default output will
     be `my_document.mp3`

## Features

- Handles large PDFs by chunking text into manageable segments
- Uses macOS's high-quality text-to-speech engine
- Automatically cleans up temporary files
- Shows progress during conversion

## GitHub Pages Web App

A very small browser interface is included so you can convert files without installing anything. Enable GitHub Pages for the repository (either from the root or the `docs/` folder) and open:

```
https://<username>.github.io/audiobook_maker/
```

From there you can upload a PDF or paste text and click **Convert** to generate and download the MP3 directly in your browser.


## Note

This script requires macOS as it uses the built-in `say` command for text-to-speech conversion. 

## License

This project is licensed under the [MIT License](LICENSE).
