// ============================================
// GERADOR DE LIVROS INFANTIS - V3 CORRIGIDA
// ============================================

// Configuração Global
let CONFIG = {
    anthropicKey: localStorage.getItem('anthropicKey') || '',
    replicateKey: localStorage.getItem('replicateKey') || '',
    workerUrl: 'https://livros-infantis-api.anjinhoanjelito.workers.dev/'
};

let currentBook = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    if (CONFIG.anthropicKey) {
        document.getElementById('anthropicKey').value = CONFIG.anthropicKey;
    }
    if (CONFIG.replicateKey) {
        document.getElementById('replicateKey').value = CONFIG.replicateKey;
    }

    if (CONFIG.anthropicKey && CONFIG.replicateKey) {
        showFormCard();
    }

    setupEventListeners();
    initDarkMode();
}

function setupEventListeners() {
    document.querySelectorAll('.age-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('age').value = this.dataset.age;
        });
    });

    const pagesSlider = document.getElementById('numPages');
    const pagesDisplay = document.getElementById('pagesDisplay');
    const timeEstimate = document.getElementById('timeEstimate');
    const costEstimate = document.getElementById('costEstimate');

    pagesSlider.addEventListener('input', function() {
        const pages = parseInt(this.value);
        pagesDisplay.textContent = pages;

        const estimatedMinutes = Math.ceil(pages * 0.5);
        timeEstimate.textContent = `${estimatedMinutes}-${estimatedMinutes + 2} minutos`;

        const illustrationCount = Math.floor(pages / 2);
        const estimatedCost = (0.05 + (illustrationCount * 0.04)).toFixed(2);
        costEstimate.textContent = `~R$ ${estimatedCost}`;
    });

    document.getElementById('bookForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('downloadBtn').addEventListener('click', downloadBook);
}

// ============================================
// API KEYS
// ============================================

function saveApiKeys() {
    const anthropicKey = document.getElementById('anthropicKey').value.trim();
    const replicateKey = document.getElementById('replicateKey').value.trim();

    if (!anthropicKey || !replicateKey) {
        showAlert('apiError', '⚠️ Preencha ambas as chaves!');
        return;
    }

    if (!anthropicKey.startsWith('sk-ant-')) {
        showAlert('apiError', '❌ Chave Anthropic inválida!');
        return;
    }

    if (!replicateKey.startsWith('r8_')) {
        showAlert('apiError', '❌ Token Replicate inválido!');
        return;
    }

    CONFIG.anthropicKey = anthropicKey;
    CONFIG.replicateKey = replicateKey;

    localStorage.setItem('anthropicKey', anthropicKey);
    localStorage.setItem('replicateKey', replicateKey);

    showAlert('apiSuccess', '✅ Chaves salvas! Agora você pode criar livros.');
    setTimeout(() => showFormCard(), 1500);
}

function showFormCard() {
    document.getElementById('apiSection').style.display = 'none';
    document.getElementById('formCard').style.display = 'block';
}

// ============================================
// GERAÇÃO DO LIVRO
// ============================================

async function handleFormSubmit(e) {
    e.preventDefault();

    if (!CONFIG.anthropicKey || !CONFIG.replicateKey) {
        showAlert('formError', '⚠️ Configure as chaves API primeiro!');
        return;
    }

    const formData = {
        characterName: document.getElementById('characterName').value.trim(),
        characterGender: document.getElementById('characterGender').value,
        characterAge: document.getElementById('characterAge').value,
        skinTone: document.getElementById('skinTone').value,
        hairType: document.getElementById('hairType').value,
        hairColor: document.getElementById('hairColor').value,
        eyeColor: document.getElementById('eyeColor').value,
        characterClothes: document.getElementById('characterClothes').value.trim(),
        characterTraits: document.getElementById('characterTraits').value.trim(),
        theme: document.getElementById('theme').value.trim(),
        moralLesson: document.getElementById('moralLesson').value.trim(),
        age: parseInt(document.getElementById('age').value),
        tone: document.getElementById('tone').value,
        numPages: parseInt(document.getElementById('numPages').value),
        authorName: document.getElementById('authorName').value.trim()
    };

    if (!formData.theme || formData.theme.length < 20) {
        showAlert('formError', '⚠️ Descreva melhor o tema (mínimo 20 caracteres)!');
        return;
    }

    if (!formData.authorName || formData.authorName.length < 2) {
        showAlert('formError', '⚠️ Insira seu nome!');
        return;
    }

    await generateBook(formData);
}

