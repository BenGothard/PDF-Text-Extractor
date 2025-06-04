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
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('TTS request failed');
  return new Uint8Array(await resp.arrayBuffer());
}

async function textToMP3(text) {
  const chunks = chunkText(text);
  const buffers = [];
  const progress = document.getElementById('progress');
  for (let i = 0; i < chunks.length; i++) {
    progress.textContent = `Fetching audio ${i + 1} / ${chunks.length}...`;
    buffers.push(await fetchMP3(chunks[i]));
  }
  progress.textContent = 'Combining...';
  const blob = new Blob(buffers, { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  document.getElementById('audio').style.display = 'block';
  document.getElementById('audio').src = url;
  const dl = document.getElementById('downloadLink');
  dl.href = url;
  dl.style.display = 'inline-block';
  progress.textContent = 'Done!';
}

async function handleConvert() {
  const file = document.getElementById('pdfFile').files[0];
  let text = document.getElementById('textInput').value.trim();
  if (file) {
    document.getElementById('progress').textContent = 'Extracting text from PDF...';
    text += '\n' + await extractTextFromPDF(file);
  }
  if (!text) {
    alert('Please upload a PDF or enter some text.');
    return;
  }
  await textToMP3(text);
}

document.getElementById('convertBtn').addEventListener('click', handleConvert);
