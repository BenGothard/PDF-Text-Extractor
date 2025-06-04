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

const ZIP_BASE64 = 'UEsDBBQAAAAIAHmjxFoMx6wpSwEAAH8CAAAbABwALmdpdGh1Yi93b3JrZmxvd3MvcGFnZXMueW1sVVQJAANGrEBoRqxAaHV4CwABBAAAAAAEAAAAAIVRwWrDMAy95ytE2NUZlO3iUw+D7bj7GMWJ1dRrIhvbSiml/z45aTsGKzsZWe89PT2RGVHDC4bBH+HV5Tdu4d30mKrKk64AAqddeQHaaKjbYdLwUY/GUf0p3wcf99vBHzbWpWByJ9gqYBxdSs5TKszOU0bKwotobJEs+hoO0WWU0lmV/R7p+lMJoeMYkbpj4ffRc9BQz7S6CIoPHJQjFaLvIyYRy5GF+eXbeWTLbrCL68iUlKwC3DJlVoPJmPLcShlDWlAACjgVV6bLxfijbNrtPef19HQP4Wnreo6oZmfr6fkOkCVcYxeUMjG7rXTW0+oClxBd3ulbVQKSGppH6zu5A4Cdz7MgCNGK9rzhfwsiTS56GiX9qzzN9+5lILeLo0uD46Dh4XRaUmmWkYXZSAiBc2oKeiMwOJ//is9ZDT+s2za/o1gA18BW1TdQSwMEFAAAAAgAeaPEWgenyTT5AAAAZgEAAAoAHAAuZ2l0aWdub3JlVVQJAANGrEBoRqxAaHV4CwABBAAAAAAEAAAAAEVPwWrDMAy96ysC3alQp2Nj112awy5bISWXMYJjK7GHaxvLdcjfT2nGdnmSnp7eQ7vqvGQTPPR9XJRUBvu+hr2Iy6cK+gv2D3ERykkiJimA+JUPN+t0DRoLuhAPOE3Ek6XMGGbvgtRMbLTYirPDHV6ea4gyZaZouygy1TAbREdrNssP1o+BL62nLJ1DLdQ4bSuAXdXZlG/SVY0vNgV/RZ+hoC+cuELz3tWr7O3UsIVGyU6F+B9c7WmOdwyr5KMFcWr7NoeE/90riH4Poo0hOzuZfOgej0cQlyTJIAGabG7XgYQe4PLXsds5hW9UuaKIyo5Wcc41PlXwA1BLAwQUAAAACAB5o8RaT4epSHgCAAAxBAAABwAcAExJQ0VOU0VVVAkAA0asQGhGrEBodXgLAAEEAAAAAAQAAAAAXVJLb+IwEL77V4w4tVLUXVXay95MYsDaJEaOKcsxJIa4CjGKzaL++50JtN2uhBR5Ht9rKKSB3DV2CJax1J/fRnfsIjw0j/D8/fkHzO3wWp/cAEsfu3psGVvb8eRCcH4AF6Czo92/wXGsh2jbBA6jteAP0ODw0SYQPdTDG5ztGHDB72PtBjccoYYGyRhOxg5hgj/Eaz1aHG6hDsE3rkY8aH1zOdkh1pH4Dq63AR5iZ2FW3TdmjxNJa+ueoUzqvbfg6mLnLxFGG+LoGsJIwA1Nf2lJw3u7dyd3Z6D1KYHAEPQS0AHpTODkW3egr51snS/73oUugdYR9P4SsRioOEWZkI9vfoRg+54hgkPdk9dPddMMST9ToPEeUaDKtfOnr05cYIfLOCClnXZaj5FNjK+2iVSh8YPve38la40fWkeOwk/GDLbqvf9jJy+3Aw8+otSbBDrA+fOq91bo6r6Hvb0HhrwYb/2PnZHoQ8TDu7qHsx8nvv9tPiH/SkClFmbLtQBZwVqrF5mJDGa8wvcsga00K7UxgBOal2YHagG83MEvWWYJiN9rLaoKlGayWOdSYE2Wab7JZLmEOe6VCv/FspAGQY0CIrxDSVERWCF0usInn8tcml3CFtKUhLlQGjisuTYy3eRcw3qj16oSSJ8hbCnLhUYWUYjSPCEr1kC84AOqFc9zomJ8g+o16YNUrXdaLlcGVirPBBbnApXxeS5uVGgqzbksEsh4wZdi2lKIohmN3dTBdiWoRHwcf6mRqiQbqSqNxmeCLrX5WN3KSiTAtawokIVWRcIoTtxQEwjuleKGQlHDl4vgCL03lfgAhEzwHLEqWiaL78NP7C9QSwMEFAAAAAgAeaPEWkNtrhheBwAAWBAAAAkAHABSRUFETUUubWRVVAkAA0asQGhGrEBodXgLAAEEAAAAAAQAAAAAnVfNbuNGEr7zKQrjg2XBopB4koMRBPB67ImBceIdeTJIgiBskU2xM1Q30z+Secsr7DWXvNs+wT5CvuomZY1HmzX2IojN7uqqr776qnhEd6+uyRu6vTujS6M30npps+yC7nrfGE2utKrz5BvhqUzvXTxTq1a68aQIlTIUnNIrWovyu8Wxo2VQrZ8pTV4++Jk3M9dJWTYk9UppSdtGahIboVqxbOUpGUuvjVm1ku6H/Yu0H04Y30hLXSt8beza5Vl2dET/+fOP3+mfQZUfaOGF9VlWFMVSuCZbKfjaGlzyVW+CnVnZmVmw7ddZWSVXl8Z8+GUtPiBUPkFO+tDlOOqwv5S0kXozXyo9F6VXG+Fl1iU4uqr+fN2d5V1P6/6XypRhLbXPscy3s19HtAgdvF2odYdgXgdVySy7Nm1rtoBROknOyy5C54MFBhFOpfEsNKOZ0y08IxesHLMgdEXX1+tOrkhgVWnnRdvKisHhEJGadReQOUDzWU6XLaMynV6aSk6n8XTZGIOrp9NXZqtbIyr68eYO73DrSnJ+Zcponn2e03cdcsNL2MP2qRoOySqnC9JyS7VpK0Qpuk4K62gSvYiBOBKtlaLq2U0Ef5JnZ4PJS7NeszN3Fu56dv690rDtOPv30q6VFi0v34oyev1G6fCQZy9zuu87SQXyV5xSZcUqeZyciNjx8zZaO41HOyudQ7xXGrBMp3n2xWjkk1QWBw/QPSwO9K9h2MUrIvXhLeLNsy9zei9ANkFL5XP6wYTjtgWZ5JBJOOSbeMyJtSTNP8LRiFVOr0wA+WdlzBcMIY5WgR4aebyhLfbWNjhvwcAqVQyvan7abaUh+FdSdvQW/BIWVYNgQotSZQ9Qg5eo39d396eEEgW/QR4ydTz2orbwl2uUDaUafQEwzAa5Q2adRM3LtqeSc12B9uCSsCgMfgskGkTjcloY0mD4VmKjjhc8urfF7WyG37L7qYDfyt+CspILyGXZbOT6Wf5lNKtWKHosRz1hWlkJlmM3WEiT4GRKyE5mCieQyXKg2FN5iZk4LDA1nF0KJOBTpTnB/UPdTWxyt6JlT11fhWXkQVI+wFWCPZC/kxjaTSpQ4ZXRQ0WyHCEVHEZnnPLG9uf/n2JFoUGVvg2pSKN4jUyd7KF08njBM1Uumka1Ti5apFfD/408QTXqgLocVOd8vzC2CokWwZs19pZ424/baIfXkNcOEIsVsob/tbLOkw3M85dPrxvAG4FXdZSgRsDdYz+Ky2NoR4kh2dJClsbL65rPIhcoi6USev5uGbQPmQsVZLbzMxa9Tzd/L62qdyGk9KW3NAN/HT8POk/vHKLJsl0WEiBMjlg73Ap5vRMsAWZX9FFmo1bEQjEdX8LAZai9km/n1eAh5+kss4wNraSWSQhYWVKvLYqZKQouF/ybpVNFcZ7tgXNT73QL5FPJ2TJYi7KjCgkqExX/d4ODscXoIiw4JH10tDVlBOsZZmhmaM6Bzb2Zp+NzJneO7dkhf4VORfm3vu4sMszzp27v2WygqQ5UlNG2gkKyKh8y+eK2hz4/GnqRMv+E/OexutNgtLuEFRkaw0X6Dk03pt50nD1Omuuhi+tjvpkJ/6z5KCOiSRElruACSqIY8764uLtJi2Mz3SiBdUTk3cNZUZywPyWqxsukJTlbAyZaqogst+zxIu5CLIiY31gScfKgaMaevhDsPWIeWABoh77HHKcJaqGStUAfwlWpv/BupXkzcDphPyCwCEM+CB6XTodqt8MmeFY84Q/6PxsZDQ9XcyrYGtFSfnwE2Uz1eg0AMFLFVvMNWgSPr62wq5gyx4VbNkF/iHXL3sapAr0EVR6BcXKVWtWMk5qaz99m8Ln5YhgOtqvV/f0igsrzBwR4bFTw4OIjyS1bKbQjdAEQqzNW2D5Nc9i5aJgS0KRVnG+qYDnCNMpHPWNsXiv/DRraXdTn93JJF13HHwHY05Nbs0guLeykYUvaGgWUyrNsA/djFwUuKhqw4OkgzlSPI0AsC4aVIzNhJ77sjNA9DymrnK50hPojd0b9e+ybNBmIW2OOTO+M8TTsK5B6Ny+G4fAk+oHi00kVs8b7zp3P519hgrBc+1/n6L5NWObKzJ+02nk8cRMpeYy5Gw1Ls8Msd4z7GMu+vzxigcp9vHNwBnmWD3nj123BqhMJPuCZJ0XpcJRa6eNwyEPoACLDxpU3nZ5i9c0OznGNg9ub6dNyUp2Ixf6QO6jW6PzQV3keG8t2HPNz+seQbUxCfRSCj+etf//+L8Qx0N31mr9rQIeD0hV9PCQpUMACUWqHRivzVVwTnXI5Bhh4K+1GlXLAZ2PwH2ttbAFx0hwUwI2ykmaKx2uv9Ar0a4aj0af4jQB2J7QRKH9KMv+/NRh+9qU9XeBxmzss3zGqR1Dk/tXZEz3gsDGQ5YMKJAOOTz+ZYAe9GGbY02wU9P0Te8I+ZylJHFD/Rc2xko3fMM9RdQbjDfDSLuKhonL8ChjYbJteIG7Nn13s+0+3N/fjgZ8nb24ur75dXOGL7y9QSwMEFAAAAAgAeaPEWpxq+rV2BAAAZgoAAA8AHABkb2NzL2luZGV4Lmh0bWxVVAkAA0asQGhGrEBodXgLAAEEAAAAAAQAAAAArVbfb9s2EH7vX3HTQ7ZhjdSk2DCksoYuadYC6WLUDortjabOFmOKJEjKjvfX70hKtpwmy8teEpK6n9/dfefyu6vby/lf0w/Q+FZWr8rwDyRTq0mGKgsPyOrqFUDZomfAG2Yd+kl2N78+/TU7fFCsxUm2Ebg12voMuFYeFQluRe2bSY0bwfE0Xl6DUMILJk8dZxInZ/mbZMgLL7GaXl0Xc3zw4DV8nr4ti/QcBKRQa7AoJ5nzO4muQSRXjcVl/5Jz50LQRYq6XOh6FzUXnfdagagnmW+wxblerSRSmJI517+d+vRYpY9wxewaPusayyKpR0vN2VGEM4PIGziB+HClt0pqVqOlEM6ivAl/6b/zVqtVdSMc4XJRFv0d7hzCTncWFlZvHdrvHWw0YRWMyygcThQg+OBhgVJv83Jhj80OjkeGZ2yDUY/ULOMea9AWDHPhFG0xBwxyT6elIOy+MfqVKRJSoQq/HQcczBqrN6ImW9Odbwhbx60wHn4oOUFWmXp53pq3udmVRXz4EUgmJsp1azqPFpYUT90HzhaEOOtqoaFzQq2SqGJeUBa3s4SJywOiRYS0rMVmKF9nEuhZH79Q5AD8zlBLhtSyWHgK6TpeGOdoqDWZMVJwcqFVQR8H7YANs8hSt9DlUzCXgZGMY6MlOZpktz2UCckGLeZ5nlXUrb12b2wUZWqiUypz7+m4L/sy/e5p7D6kM1CnxcYad+BjvdQkUe1m3y8vKQ2wB7moOjTQi5o02Bu0j5TinI51yoISj2XaHwISsQxWryyGOT18MxZ7tG0rFJOHwRweSJiEjgylxC+JaKyWLnsCZoikQNkKR8XbXSit8N1Q5lFOhnUObw44TsP9UUIjcYq+a8fyX+LD8wrOazMSn9H1iFMSDuPcaHQ+ojTPZDCkKhQNZcdDA7shrea8+qi3oQf+QIWWUYumESZGOu9ltNxXVopDFfupvkfec8Pfn6akXEOn/hEGhM/LguRHqv0R4NZQ3zEYykUMH61FRUMcsYxjk+/ly04elJOtPesIRd3pRkwmWaeIY0tsq0vdtiGiqSUSoT6lJ1jSOXqb0eB5aFF1R4E+dtAyfjsbmdch9mB83kc/Mhue3x9owsHJyr+DOy8kbTB0SZJojPqFVoH2Uqwa/5/eb4TqHkbeTZgFKNeLurr0lnyH00/x/l768XWeLsHdkjB6ImTRMywbR/wEHmVxgP/Zkn7pCJVA3Wns28gVWWUS23/D7wfjR2RhdpdtHbq+p+P0MaNCBs1+BvJnYplTUfu1shVSprRDpQMvhjbgRLT7Bo/7hPLP4WtDFRVhrSlBPxLc66gUNgGtGK9bQoZ+ecjdfvu4EUBlMYwH7e4/NSgM+5KWsdZr8rTbBrIHlA5P2pq55p1vhKPlhmGxxeZs2RpdqgSFlQ8L6zDlfU7O8knWeG/cRVHwWt27nEvd1UtJCyQnawW7Zw8U2MKF/ZTfu+I8P/slP3vzc7xT5ektUGMyWP2PtrfarmlgX3SRzo9kqLDxhxdRTvxV+S9QSwMEFAAAAAgAeaPEWj0z3z5nCwAAaikAAA4AHABkb2NzL3NjcmlwdC5qc1VUCQADRqxAaEasQGh1eAsAAQQAAAAABAAAAAC1GttS3Dj2na9QqlKxeyGGzNRWTSXDpJYQKqkiGSo0sw+EHdS2ulvBljy23MBm+t/3HN0su2l3h2QfAFs+N+ncj6D1vUjJtBGp4lIQdqcqmqox/D2pZHF2fBJPec5G5OsOIakUtSLqvmQZrSp6Tw6JYLfkggv1y79wIaa3lCuCGImGOGqmU1bFo9Erj15mU8AzgPD8pT7lk2TG1LFMm4IJFX8lGVX0ZchnOUpKkIbXDOnkDIQAAYFMFOHCVFYkxtWSztjHpoAPL175l18PkU8imuIMVmr/YXfX7MoLBsuhZCgUYsQWXu/BAcNvBcK28ACDCHhwb8y3uINQq4qLWQ0IFjXhihV1UtAyxidy+BvBvwkAWkS9x91Dh5p8kVzEEYlGZJdEn4Xe+hJ+KqaaSmjwVzvLnR2vzFzO4qKedZTHKjyezB42ivw2Z/h4dP8+iyP8zgXNIy0Dn5IYV9xB4XOi2i2idMAgkMfC1Gkl83wsS+AVLLxjfDZXRu5Q0HTeiBs8uhiJ75GC3gHiTwcHoeg1Q54pqzXNOwVHp9J5vH/5n+TJ66vdS/j9WVz9Yx/2+/ff5PKqNTlNHtHMIlpK2lSV0V9gQl0+RE5bnu4E8ERih7zrv4+SnImZmpPfUHYHTCznpGzqucNKQJuF9QgN4iVxxMyXJWF5zVpKjucKnLUClMwCjTbxtRZjoLo2U5eM3hxV8rYGv8VjNptB6hF8Y+n8/F6oOat5HREuyC0XmbztelKjQOc2OJx3cS7wEwXhDe2Oh7CcpWrIOBeSp+xcg0UWFeUyiMGha3IaGJXekxqp/qG/xa0OWgxAMJiXJa1q9h782NBPFjRv2B55cTC6cnjIXUOPzJ6TDolWP45DRRVQLJvBXSLQJypmLNyjx3SccAGoaCFPcklVC2Iktcj93Wv9xpqGhbDGoJd6IUU0ea7Ng3azREpL+M6Mbq3PykYB74+0YK3FPBF0wWdUySopWMbpMVtopYB/rvmkMwGvy5zef8BlDWpsLNELn1gqqwyEt+q2kk5pbpLDcqdvhasW7ULbE3MMKzRUdd+xZwjAjBY+1m8nOeQx2mRcQiKr0G4WPGPwoplAQgstv7J7si7T2WdsmHeTTzeeEU8gkQJzJ11QntNJjgbCMLGE4YAlCNLLTbI8M/nVimDf4orVMl9oGs67Al6IBwjxCL9bUOdU3R1qHWzNwli4FExkAGwBumS9FLWilU+1Rj8hsxVoWfaA272HAk9yObGCHsFjbE5wj3zVZcnLlmLBCzaGpd6GmyoH9ItPp0kK6lPs98kXiCHwHiNlC7o2BGjDiUYg7j1UUpmxKsxVgJzeRNtiVynggCShYOVkKPYgnwlNbzC/Q8KuwxBUTkaAvSrTNGd3Ucgiy4dYgCcLiFfZKRc3jnyWJ/OKTVelNVXeymEnXKR5k0EIj4qSzaAiek2ipCh/jshLeLhlkyLylB1DINTGqKRiID+kof3PiPd0n++RNiEB1so2uci5YM+30gAUqzMwWzi+TrUEVI7Bqp9YdCzPojcmlGYmWJCmhlKPTEy0ssGb1D56R92YjZFFBz2IyFALkZhVPjAi9esTCARAW0kXsj1pG5uefgWU5XWXbBBMw9KglGWTgy277NmG+cHSwMXXth57RKbXbFyi79PbNtXbRM6FYNW78YdTX/0ZAgkUgW8pJLR4sUf4qI1IhossOyIbv7ZSxxF8hTNy+oE3k4UBg7dLXWO4fvp1kQgwxiWJ8TGHpL8cXdu8bWSlZQlR8M2c51kMFDR5E2mwimXivcjYna9ZkikcuV6KFyi+oUmePbNPiZKn8pZVbygE3pGJnfW/uZrHEQPZ/Ul7uoeH5PmLUcDnIDhHt8Fz3Z84pNFDBcOUgXl+OPvZxNGwqjeB8nquVFm/3N+H7lPUaGTJTMpZzmgJakxl0X74U6n6NWeHF+OT5788S3MOh3mobp/LyTOVHzLx/OL82V+HYNcilRm7+PT+jSxKzCXKMl9eP5TjwV1Ln+G1uDGIFoS/JwiRSBBezcGHdGp4W1WyiqPx+Bzw/2oY0Jlqj+v56YNdsqa32iWv9WXNzIiGMeJBBzaiwYr33p4i0ALHEjXRr9rQGcybDqShjny90e3TgqZ+onfQliQ219gwOJhxfKhcxTui1TaoAGawg4XEtJC28DHNWR/E2e9B/8NA2tWaOEe/QR34wIy94tOvHW5LwzyuR0Y5fkjBNUv482tPPML7IwnsrcE5Tjo6B0YcWs8XS7K/wjNJEhs/3H56MQcotskHZwNd6PBYbNyyqjXFY+Ae3pvrS341GqKDwrrSfI1YETjphAvYI+zAH3S7SmxNs06FPc0Hhtmr4+xu2kLOVEv7uoywkXXrCu576rdvq94eX7ttVbk9rm5bqdrWFVv22+aSap11tFWTNosTsIl6zrJk1SBWeAhAjR5KSXMqspwBkwXDBiIIdzi+HDzobHoCIKAjhKwvD/xUyU4lB6Zrd0q36ICrTdcOZRz+2mj8Y2PjukMaCI/fNz1cmRu6wgtB2vlyN+xFb80sGt1fH+wU2jRydnziQsRjCvA18c+NWnGMCeHKhLl1s3Bbz4W60hNv0esrwE50X2E6k5ELgbqYaCdr0IjmaIHRGVQ70B03pfYfijslkDNw2AedgAQ+eurZLS0cUe0XPi+l2qprX5DaNO5aDVfmbBjj+LrbIXqBNfb6UmLkqw8/LEcnO1JiyHhaKBRajzP9indP+57QLHu7ANRTXoNmoXiKoBKEKLJnpxGhOc1ZXg4xBu28A5Cw10WUkUZccZaHFg+dD2EfasIZNqLerZamKN7fJ+8FV5zm/L+gzTlDncoZlLkEghEWhEpCi1bTBSiphNDKKpzz7njJV3d9/PsHa9ynYDVQeIYH4Kc7RukgF83P4c3eVbxXrACfRTFah3XQuKWMVjeRU7oXYiKz+yTNaV2jGChTbCGN2ttoYbY2FC+Q91iDBSFDv/srB/22pb7XS2nIhIKaIBCcSN09kb21tPACh3JRO2qodP2EOs/xhsNxWPaPxBRwAycS1Dk23oOBbXAcC9LBok3NNqFZmKBOsLygX9RyOB3Y9Y1K0EgJQrtexhF24qxQth+2JY3gnjbmq95Iwu1ki6uK/qwAYosmks5x9o7+0iXe06Sdv287xW+R/qCDZZYFaQKH0Kzg5OwnP/nGLnn13LiuL/p+YXF72VCT0Hl+jb2mstxkfQjypsh6BpgW2XhDMWRB2n06ZrBVhw6P7bQdLKKcSFplbbVQbmWX7hAeIJXcVlwx3dJanuERuTuzBGxExF1iLfuVVqbkLHNDPjPLUWNeMEiQjsYA7n30iiz3yIt/Hhz4OLXsxRP8i9nEbBjHe7qA6Q4Px+PzneCq09+8YTuk73Xae2JNZiz1MWw/1utUL0drRpZESEhBTVnKSvmKvV+9uOry8dXzhqLKlnLfWlUFd6r++BwDeynVDyMpwuT+7n/d2T90UbXddekDJP3VXffiJLTXtYdqdN/2jAPNwfB28NeaM+nfOX6HMLZl7YylMSkYTwiMd1Vta4SzOQVpepJQiYGAj6dp8HtE8aZpC5I/xrp+jMaXtmo9dl29dlFak0TdmT653Z7r/IMg8v9z64824kHkc3wHQ0t/DHSJ2FfBFAjf92H/XHzzFMhWdgN3A9SIRnvjEhpOSyIbolj2pw5IcMDdOZEuQsPrAGqJ6lwXj1aBK1bIBQuBcR8VW8ibYB9mym30bDtuHSSNqiGQ4L8rcDM5prCvh+coFvMHzFG0ysOZQDeS27sjE8h12z3QEA9NEALdWQvd3PVvb8P2f5Re9SXBf56QRQl52QgO576WqJVEV1YDNU5HAUByg+NvIhcWA0PUQn/fRDOEHaIZhPJNJAPQIYphJN9EMoQdotkG8k0UW0ig9z9QSwMEFAAAAAgAeaPEWgifEDNDAgAAGgYAAA4AHABkb2NzL3N0eWxlLmNzc1VUCQADRqxAaEasQGh1eAsAAQQAAAAABAAAAACFVMuOmzAU3ecrrIm6CxFhhCoRddGZP+iim6oLAxdixfhatmmSVvPv9QOIA0EjFsD1fZ5zrkusb+TfhpAGhUka2jF+K8h3xSjfEU2FTjQo1hytR0evyYXV5lSQr2kqr8GmWiYKkhLaG3QWSeuaibYgB+iOm4/NZm9O0EFisG05+FISNTMMbRgtNfLegAs0KIcgQhRrT2b6m1Km+yyHzr7ycFD1SqMqbEImDChfrrQD7Wuqzr5USatzq7AXdVIhd77bQ+YeHz5YAGAWyoTszS4yGLgaqoDGtrI3BsVamdfX10UN64iqBjU55XkeMOolR2pPfLaaacmppaHh4FF276RmCqoAmw3vO+FOWiqLEY+HPMMEd8N9grstTBBbNHBbZDdP9MvcJHx7UVS08PL7rhfN/oKlSQU6BnEc0vRL6CbkTxRens817z7yn1qLbOM3ZyKw6/LYelHtoMIo1+Q7FRcoYKaqQU6BHJtQXonVJavJtqoqr00LXlJDhYoGBsYk/oBy1jpW4IkIF32sKGCkx/t0TCQnGHYg96tmXbZSYatA6zcadPKA97iLid+jaabZ2H4fQdkClM+Ua5tJ0zTWbNr434eboUOBWtJqBcKnPbiLYxwnG28O/AOq4XhJbhFrEW7rXWZZNuBhB3Mn77ZBhVwH7JYdOF9LHPxw8l0iNx7/pLyHR60wYXmDpORYnY8DMUNsFmaLBeBvrYAxE9qo3q/rsq3DZ3Kb4/qIzCL3iqS2Fcrbe1e/GRG3wKExETkrl+vH5j9QSwMEFAAAAAgAeaPEWvKdUnLHAAAAGwEAAAoAHABpbmRleC5odG1sVVQJAANGrEBoRqxAaHV4CwABBAAAAAAEAAAAAGWQvY7CMBCE+zzFnmtIKJGw3dyPRHUIccWVi71g6xw752wQeXscgkRBtdLsjL7RyLeP7/fD7+4THLdBV3I6EDCelaAoJoHQ6gpAtsQIxmHuiZX4OXwt1+L5cMzdkv4Hf1Ei0ylT7wSYFJlica82MOSgbDJ946Olaz1x5jh7DqT3ZH0mwz6e67qWzaxWspn58pjseLd3enuCMQ2AmSAmhvxIkgUcOLXI3mAI4wJkqVW6KPHCNcGbP3CUSTaoC66bUDOjIO9T3ABQSwMEFAAAAAgAeaPEWgd/uR6ZCgAAgR8AAAoAHABwZGYybXAzLnB5VVQJAANGrEBoRqxAaHV4CwABBAAAAAAEAAAAAK1ZW2/buBJ+969glYfIW0fby3ky6i2KNl0U57QNmhR9SLOKLFEOt7otScUx2v73M8ObSMlO87AGElvkcGb4zYUzVBRFnyWrmNwR2ZK8bW4pl+TszVtSsooKwhoYFl37jTbk/dlzkvUFa9dt+00kURTNjki3q4BmSQomsnVFV1veNpsTVnctlyddK5hkbbMgZqDtpWAFPZFtV9FbWu1hsOZtVpzQu5x2uPQkz/rNjZzNNAcidsL97Ncdb3MqxKzkbU26TN5UbG1kkTN4tKSc2l+S1h1uTS+Ru441G7vif0xIx/ymB1zsk/4C5nYg45su48Kx7apMli2vZ7NZQUuS39D8W1qWdUc38Zyc/EE+tA1dzgh8ALfXOE1YSd6+RQrCEGghs6qihcIV6WC6aa0iyfaG5TfxsWZ5PNes8NNxgC+OTjlv+dJjiGsHpuSsopmgdoQwSXoBW19G8zGnNadbR6fleUSAf0LvmIyfzoO9Zk2RmkVpQTvaFLTJGRV7dn/aiJ5TQu8k5U1WkbOdvGkb4q8CfCnoQwVtpANE8t2wbWeRRP9K67boKxpHZzvw3meexgcpu13Rrw2h9jfyTlFoLMe4vNO7Q3/h9J+ecVoEOidJ4uPknDPRAOWwNnbT+LnUWNK8l+j5CxKd1BH871iHXwZN/HnC8b+RWgMmIpF3Mrpy7MAWI23f+Gg6PwC1ctSp7Ktq9yhCEx4R7Y0B/GsKzkwNdLhjeUPr2a8sPQvd3vhHQcHONWtoKqVIabOBn9orhOTOKd5YKqI8HeL0TkKaOBEdpfC4znJIQQUmqV7QRG/3jNOScpBOScsLapg9TUid5R/PyfW1yHbX15DV6hqUVpPPEvKFNUW7FeT81dk7cssyoOt2oNrd8+trRfM8IX+27aai5MIoca6U0EI/UdnzRgzu8RF0bkvgEoG46Pp6gT8NR/XYchzZwAA8JnbDMxvkQYArHl50cyWNqGG3wiabBBwI8hmAuVqRyOwrGhYHAfOLUNDqDv5rAuLU5uGQ0TQkDAcCejmELy7Ow6A4HBgPjwWr6tV8ApKd0kBpHR1R9CXjDWY80mSS3VLUTiXJsu0bSJBvzUbQ09DNNjiPu4kGFsYZxa6BeBAMzsCZF30Py0/KD4KkswfjKb5OnRIGUMeHpJuHo4rsEdKZj6dSFaIY5tLTD3+++3BKVgfCeabPU5183QlclJ9oBoFJyBFA/U+2JKf/efLMnNaYfS3lKywrzukGc9uIWCcRCESe5TLFtJDi+rQryhj+Ujz1l+qwn+SUU71I5RKi9TOFjUkgr/jGC+SQG/oAWNktORD9Rgak1kGKWeYiXWOqgFgNoDjttRXVcghjc9a1YBmY3UAyXpGKNrFmkKghYyd0B7YgOAQpntCmrynPJA1oF+TppFooLTQqtTu9FaPv7Ofv3z3xP0NHU9SPV4o28a0CWegxib42UeBDOGPrBKhAGk2K/5ZoqonJXiMRgWyNm6szazvY6JpKcDwyCcF9ltT8P2VbvRwrW+R7wIRKpjFgYLMjoK1bSBV4gkCFgq5QU5kVmcwIRCXYpmLfKIkumKzokiBSmO2jVz1UNFwPKE65FpHqRStyeeUMiENoPZSeiA5KcUUUe0aDlM9pAmjAARHkUh79FSvZP7TEH6/B8hK+zzhkm5yaAUgtb8AtfrxvC/V93q//prn88V+628LBKX7g6Pyr+G0ZLQL+qEkC5mFdPB9m5uFZAE0D+FFP3WCw2STrsESI8cHmSePp4CvJ3y1r4mCBIXLY130lGXQLpKFbReDzAFgg88UceIH6wHCh2C7U/DxkBJ6TMyg385tMRSwXEKjgYTWD/oJAm4HlsRD9AQmXf33dfhXJ4tHLkysUEwjxvN3i5arjvvk28voFFCh3KeohlthhgZinT+CjogGbkEsgunIxcY5OofVR7ZhiKfygMKkfovmecLgwoaB8zOfk6Dyt3md3rO5rH6wOBKkFB8IIFcdCSCnqcR6iSW9kvSNY1mPZJkjMW2jvCDgJb0Gi8lUN6UCjjYBrY34cv3yxukwevbwCf3187NvAwOKCK+851IYyVeM6s7qgs8wx8JygIOAw5QYcML3hoCWfkxceYGFEBJIhWTpxkCG9eoJWgo5Wqj3YmAn4WL+a3yNqIslWjAHZIPJB4nwHN2bVrq3OYtmmOiX77g1tftfL8dEctsDmqkE6r1R5XTWl6gBdU3Cn7DZjFZYuRBcaBwp/7HeDmn/halCvuCcxlvwmkakjhkH7We32V/sPiCR7XeLUd3QTAKCrAYXVxvAaBQsKsmXQYK8hMWW3tNgbKkPMQwMDB65Cwgst5/KjLDP3aghHozxaPbgUe0Gx/Mr4jhTQWOZwcux0UdFgjUcLBueCvghSC7YMyyJzgZK4xW/sWigBMqEIUuDno6ZHFB5YAsFXbAcHf1Z3S6nQVaAJZDdpah3t50Gxo/cUljn4saXOmUuOZrVX4ei1psQJW6WS+GXvSrdgoQQN4mc4N7TzAUXQbE4iO1V2X40A+Z2UkZ4GzVRjf8/qZMuZpNrUOi9NiDNWlhbq+yQh3VSU10nwvokn8/i5VGBgO1HCfwj5eFBwjsOtGXaqzK8WezmpZmV1wXs6nd+zs8BDbN7ay9jvKBLVMKBycajUwlSZq0hhMRUYjtBq6hW255x6hr0ZNI0xeIrcdVAlsk3Tcjoh1wkOTGYWJKyBA2+q0ja7fYhxgWxqW5NEMeFg4laIqCXaWpb1fCrVrASPeNUUX7K9mv071nFKDMbBvfzaNuOzFD+qrcE21lpDtdEjU1zquavJ6rp7/hCogWwKNQoyAarwVnuzDPcA/O+A5wQM4KF2+8Ab3zW8bus1wwsSrQpxqgTtnzoyU00B1UZfx6HiU76nd+4OscWz7yA/6CaRUu3DOz8nW9HFR51B4zAtK97DMCn7JsdCcvxKwyhgT1l1gY8tub3MT+Cw73EbZ2pmQL+gIodqCHmuXOWSWZ7Z6NWIvRQaZCRZUaSZYe5dSXVF6XVcDVCIVfTSG0I3XeFxOQzd0KpbRftuKPztxoBRBp3TEma40NsHZEyJB4hWUDbNjaSHqIop3Xs60RZ6sKph+RNUPgl5o3UVuIEXgMkfKqSsbrpcA2gwN2od1RdqiZfOWvnCHXk4nMCzrX3dFBSJg6+YRaowgsYlVjVJBK6ZbKp2HUe/IYvIC1TTE+Aadd/6dFRtDAogyeWTMJ3YYuSzqkPwDk3dGYFZluS7XfvTv3+txgKf7L2CNe99PrTaDfAuU90mANKhsd0rINUHlzvwX1VPjK9nvfc7gy7j3BoKf29bdFBB2PvUkTR9qw/w2yv8e+Ray+HtrMUGJ4UMrkXcXZZ59YUhMGBJipbqt2Bq5aFXWCMngWa/LNldUrVbSABz8mhFjtETjg+9cHvXQBjo8Kt7CDTwapUY7pNnFTeZBD3C09tPk7qO9++Vj+yNo+pg1M3JcHGlqPW9xf0XpvMx+ehyzkvjR+T1Q9ocG3h6CCH1H9GDBoyxj0g10PExxvpxqM+oqQz6yckBY2EUmPCh+gY/lPQR+agFqwwDmkOUeUx+WmjHN/DYv9ADHkaKnqsmwokDpvTnwXejAEGaNllN01RVimmKZ1aamlJRH2Cz/wNQSwMEFAAAAAgAeaPEWhF3AINDAAAASQAAABAAHAByZXF1aXJlbWVudHMudHh0VVQJAANGrEBoRqxAaHV4CwABBAAAAAAEAAAAAAuoDHBxM7KzNdYz0DPgKqhMKU2yszXQMzLVM+QqTi0pLSjJz88ptrM1MwUrSA8JCbazNdIDSRdUlpQUVxiDuJYGXABQSwMEFAAAAAgAeaPEWnWlajZ0AQAAkAMAAAgAHABzZXR1cC5zaFVUCQADRqxAaEasQGh1eAsAAQQAAAAABAAAAACtU7FqwzAQ3fUVF6d0KNgeurWkUEqgnRJIO5SQQbHOtkCWVFl24r+vpCjBbZKpFcaIu3fv3ZNO00m+5TLf0rYmZArzPbegJKAxypAWLaTo4y8GqUXoubEdFYDS7ZRsUFqCRa0gCQAuq0uQLMsSogdbK3kPaQO9y4UfaVVnCgz70AYtLO+dkJf80JWhDEFzHTUOES/iYgdSroHL1lIhIE27UYUjeIuJZVAGhholQ1lwbCNhRHjGC6BzBQMGvzpu0LtqM7u3Y52ybDRWwEt/gA0tFivi9us1JDeL1fvncp7AbAYJo2bHZXIHm80j2BolAbcccgKFahoqGaT9kez2CXKGfS47IUZov84sxJIdtzW8qga3BnfBw7HCB05mDuiQQ9HiL9rIRYW7VjYci5BFtpITFK7lUcNU27Ry83Kl43/259R+WGs7pk4tdJr5GbqYO93l8OcTcF+coxXaTnt3WqDFCTzHMYbBzff4JYTmH+Da2CdAvgFQSwECHgMUAAAACAB5o8RaDMesKUsBAAB/AgAAGwAYAAAAAAABAAAApIEAAAAALmdpdGh1Yi93b3JrZmxvd3MvcGFnZXMueW1sVVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsBAh4DFAAAAAgAeaPEWgenyTT5AAAAZgEAAAoAGAAAAAAAAQAAAKSBoAEAAC5naXRpZ25vcmVVVAUAA0asQGh1eAsAAQQAAAAABAAAAABQSwECHgMUAAAACAB5o8RaT4epSHgCAAAxBAAABwAYAAAAAAABAAAApIHdAgAATElDRU5TRVVUBQADRqxAaHV4CwABBAAAAAAEAAAAAFBLAQIeAxQAAAAIAHmjxFpDba4YXgcAAFgQAAAJABgAAAAAAAEAAACkgZYFAABSRUFETUUubWRVVAUAA0asQGh1eAsAAQQAAAAABAAAAABQSwECHgMUAAAACAB5o8RanGr6tXYEAABmCgAADwAYAAAAAAABAAAApIE3DQAAZG9jcy9pbmRleC5odG1sVVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsBAh4DFAAAAAgAeaPEWj0z3z5nCwAAaikAAA4AGAAAAAAAAQAAAKSB9hEAAGRvY3Mvc2NyaXB0LmpzVVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsBAh4DFAAAAAgAeaPEWgifEDNDAgAAGgYAAA4AGAAAAAAAAQAAAKSBpR0AAGRvY3Mvc3R5bGUuY3NzVVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsBAh4DFAAAAAgAeaPEWvKdUnLHAAAAGwEAAAoAGAAAAAAAAQAAAKSBMCAAAGluZGV4Lmh0bWxVVAUAA0asQGh1eAsAAQQAAAAABAAAAABQSwECHgMUAAAACAB5o8RaB3+5HpkKAACBHwAACgAYAAAAAAABAAAApIE7IQAAcGRmMm1wMy5weVVUBQADRqxAaHV4CwABBAAAAAAEAAAAAFBLAQIeAxQAAAAIAHmjxFoRdwCDQwAAAEkAAAAQABgAAAAAAAEAAACkgRgsAAByZXF1aXJlbWVudHMudHh0VVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsBAh4DFAAAAAgAeaPEWnWlajZ0AQAAkAMAAAgAGAAAAAAAAQAAAKSBpSwAAHNldHVwLnNoVVQFAANGrEBodXgLAAEEAAAAAAQAAAAAUEsFBgAAAAALAAsAjgMAAFsuAAAAAA==';