async function generateBook(formData) {
    try {
        showProgressCard();
        logDebug('🚀 Iniciando geração...');

        updateProgress(5, 'Preparando...', '🎨', 1);
        await sleep(500);

        updateProgress(10, 'Gerando história...', '✍️', 1);
        const story = await callClaudeAPI(formData);
        logDebug(`✅ História: "${story.title}"`);

        updateProgress(30, 'História criada!', '✅', 1, true);
        await sleep(800);

        updateProgress(35, 'Criando capa...', '🎨', 2);
        const coverImage = await generateCoverImage(story, formData);

        updateProgress(50, 'Capa pronta!', '✅', 2, true);
        await sleep(800);

        updateProgress(55, 'Iniciando ilustrações...', '🖼️', 3);
        const illustrations = [];

        const illustrationPages = story.pages.filter(p => p.needsIllustration);
        const totalIllustrations = illustrationPages.length;

        for (let i = 0; i < totalIllustrations; i++) {
            const page = illustrationPages[i];
            const progress = 55 + Math.floor((i / totalIllustrations) * 25);

            updateProgress(progress, `Ilustrando página ${page.pageNumber}...`, '🎨', 3);

            const img = await generateIllustration(page.illustrationPrompt, formData);
            illustrations.push({
                pageNumber: page.pageNumber,
                image: img
            });
        }

        updateProgress(80, 'Ilustrações prontas!', '✅', 3, true);
        await sleep(800);

        updateProgress(85, 'Montando PDF...', '📄', 4);
        const pdf = await generatePDF(story, coverImage, illustrations, formData);

        updateProgress(100, 'Livro completo!', '🎉', 4, true);
        await sleep(1000);

        currentBook = { story, coverImage, illustrations, pdf, formData };
        showPreviewCard();

    } catch (error) {
        console.error('Erro:', error);
        logDebug(`❌ ERRO: ${error.message}`);

        let errorMessage = 'Erro ao gerar livro. ';

        if (error.message.includes('401') || error.message.includes('authentication')) {
            errorMessage += 'Chave API inválida ou sem créditos.';
        } else if (error.message.includes('429')) {
            errorMessage += 'Limite atingido. Aguarde.';
        } else if (error.message.includes('Worker')) {
            errorMessage += 'Problema com Worker. Verifique URL.';
        } else {
            errorMessage += error.message;
        }

        alert('❌ ' + errorMessage);
        hideProgressCard();
    }
}

// ============================================
// CHAMADA CLAUDE API
// ============================================

async function callClaudeAPI(formData) {
    const prompt = buildStoryPrompt(formData);

    logDebug('📤 Enviando para Claude...');

    try {
        const response = await fetch(`${CONFIG.workerUrl}/claude`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: CONFIG.anthropicKey,
                payload: {
                    model: 'claude-3-5-sonnet-20241022',
                    max_tokens: 8000,
                    temperature: 0.9,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Worker erro ${response.status}: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`API erro: ${data.error.message}`);
        }

        const storyText = data.content[0].text;
        const jsonMatch = storyText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('Formato inválido da IA');
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        logDebug(`❌ Erro Claude: ${error.message}`);
        throw error;
    }
}

