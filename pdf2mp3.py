import sys
import subprocess
from pathlib import Path

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

import re
import itertools
from PyPDF2 import PdfReader
from pydub import AudioSegment

# ... existing code ... 