function downloadZip() {
  const binary = atob(ZIP_BASE64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'audiobook_maker.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function setCmdPath() {
  const cmdText = document.getElementById('cmdText');
  if (!cmdText) return;
  const ua = (navigator.userAgent || navigator.platform || '').toLowerCase();
  if (ua.includes('win')) {
    cmdText.textContent = 'python %USERPROFILE%\\Downloads\\audiobook_maker\\pdf2mp3.py';
  } else {
    cmdText.textContent = 'python ~/Downloads/audiobook_maker/pdf2mp3.py';
  }
}

const convertBtn = document.getElementById('convertBtn');
if (convertBtn) {
  convertBtn.addEventListener('click', () => {
    downloadZip();
    setCmdPath();
    const help = document.getElementById('mp3Help');
    if (help) help.style.display = 'block';
  });
}

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

  setCmdPath();

  const copyBtn = document.getElementById('copyCmdBtn');
  const cmdText = document.getElementById('cmdText');
  if (copyBtn && cmdText && navigator.clipboard) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cmdText.textContent.trim()).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }
});

// Listen to text using browser TTS
let currentUtterance = null;
function listenToText() {
  if (!('speechSynthesis' in window)) {
    alert('Browser speech synthesis not supported.');
    return;
  }
  const text = document.getElementById('textInput').value.trim();
  if (!text) {
    alert('Please extract a PDF or enter some text.');
    return;
  }
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  const utter = new SpeechSynthesisUtterance(text);
  currentUtterance = utter;
  utter.onend = () => {
    document.getElementById('listenControls').style.display = 'none';
    currentUtterance = null;
  };
  window.speechSynthesis.speak(utter);
  document.getElementById('listenControls').style.display = 'flex';
}

function pauseListen() {
  if (currentUtterance) window.speechSynthesis.pause();
}
function resumeListen() {
  if (currentUtterance) window.speechSynthesis.resume();
}
function stopListen() {
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
    document.getElementById('listenControls').style.display = 'none';
  }
}

// Download text as .txt file
function downloadText() {
  const text = document.getElementById('textInput').value.trim();
  if (!text) {
    alert('No text to download.');
    return;
  }
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'extracted_text.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Extract PDF text and put in textarea
async function handleExtract() {
  const file = document.getElementById('pdfFile').files[0];
  if (!file) {
    alert('Please select a PDF file.');
    return;
  }
  log('Extracting text from PDF...');
  const text = await extractTextFromPDF(file);
  document.getElementById('textInput').value = text;
  log('Extraction complete.');
}

document.getElementById('extractBtn').addEventListener('click', handleExtract);
document.getElementById('listenBtn').addEventListener('click', listenToText);
document.getElementById('downloadTextBtn').addEventListener('click', downloadText);
document.getElementById('pauseListenBtn').addEventListener('click', pauseListen);
document.getElementById('resumeListenBtn').addEventListener('click', resumeListen);
document.getElementById('stopListenBtn').addEventListener('click', stopListen);