function buildStoryPrompt(formData) {
    let characterDesc = '';

    if (formData.characterName) characterDesc += `Nome: ${formData.characterName}\n`;
    if (formData.characterGender) characterDesc += `Gênero: ${formData.characterGender}\n`;
    if (formData.skinTone) {
        characterDesc += `Aparência: ${formData.skinTone}`;
        if (formData.hairType) characterDesc += `, ${formData.hairType}`;
        if (formData.hairColor) characterDesc += ` ${formData.hairColor}`;
        if (formData.eyeColor) characterDesc += `, ${formData.eyeColor}`;
        characterDesc += `\n`;
    }
    if (formData.characterClothes) characterDesc += `Roupas: ${formData.characterClothes}\n`;
    if (formData.characterTraits) characterDesc += `Características: ${formData.characterTraits}\n`;

    const ageGuidelines = {
        2: 'Vocabulário muito simples, frases 5-8 palavras',
        4: 'Vocabulário simples, frases 8-12 palavras',
        6: 'Vocabulário intermediário, frases 10-15 palavras',
        8: 'Vocabulário avançado, frases 12-20 palavras'
    };

    return `Você é escritor de livros infantis.

TAREFA: Criar história sobre: "${formData.theme}"

${characterDesc ? `PERSONAGEM:\n${characterDesc}\n` : ''}

PARÂMETROS:
- Idade: ${formData.age} anos
- Tom: ${formData.tone}
- Páginas: ${formData.numPages}
- Linguagem: ${ageGuidelines[formData.age]}
${formData.moralLesson ? `- Mensagem: ${formData.moralLesson}` : ''}

ESTRUTURA JSON:
{
  "title": "Título",
  "subtitle": "Subtítulo",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto (máx 50 palavras)",
      "needsIllustration": true,
      "illustrationPrompt": "Descrição detalhada em inglês"
    }
  ],
  "mainCharacters": [{"name": "Nome", "description": "Desc", "visualReference": "Ref visual"}],
  "colorPalette": ["#hex1", "#hex2"],
  "mood": "alegre",
  "setting": "Cenário"
}

REGRAS:
- Páginas ímpares: needsIllustration = true
- Páginas pares: needsIllustration = false
- Manter consistência visual

Retorne APENAS JSON.`;
}

// ============================================
// GERAÇÃO DE IMAGENS
// ============================================

async function generateCoverImage(story, formData) {
    const prompt = `Children's book cover: ${story.title}
Characters: ${story.mainCharacters.map(c => c.visualReference).join(', ')}
Setting: ${story.setting}
Mood: ${story.mood}
Colors: ${story.colorPalette.join(', ')}
Professional, vibrant, NO TEXT`;

    return await generateImage(prompt);
}

async function generateIllustration(illustrationPrompt, formData) {
    const prompt = `${illustrationPrompt}
Children's book illustration, age ${formData.age}, colorful, NO TEXT`;

    return await generateImage(prompt);
}

