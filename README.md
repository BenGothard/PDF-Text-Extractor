# PDF to MP3 Converter

A Python script that converts PDF files to MP3 audio using macOS's built-in text-to-speech engine when available, or Google Text-to-Speech on other platforms.

## 🚀 Quick Start

```bash
git clone <your-repo-url>
cd audiobook_maker
bash setup.sh
source venv/bin/activate
python pdf2mp3.py my_document.pdf
```

### Super Simple Guide

Follow these steps to turn a PDF into an MP3. Make sure Python and FFmpeg are installed on your computer.

1. Click **Code** and choose **Download ZIP** to get the files, or use the page's "Download MP3" button to generate the archive in your browser.
2. Open the ZIP you downloaded. A new folder appears. Move your PDF into this folder.
3. Open Command Prompt on Windows or Terminal on Mac and Linux.
4. Run `python ~/Downloads/audiobook_maker/pdf2mp3.py` and press **Enter**.
   You can run this command from any folder—the script checks the directory
   containing `pdf2mp3.py` for your PDF.
5. Wait a bit. You'll see an MP3 with the same name as your PDF. Double-click it to listen.
6. If you get a "No PDF found" error, make sure your document is in that folder or run `python pdf2mp3.py your_file.pdf`.

I was frustrated when I wanted to listen to the Deep Research results within ChatGPT, since all of the "free text to speech" providers severely capped my characters or hours. So now we can all listen to whatever we want.

## Requirements

- Python 3.6 or higher
- macOS is recommended (uses the built-in `say` command when available, with Google Text-to-Speech fallback on other platforms)
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

3. (Alternative) Manual install: The script will automatically install required Python packages on first run, even if ``requirements.txt`` isn't present.

4. (Alternative) Install FFmpeg if you haven't already:
```bash
# macOS
brew install ffmpeg

# Debian/Ubuntu
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
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
2. Use your operating system's native text-to-speech engine when available
   (``say`` on macOS or ``SAPI`` on Windows via ``pyttsx3``) to create audio.
   If neither is available it falls back to Google Text-to-Speech.
3. Save the output as an MP3 file (by default next to the input PDF)
   - For example, if your input is `my_document.pdf`, the default output will
     be `my_document.mp3`

## Features

- Handles large PDFs by chunking text into manageable segments
- Uses the native text-to-speech engine (``say`` on macOS or ``SAPI`` on Windows)
  when available, with gTTS as a final fallback
- Automatically cleans up temporary files
- Shows progress during conversion

## GitHub Pages Web App

A very small browser interface is included so you can extract and listen to PDF text without installing anything. Enable GitHub Pages for the repository (either from the root or the `docs/` folder) and open:

```
https://<username>.github.io/audiobook_maker/
```
If you're running locally without GitHub Pages, simply open `docs/index.html` in your browser.

The page lets you **Extract PDF Text**, **Listen to Text**, and **Download Text**. Use the `pdf2mp3.py` script locally if you want an MP3 download. Browser playback uses the built‑in speech synthesis engine when available and falls back to Google's `translate.googleapis.com` service.

The voice selector now defaults to the first available English voice when the web page loads.


## Note

The script now detects your operating system and uses the best available
text-to-speech backend. macOS systems use the built-in ``say`` command,
Windows systems use ``pyttsx3``/SAPI, and if neither is available the
script falls back to Google Text-to-Speech.

## License

This project is licensed under the [MIT License](LICENSE).
