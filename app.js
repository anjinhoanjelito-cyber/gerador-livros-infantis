let CONFIG = {
    geminiKey: localStorage.getItem('geminiKey') || '',
    replicateKey: localStorage.getItem('replicateKey') || '',
    // Se o worker der problema, podemos tentar usar proxy direto ou chamar API direta se permitido (CORS)
    workerUrl: 'https://livros-infantis-api.anjinhoanjelito.workers.dev'
};

let currentBook = null;

// Configuração do Modelo - Mude aqui se der erro 404 novamente
// Opções que você pode tentar:
// "gemini-1.5-flash-latest" (Recomendado)
// "gemini-1.5-flash-001" (Versão específica estável)
// "gemini-pro" (Versão 1.0 - Fallback se tudo falhar, mas é menos criativo)
const GEMINI_MODEL = "gemini-1.5-flash-latest";

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
    const existingBtn = document.getElementById('reset-keys-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'reset-keys-btn';
    btn.textContent = '⚙️ Trocar Chaves';
    btn.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;background:#dc3545;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;z-index:9999;box-shadow:0 4px 15px rgba(220,53,69,0.4)';
    btn.onclick = () => {
        if (confirm('Deseja apagar as chaves salvas e reiniciar?')) {
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
    if (slider) {
        slider.oninput = function() {
            const pages = parseInt(this.value);
            document.getElementById('pagesDisplay').textContent = pages;
            const mins = Math.ceil(pages * 0.5);
            document.getElementById('timeEstimate').textContent = `${mins}-${mins + 2} minutos`;
            const cost = (0.05 + (Math.floor(pages / 2) * 0.04)).toFixed(2);
            document.getElementById('costEstimate').textContent = `~R$ ${cost}`;
        };
    }

    const form = document.getElementById('bookForm');
    if (form) form.onsubmit = handleFormSubmit;

    const dlBtn = document.getElementById('downloadBtn');
    if (dlBtn) dlBtn.onclick = downloadBook;
    
    const saveKeysBtn = document.querySelector('button[onclick="saveApiKeys()"]');
    if(saveKeysBtn) saveKeysBtn.onclick = saveApiKeys; 
}

function saveApiKeys() {
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const replicateKey = document.getElementById('replicateKey').value.trim();

    if (!geminiKey || !replicateKey) {
        showAlert('apiError', 'Preencha ambas as chaves (Gemini e Replicate)');
        return;
    }

    if (!geminiKey.startsWith('AIza')) {
        showAlert('apiError', 'Chave Gemini parece inválida (deve começar com AIza)');
        return;
    }

    if (!replicateKey.startsWith('r8_')) {
        showAlert('apiError', 'Token Replicate parece inválido (deve começar com r8_)');
        return;
    }

    CONFIG.geminiKey = geminiKey;
    CONFIG.replicateKey = replicateKey;

    localStorage.setItem('geminiKey', geminiKey);
    localStorage.setItem('replicateKey', replicateKey);

    showAlert('apiSuccess', 'Chaves salvas com sucesso!');
    setTimeout(() => showFormCard(), 1500);
}

function showFormCard() {
    const apiSection = document.getElementById('apiSection');
    const formCard = document.getElementById('formCard');
    
    if(apiSection) apiSection.style.display = 'none';
    if(formCard) formCard.style.display = 'block';
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

    if (!formData.theme || formData.theme.length < 5) {
        showAlert('formError', 'Por favor, descreva melhor o tema da história.');
        return;
    }

    await generateBook(formData);
}

async function generateBook(formData) {
    try {
        showProgressCard();
        logDebug('Iniciando geração do livro...');

        updateProgress(10, 'Escrevendo a história com IA...', 1);
        
        const story = await callGeminiAPI(formData);
        
        if (!story || !story.pages) {
            throw new Error('A história gerada está incompleta. Tente novamente.');
        }
        
        logDebug('História criada: ' + story.title);

        updateProgress(30, 'História criada!', 1, true);
        await sleep(800);

        updateProgress(35, 'Gerando a capa mágica...', 2);
        const coverImage = await generateCoverImage(story);

        updateProgress(50, 'Capa pronta!', 2, true);

        const illustrations = [];
        const pages = story.pages.filter(p => p.needsIllustration);
        
        const maxPagesToIllustrate = Math.min(pages.length, 12); 

        for (let i = 0; i < maxPagesToIllustrate; i++) {
            const page = pages[i];
            updateProgress(55 + Math.floor((i / maxPagesToIllustrate) * 25), `Ilustrando página ${i + 1}/${maxPagesToIllustrate}...`, 3);
            
            try {
                const img = await generateImage(page.illustrationPrompt);
                illustrations.push({ pageNumber: page.pageNumber, image: img });
            } catch (imgErr) {
                console.error(`Erro na pag ${i+1}`, imgErr);
                logDebug(`Falha img pag ${i+1}, usando placeholder.`);
            }
        }

        updateProgress(80, 'Ilustrações finalizadas', 3, true);
        updateProgress(85, 'Montando seu livro em PDF...', 4);

        const pdf = await generatePDF(story, coverImage, illustrations, formData);

        updateProgress(100, 'Livro completo!', 4, true);

        currentBook = { story, coverImage, illustrations, pdf, formData };
        showPreviewCard();

    } catch (error) {
        console.error(error);
        logDebug('ERRO CRÍTICO: ' + error.message);
        alert('Ocorreu um erro: ' + error.message);
        hideProgressCard();
    }
}

async function callGeminiAPI(formData) {
    logDebug(`Conectando ao modelo: ${GEMINI_MODEL}...`);

    const prompt = `Você é um autor de livros infantis premiado. Crie uma história baseada nestes parâmetros:

Tema: ${formData.theme}
Idade Alvo: ${formData.age} anos
Tom da história: ${formData.tone}
Número aproximado de páginas: ${formData.numPages}

IMPORTANTE: Responda APENAS com um objeto JSON válido seguindo exatamente esta estrutura:

{
  "title": "Título Criativo da História",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto da página 1...",
      "needsIllustration": true,
      "illustrationPrompt": "Descrição detalhada da cena para um gerador de imagem, estilo infantil, em INGLÊS"
    }
  ],
  "mainCharacters": [
    {"name": "Nome", "visualReference": "Descrição visual curta"}
  ],
  "colorPalette": ["#hex1", "#hex2"],
  "mood": "alegre/misterioso/etc",
  "setting": "descrição do cenário"
}`;

    // --- CORREÇÃO AQUI: Usando o modelo definido no topo do arquivo ---
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${CONFIG.geminiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    temperature: 0.7,
                    maxOutputTokens: 8000,
                    // Removemos o responseMimeType caso o modelo mude para gemini-pro (que não suporta esse campo)
                    // Mas para 1.5 Flash ele ajuda muito. Vamos manter condicionalmente ou usar try/catch no parse.
                    responseMimeType: "application/json" 
                }
            })
        });

        logDebug(`Status Gemini (${GEMINI_MODEL}): ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.json();
            const errorMessage = errorBody.error?.message || 'Erro desconhecido na API Gemini';
            
            // Log detalhado para debug
            console.error("Erro detalhado API Gemini:", errorBody);
            
            logDebug('Erro API: ' + errorMessage);
            throw new Error(`Gemini recusou (${GEMINI_MODEL}): ${errorMessage}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('O Gemini não retornou nenhum conteúdo válido.');
        }

        const text = data.candidates[0].content.parts[0].text;
        
        try {
            return JSON.parse(text);
        } catch (e) {
            logDebug('JSON direto falhou, tentando limpeza manual...');
            // Fallback robusto para limpar markdown ```json
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }

    } catch (error) {
        logDebug('Falha no Gemini: ' + error.message);
        throw error;
    }
}