async function generateImage(prompt) {
    logDebug('🎨 Gerando imagem...');

    try {
        const startResponse = await fetch(`${CONFIG.workerUrl}/replicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: CONFIG.replicateKey,
                payload: {
                    version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
                    input: {
                        prompt: prompt,
                        go_fast: true,
                        num_outputs: 1,
                        aspect_ratio: "3:4",
                        output_format: "png",
                        output_quality: 90
                    }
                }
            })
        });

        if (!startResponse.ok) {
            throw new Error(`Worker erro ${startResponse.status}`);
        }

        const prediction = await startResponse.json();
        logDebug(`⏳ Predição: ${prediction.id}`);

        let result = prediction;
        let attempts = 0;

        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 120) {
            await sleep(2000);

            const statusResponse = await fetch(
                `${CONFIG.workerUrl}/replicate/status/${result.id}`,
                { headers: { 'Authorization': `Token ${CONFIG.replicateKey}` } }
            );

            if (statusResponse.ok) {
                result = await statusResponse.json();
            }

            attempts++;

            if (attempts % 5 === 0) {
                logDebug(`⏳ Aguardando... (${attempts * 2}s)`);
            }
        }

        if (result.status === 'failed') {
            throw new Error('Falha ao gerar imagem');
        }

        if (!result.output || !result.output[0]) {
            throw new Error('Imagem não gerada');
        }

        logDebug('✅ Imagem pronta!');
        return await urlToBase64(result.output[0]);

    } catch (error) {
        logDebug(`❌ Erro imagem: ${error.message}`);
        throw error;
    }
}

async function urlToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ============================================
// GERAÇÃO PDF
// ============================================

async function generatePDF(story, coverImage, illustrations, formData) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;

    let illustrationMap = {};
    illustrations.forEach(ill => illustrationMap[ill.pageNumber] = ill.image);

    // CAPA
    pdf.addImage(coverImage, 'PNG', 0, 0, pageWidth, pageHeight);
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new pdf.GState({opacity: 0.5}));
    pdf.rect(0, pageHeight - 90, pageWidth, 90, 'F');
    pdf.setGState(new pdf.GState({opacity: 1}));

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont(undefined, 'bold');
    pdf.text(story.title, pageWidth / 2, pageHeight - 60, { align: 'center', maxWidth: pageWidth - 40 });

    pdf.setFontSize(20);
    pdf.text(`Por ${formData.authorName}`, pageWidth / 2, pageHeight - 25, { align: 'center' });

    // PÁGINAS
    pdf.addPage();
    pdf.setFillColor(252, 252, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(16);
    pdf.text('Esta história foi criada por', pageWidth / 2, 100, { align: 'center' });

    pdf.setFontSize(24);
    pdf.setTextColor(102, 126, 234);
    pdf.text(formData.authorName, pageWidth / 2, 125, { align: 'center' });

    story.pages.forEach(page => {
        pdf.addPage();

        if (page.needsIllustration && illustrationMap[page.pageNumber]) {
            pdf.addImage(illustrationMap[page.pageNumber], 'PNG', 0, 0, pageWidth, pageHeight);
        } else {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            pdf.setDrawColor(102, 126, 234);
            pdf.setLineWidth(2);
            pdf.roundedRect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, 8, 8, 'S');

            pdf.setTextColor(40, 40, 40);
            pdf.setFontSize(18);
            pdf.text(page.text, pageWidth / 2, pageHeight / 2, { align: 'center', maxWidth: pageWidth - 60 });
        }
    });

    pdf.addPage();
    pdf.setFillColor(252, 252, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFontSize(56);
    pdf.setTextColor(102, 126, 234);
    pdf.text('Fim ♥', pageWidth / 2, pageHeight / 2, { align: 'center' });

    return pdf;
}

// ============================================
// INTERFACE
// ============================================

function updateProgress(percent, message, icon, step, completed = false) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = Math.round(percent) + '%';
    document.getElementById('statusMessage').textContent = message;
    document.getElementById('statusIcon').textContent = icon;

    if (step) {
        const stepElement = document.getElementById(`step${step}`);
        if (completed) {
            stepElement.classList.add('completed');
            stepElement.classList.remove('active');
        } else {
            stepElement.classList.add('active');
        }
    }
}

function showProgressCard() {
    document.getElementById('formCard').style.display = 'none';
    document.getElementById('progressCard').style.display = 'block';
    document.getElementById('previewCard').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideProgressCard() {
    document.getElementById('formCard').style.display = 'block';
    document.getElementById('progressCard').style.display = 'none';
}

function showPreviewCard() {
    document.getElementById('formCard').style.display = 'none';
    document.getElementById('progressCard').style.display = 'none';
    document.getElementById('previewCard').style.display = 'block';

    document.getElementById('bookCover').src = currentBook.coverImage;
    document.getElementById('bookInfo').innerHTML = `
        <h3>${currentBook.story.title}</h3>
        <p><strong>👤 Autor:</strong> ${currentBook.formData.authorName}</p>
        <p><strong>📄 Páginas:</strong> ${currentBook.formData.numPages}</p>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        const time = new Date().toLocaleTimeString();
        debugLog.innerHTML += `<div>[${time}] ${message}</div>`;
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

function downloadBook() {
    if (!currentBook) return;
    const filename = currentBook.story.title.replace(/[^a-z0-9]/gi, '_') + '.pdf';
    currentBook.pdf.save(filename);
}

function shareWhatsApp() {
    const text = `Livro: "${currentBook.story.title}"`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareTwitter() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(currentBook.story.title)}`, '_blank');
}

function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showHelp() {
    alert('Configure chaves API → Preencha formulário → Aguarde → Baixe PDF!');
}

function resetApp() {
    if (confirm('Apagar chaves?')) {
        localStorage.clear();
        location.reload();
    }
}

// ============================================
// DARK MODE
// ============================================

let darkMode = localStorage.getItem('darkMode') === 'true';

function initDarkMode() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'darkModeToggle';
    toggleBtn.className = 'dark-mode-toggle';
    toggleBtn.innerHTML = darkMode ? '☀️' : '🌙';
    document.body.appendChild(toggleBtn);

    if (darkMode) {
        document.body.classList.add('dark-mode');
    }

    toggleBtn.addEventListener('click', toggleDarkMode);
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode');

    const btn = document.getElementById('darkModeToggle');
    btn.innerHTML = darkMode ? '☀️' : '🌙';

    localStorage.setItem('darkMode', darkMode);
}

console.log('✨ Gerador de Livros carregado!');

