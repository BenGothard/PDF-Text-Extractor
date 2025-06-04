async function extractTextFromPDF(file) {
  const typedarray = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(' ') + '\n';
  }
  return text;
}

function log(msg) {
  const term = document.getElementById('terminal');
  if (term) {
    term.textContent += msg + '\n';
    term.scrollTop = term.scrollHeight;
  }
}

function chunkText(text, max = 200) {
  const sentences = text.match(/[^.!?]+[.!?\n]*/g) || [];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > max) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function speakBrowser(text) {
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    const select = document.getElementById('voiceSelect');
    if (select) {
      const voices = speechSynthesis.getVoices();
      const voice = voices[parseInt(select.value, 10)];
      if (voice) utter.voice = voice;
    }
    const rateInput = document.getElementById('rateRange');
    if (rateInput) utter.rate = parseFloat(rateInput.value);
    speechSynthesis.speak(utter);
    return utter;
  }
  return null;
}

async function captureSpeech(text, outputName) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) {
    return false;
  }
  const utter = speakBrowser(text);
  if (!utter) return false;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    const stopPromise = new Promise(resolve => {
      recorder.onstop = () => resolve();
    });
    const speakPromise = new Promise(resolve => {
      utter.onend = resolve;
    });
    recorder.start();
    await speakPromise;
    recorder.stop();
    await stopPromise;
    const blob = new Blob(chunks, { type: recorder.mimeType });
    const url = URL.createObjectURL(blob);
    document.getElementById('audio').style.display = 'block';
    document.getElementById('audio').src = url;
    const pb = document.getElementById('playbackControls');
    if (pb) pb.style.display = 'flex';
    const dl = document.getElementById('downloadLink');
    dl.href = url;
    const ext = recorder.mimeType.includes('mpeg') ? '.mp3' : '.webm';
    dl.download = outputName.replace(/\.mp3$/i, ext);
    dl.style.display = 'inline-block';
    document.getElementById('progress').textContent = 'Done!';
    log('Captured audio using browser speech synthesis.');
    return true;
  } catch (err) {
    log(`Failed to capture browser audio: ${err}`);
    return false;
  }
}

function populateVoices() {
  if (!('speechSynthesis' in window)) return;
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  const voices = speechSynthesis.getVoices();
  select.innerHTML = '';
  voices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    select.appendChild(opt);
  });
  let enIndex = voices.findIndex(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  if (enIndex === -1) enIndex = 0;
  select.value = String(enIndex);
}

async function fetchMP3(chunk) {
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(chunk)}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('TTS request failed');
    return new Uint8Array(await resp.arrayBuffer());
  } catch (err) {
    log(`Error fetching audio: ${err}`);
    throw err;
  }
}

async function textToMP3(text, outputName = 'output.mp3') {
  const chunks = chunkText(text);
  const buffers = [];
  const progress = document.getElementById('progress');
  const progressBar = document.getElementById('progressBar');
  progressBar.max = chunks.length;
  progressBar.value = 0;
  progressBar.style.display = 'block';
  log(`Starting synthesis of ${chunks.length} chunk(s)`);
  for (let i = 0; i < chunks.length; i++) {
    const msg = `Fetching audio ${i + 1} / ${chunks.length}...`;
    progress.textContent = msg;
    log(msg);
    progressBar.value = i;
    buffers.push(await fetchMP3(chunks[i]));
    progressBar.value = i + 1;
  }
  progress.textContent = 'Combining...';
  log('Combining audio');
  progressBar.value = progressBar.max;
  const blob = new Blob(buffers, { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  document.getElementById('audio').style.display = 'block';
  document.getElementById('audio').src = url;
  const pb = document.getElementById('playbackControls');
  if (pb) pb.style.display = 'flex';
  const dl = document.getElementById('downloadLink');
  dl.href = url;
  dl.download = outputName;
  dl.style.display = 'inline-block';
  progress.textContent = 'Done!';
  log('Finished.');
  progressBar.style.display = 'none';
}

async function handleConvert() {
  const file = document.getElementById('pdfFile').files[0];
  let text = document.getElementById('textInput').value.trim();
  let outputName = 'output.mp3';
  const progressBar = document.getElementById('progressBar');
  progressBar.style.display = 'none';
  progressBar.value = 0;
  const term = document.getElementById('terminal');
  if (term) term.textContent = '';
  if (file) {
    const msg = 'Extracting text from PDF...';
    document.getElementById('progress').textContent = msg;
    log(msg);
    text += '\n' + await extractTextFromPDF(file);
    outputName = file.name.replace(/\.pdf$/i, '.mp3');
  }
  if (!text) {
    alert('Please upload a PDF or enter some text.');
    return;
  }
  log('Starting conversion');
  const captured = await captureSpeech(text, outputName);
  if (!captured) {
    await textToMP3(text, outputName);
  }
}

document.getElementById('convertBtn').addEventListener('click', handleConvert);

// Initialize theme toggle and restore saved preference
document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark') {
    document.body.classList.add('dark');
  }

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  if (playBtn && audio) {
    playBtn.addEventListener('click', () => audio.play());
  }
  if (pauseBtn && audio) {
    pauseBtn.addEventListener('click', () => audio.pause());
  }

  populateVoices();
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = populateVoices;
  }

  const rate = document.getElementById('rateRange');
  const rateVal = document.getElementById('rateValue');
  if (rate && rateVal) {
    rate.addEventListener('input', () => {
      rateVal.textContent = rate.value;
    });
  }
});