async function generateCoverImage(story) {
    const stylePrompt = "children's book illustration style, high quality, vibrant colors, detailed, 8k resolution";
    const prompt = `Cover for children's book titled "${story.title}". Visual: ${story.setting}. No text, no words, no letters. ${stylePrompt}`;
    return await generateImage(prompt);
}

async function generateImage(prompt) {
    logDebug('Solicitando imagem ao Replicate...');
    const safePrompt = `${prompt}, no text, no watermark, masterpiece`;

    const startResp = await fetch(`${CONFIG.workerUrl}/replicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: CONFIG.replicateKey,
            payload: {
                version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
                input: { 
                    prompt: safePrompt, 
                    go_fast: true, 
                    num_outputs: 1, 
                    aspect_ratio: "3:4", 
                    output_format: "png"
                }
            }
        })
    });

    if (!startResp.ok) {
        const errText = await startResp.text();
        throw new Error(`Erro Replicate Start: ${startResp.status} - ${errText}`);
    }

    let result = await startResp.json();
    let attempts = 0;
    const maxAttempts = 40;

    while (result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled' && attempts < maxAttempts) {
        await sleep(3000);
        attempts++;
        
        const statusResp = await fetch(`${CONFIG.workerUrl}/replicate/status/${result.id}`, {
            headers: { 'Authorization': `Token ${CONFIG.replicateKey}` }
        });
        
        if (statusResp.ok) {
            result = await statusResp.json();
        }
    }

    if (result.status === 'failed' || result.status === 'canceled') {
        throw new Error('Geração de imagem falhou no Replicate.');
    }
    
    if (attempts >= maxAttempts) {
        throw new Error('Tempo limite excedido gerando imagem.');
    }

    if (!result.output || !result.output[0]) {
        throw new Error('Replicate finalizou mas não devolveu URL da imagem.');
    }

    const imgUrl = result.output[0];
    try {
        const resp = await fetch(imgUrl);
        const blob = await resp.blob();

        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        throw new Error('Erro ao baixar imagem final: ' + e.message);
    }
}

async function generatePDF(story, coverImage, illustrations, formData) {
    if (!window.jspdf) {
        throw new Error('Biblioteca jsPDF não carregada.');
    }
    const { jsPDF } = window.jspdf;
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;

    let illustrationMap = {};
    illustrations.forEach(ill => illustrationMap[ill.pageNumber] = ill.image);

    // --- CAPA ---
    if (coverImage) {
        try {
            pdf.addImage(coverImage, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch (e) {
            console.error('Erro ao adicionar capa', e);
        }
    }
    
    pdf.setFillColor(255, 255, 255);
    pdf.setGState(new pdf.GState({ opacity: 0.8 }));
    pdf.rect(0, 200, pageWidth, 50, 'F');
    pdf.setGState(new pdf.GState({ opacity: 1.0 }));
    
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.setTextColor(0, 0, 0);
    pdf.text(story.title, pageWidth / 2, 220, { align: 'center', maxWidth: pageWidth - 40 });
    
    pdf.setFontSize(14);
    pdf.text(`Autor: ${formData.authorName}`, pageWidth / 2, 240, { align: 'center' });

    // --- PÁGINAS ---
    story.pages.forEach((page, index) => {
        pdf.addPage();
        
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text(`${index + 1}`, pageWidth - 10, pageHeight - 10);

        if (illustrationMap[page.pageNumber]) {
            try {
                const imgHeight = 150;
                pdf.addImage(illustrationMap[page.pageNumber], 'PNG', margin, margin, pageWidth - (margin*2), imgHeight);
                
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(14);
                pdf.setTextColor(0);
                pdf.text(page.text, pageWidth / 2, margin + imgHeight + 20, { align: 'center', maxWidth: pageWidth - (margin*2) });
            } catch (e) {
                console.error('Erro img pag ' + page.pageNumber, e);
            }
        } else {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(16);
            pdf.setTextColor(0);
            pdf.text(page.text, pageWidth / 2, pageHeight / 2, { align: 'center', maxWidth: pageWidth - (margin*2) });
        }
    });

    return pdf;
}

function updateProgress(percent, message, step, completed = false) {
    const fill = document.getElementById('progressFill');
    const perText = document.getElementById('progressPercent');
    const msgText = document.getElementById('statusMessage');

    if (fill) fill.style.width = percent + '%';
    if (perText) perText.textContent = percent + '%';
    if (msgText) msgText.textContent = message;

    if (step) {
        const el = document.getElementById(`step${step}`);
        if (el) {
            if (completed) {
                el.classList.add('completed');
                el.classList.remove('active');
            } else {
                el.classList.add('active');
            }
        }
    }
}

function showProgressCard() {
    const formCard = document.getElementById('formCard');
    const progCard = document.getElementById('progressCard');
    if(formCard) formCard.style.display = 'none';
    if(progCard) progCard.style.display = 'block';
}

function hideProgressCard() {
    const formCard = document.getElementById('formCard');
    const progCard = document.getElementById('progressCard');
    if(formCard) formCard.style.display = 'block';
    if(progCard) progCard.style.display = 'none';
}

function showPreviewCard() {
    document.getElementById('progressCard').style.display = 'none';
    const previewCard = document.getElementById('previewCard');
    if(previewCard) previewCard.style.display = 'block';
    
    const coverEl = document.getElementById('bookCover');
    if(coverEl && currentBook) coverEl.src = currentBook.coverImage;
    
    const infoEl = document.getElementById('bookInfo');
    if(infoEl && currentBook) {
        infoEl.innerHTML = `
            <h3>${currentBook.story.title}</h3>
            <p><strong>Autor:</strong> ${currentBook.formData.authorName}</p>
            <p><strong>Páginas:</strong> ${currentBook.story.pages.length}</p>
            <p style="margin-top:10px; font-size: 0.9em; color: #666">Tema: ${currentBook.formData.theme}</p>
        `;
    }
}

function showAlert(elementId, message) {
    const alertEl = document.getElementById(elementId);
    if (alertEl) {
        alertEl.textContent = message;
        alertEl.style.display = 'block';
        setTimeout(() => alertEl.style.display = 'none', 5000);
    } else {
        alert(message);
    }
}

function logDebug(message) {
    console.log(message);
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
        const time = new Date().toLocaleTimeString();
        debugLog.innerHTML += `<div style="margin-bottom: 4px; border-bottom: 1px solid #eee;">
            <span style="color: #888; font-size: 0.8em">[${time}]</span> ${message}
        </div>`;
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

function downloadBook() {
    if (currentBook && currentBook.pdf) {
        currentBook.pdf.save('meu_livro_magico.pdf');
    } else {
        alert('O livro ainda não está pronto para download.');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let darkMode = localStorage.getItem('darkMode') === 'true';

function initDarkMode() {
    const existing = document.getElementById('dark-mode-toggle');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'dark-mode-toggle';
    btn.innerHTML = darkMode ? '☀️' : '🌙';
    btn.style.cssText = 'position:fixed;bottom:30px;right:30px;width:60px;height:60px;border-radius:50%;border:none;background:white;font-size:1.8rem;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:9999;transition: transform 0.2s';
    
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    
    btn.onclick = () => {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        btn.innerHTML = darkMode ? '☀️' : '🌙';
        localStorage.setItem('darkMode', darkMode);
    };
    document.body.appendChild(btn);
    if (darkMode) document.body.classList.add('dark-mode');
}

console.log('App Gerador de Livros v2.1 (Fix Latest Model) carregado');
