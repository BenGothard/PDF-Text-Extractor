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

async function fetchMP3(chunk) {
  const url = `https://corsproxy.io/https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encodeURIComponent(chunk)}`;
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
  await textToMP3(text, outputName);
}

document.getElementById('convertBtn').addEventListener('click', handleConvert);

const toggle = document.getElementById('themeToggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });
}
