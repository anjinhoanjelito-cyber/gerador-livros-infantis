let CONFIG = {
    geminiKey: localStorage.getItem('geminiKey') || '',
    replicateKey: localStorage.getItem('replicateKey') || '',
    workerUrl: 'https://livros-infantis-api.anjinhoanjelito.workers.dev'
};

let currentBook = null;

window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    if (CONFIG.geminiKey) {
        document.getElementById('geminiKey').value = CONFIG.geminiKey;
    }
    if (CONFIG.replicateKey) {
        document.getElementById('replicateKey').value = CONFIG.replicateKey;
    }
    if (CONFIG.geminiKey && CONFIG.replicateKey) {
        showFormCard();
    }
    setupEventListeners();
    initDarkMode();
    addResetButton();
}

function addResetButton() {
    const btn = document.createElement('button');
    btn.textContent = '⚙️ Trocar Chaves';
    btn.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;background:#dc3545;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;z-index:9999;box-shadow:0 4px 15px rgba(220,53,69,0.4)';
    btn.onclick = () => {
        if (confirm('Trocar chaves?')) {
            localStorage.clear();
            location.reload();
        }
    };
    document.body.appendChild(btn);
}

function setupEventListeners() {
    document.querySelectorAll('.age-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('age').value = this.dataset.age;
        };
    });

    const slider = document.getElementById('numPages');
    slider.oninput = function() {
        const pages = parseInt(this.value);
        document.getElementById('pagesDisplay').textContent = pages;
        const mins = Math.ceil(pages * 0.5);
        document.getElementById('timeEstimate').textContent = `${mins}-${mins + 2} minutos`;
        const cost = (0.05 + (Math.floor(pages / 2) * 0.04)).toFixed(2);
        document.getElementById('costEstimate').textContent = `~R$ ${cost}`;
    };

    document.getElementById('bookForm').onsubmit = handleFormSubmit;
    document.getElementById('downloadBtn').onclick = downloadBook;
}

function saveApiKeys() {
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const replicateKey = document.getElementById('replicateKey').value.trim();

    if (!geminiKey || !replicateKey) {
        showAlert('apiError', 'Preencha as chaves');
        return;
    }

    if (!geminiKey.startsWith('AIza')) {
        showAlert('apiError', 'Chave Gemini invalida');
        return;
    }

    if (!replicateKey.startsWith('r8_')) {
        showAlert('apiError', 'Token Replicate invalido');
        return;
    }

    CONFIG.geminiKey = geminiKey;
    CONFIG.replicateKey = replicateKey;

    localStorage.setItem('geminiKey', geminiKey);
    localStorage.setItem('replicateKey', replicateKey);

    showAlert('apiSuccess', 'Chaves salvas');
    setTimeout(() => showFormCard(), 1500);
}

function showFormCard() {
    document.getElementById('apiSection').style.display = 'none';
    document.getElementById('formCard').style.display = 'block';
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = {
        theme: document.getElementById('theme').value.trim(),
        age: parseInt(document.getElementById('age').value),
        tone: document.getElementById('tone').value,
        numPages: parseInt(document.getElementById('numPages').value),
        authorName: document.getElementById('authorName').value.trim()
    };

    if (!formData.theme || formData.theme.length < 20) {
        showAlert('formError', 'Descreva melhor o tema');
        return;
    }

    await generateBook(formData);
}

async function generateBook(formData) {
    try {
        showProgressCard();
        logDebug('Iniciando geracao');

        updateProgress(10, 'Gerando historia', 1);
        const story = await callGeminiAPI(formData);
        logDebug('Historia criada: ' + story.title);

        updateProgress(30, 'Historia criada', 1, true);
        await sleep(800);

        updateProgress(35, 'Criando capa', 2);
        const coverImage = await generateCoverImage(story);

        updateProgress(50, 'Capa pronta', 2, true);

        const illustrations = [];
        const pages = story.pages.filter(p => p.needsIllustration);

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            updateProgress(55 + Math.floor((i / pages.length) * 25), `Ilustrando ${i + 1}/${pages.length}`, 3);
            const img = await generateImage(page.illustrationPrompt);
            illustrations.push({ pageNumber: page.pageNumber, image: img });
        }

        updateProgress(80, 'Ilustracoes prontas', 3, true);
        updateProgress(85, 'Montando PDF', 4);

        const pdf = await generatePDF(story, coverImage, illustrations, formData);

        updateProgress(100, 'Livro completo', 4, true);

        currentBook = { story, coverImage, illustrations, pdf, formData };
        showPreviewCard();

    } catch (error) {
        console.error(error);
        logDebug('ERRO: ' + error.message);
        alert('Erro: ' + error.message);
        hideProgressCard();
    }
}

