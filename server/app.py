from __future__ import annotations

import tempfile
from pathlib import Path
import sys

from flask import Flask, request, send_file, after_this_request
from flask_cors import CORS

# Ensure the repository root is on the Python path so that this script can be
# executed directly from the ``server`` directory or via ``python server/app.py``
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pdf_text_extractor

pdf_text_extractor.check_and_install_dependencies()
pdf_text_extractor.check_ffmpeg()

pdf_text_extractor.TTS_ENGINE = pdf_text_extractor.determine_tts_engine()
from PyPDF2 import PdfReader as _PdfReader  # type: ignore
from pydub import AudioSegment as _AudioSegment  # type: ignore
pdf_text_extractor.PdfReader = _PdfReader
pdf_text_extractor.AudioSegment = _AudioSegment

app = Flask(__name__)
CORS(app)


@app.post('/convert')
def convert():
    uploaded = request.files.get('file')
    if uploaded is None or uploaded.filename == '':
        return 'No file uploaded', 400

    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_tmp:
        uploaded.save(pdf_tmp.name)
        pdf_path = Path(pdf_tmp.name)

    text = pdf_text_extractor.extract_text_from_pdf(pdf_path)
    text = pdf_text_extractor.clean_text(text)

    mp3_tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    mp3_tmp.close()
    mp3_path = Path(mp3_tmp.name)
    pdf_text_extractor.text_to_speech(text, mp3_path)

    @after_this_request
    def cleanup(response):
        pdf_path.unlink(missing_ok=True)
        mp3_path.unlink(missing_ok=True)
        return response

    download_name = Path(uploaded.filename).stem + '.mp3'
    return send_file(
        mp3_path,
        as_attachment=True,
        download_name=download_name,
        mimetype='audio/mpeg',
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