async function callGeminiAPI(formData) {
    logDebug('Chamando Gemini API v1');

    const prompt = `Crie uma historia infantil.

Tema: ${formData.theme}
Idade: ${formData.age} anos
Tom: ${formData.tone}
Paginas: ${formData.numPages}

Retorne APENAS JSON valido:
{"title":"Titulo","pages":[{"pageNumber":1,"text":"Texto","needsIllustration":true,"illustrationPrompt":"prompt ingles"}],"mainCharacters":[{"name":"Nome","visualReference":"desc"}],"colorPalette":["#hex"],"mood":"alegre","setting":"cenario"}`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.geminiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 8000 }
        })
    });

    logDebug('Status: ' + response.status);

    if (!response.ok) {
        const err = await response.text();
        logDebug('Erro: ' + err.substring(0, 200));
        throw new Error('Gemini erro ' + response.status);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]) {
        throw new Error('Resposta invalida');
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error('JSON nao encontrado');

    return JSON.parse(jsonMatch[0]);
}

async function generateCoverImage(story) {
    return await generateImage(`Children's book cover: ${story.title}, vibrant, colorful, NO TEXT`);
}

async function generateImage(prompt) {
    logDebug('Gerando imagem');

    const startResp = await fetch(`${CONFIG.workerUrl}/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: CONFIG.replicateKey,
            payload: {
                version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
                input: { prompt, go_fast: true, num_outputs: 1, aspect_ratio: "3:4" }
            }
        })
    });

    if (!startResp.ok) throw new Error('Replicate erro');

    let result = await startResp.json();
    let attempts = 0;

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 60) {
        await sleep(3000);
        const statusResp = await fetch(`${CONFIG.workerUrl}/replicate/status/${result.id}`, {
            headers: { 'Authorization': `Token ${CONFIG.replicateKey}` }
        });
        if (statusResp.ok) result = await statusResp.json();
        attempts++;
    }

    if (result.status === 'failed') throw new Error('Imagem falhou');
    if (!result.output || !result.output[0]) throw new Error('Sem imagem');

    const imgUrl = result.output[0];
    const resp = await fetch(imgUrl);
    const blob = await resp.blob();

    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

async function generatePDF(story, coverImage, illustrations, formData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let illustrationMap = {};
    illustrations.forEach(ill => illustrationMap[ill.pageNumber] = ill.image);

    pdf.addImage(coverImage, 'PNG', 0, 0, 210, 297);

    story.pages.forEach(page => {
        pdf.addPage();
        if (illustrationMap[page.pageNumber]) {
            pdf.addImage(illustrationMap[page.pageNumber], 'PNG', 0, 0, 210, 297);
        } else {
            pdf.setFontSize(18);
            pdf.text(page.text, 105, 148, { align: 'center', maxWidth: 170 });
        }
    });

    return pdf;
}

function updateProgress(percent, message, step, completed = false) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent + '%';
    document.getElementById('statusMessage').textContent = message;

    if (step) {
        const el = document.getElementById(`step${step}`);
        if (completed) {
            el.classList.add('completed');
            el.classList.remove('active');
        } else {
            el.classList.add('active');
        }
    }
}

function showProgressCard() {
    document.getElementById('formCard').style.display = 'none';
    document.getElementById('progressCard').style.display = 'block';
}

function hideProgressCard() {
    document.getElementById('formCard').style.display = 'block';
    document.getElementById('progressCard').style.display = 'none';
}

function showPreviewCard() {
    document.getElementById('progressCard').style.display = 'none';
    document.getElementById('previewCard').style.display = 'block';
    document.getElementById('bookCover').src = currentBook.coverImage;
    document.getElementById('bookInfo').innerHTML = `
        <h3>${currentBook.story.title}</h3>
        <p><strong>Autor:</strong> ${currentBook.formData.authorName}</p>
        <p><strong>Paginas:</strong> ${currentBook.formData.numPages}</p>
    `;
}

function showAlert(elementId, message) {
    const alert = document.getElementById(elementId);
    alert.textContent = message;
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 5000);
}

function logDebug(message) {
    console.log(message);
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${message}</div>`;
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

function downloadBook() {
    if (currentBook) {
        currentBook.pdf.save('livro.pdf');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let darkMode = localStorage.getItem('darkMode') === 'true';

function initDarkMode() {
    const btn = document.createElement('button');
    btn.innerHTML = darkMode ? '☀️' : '🌙';
    btn.style.cssText = 'position:fixed;bottom:30px;right:30px;width:60px;height:60px;border-radius:50%;border:none;background:white;font-size:1.8rem;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:9999';
    btn.onclick = () => {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        btn.innerHTML = darkMode ? '☀️' : '🌙';
        localStorage.setItem('darkMode', darkMode);
    };
    document.body.appendChild(btn);
    if (darkMode) document.body.classList.add('dark-mode');
}

console.log('App carregado');
