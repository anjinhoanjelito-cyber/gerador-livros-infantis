// ============================================
// GERADOR DE LIVROS INFANTIS COM IA - V2 CORRIGIDA
// ============================================

// Configuração Global
let CONFIG = {
    anthropicKey: localStorage.getItem('anthropicKey') || '',
    replicateKey: localStorage.getItem('replicateKey') || '',
    // Proxy CORS para contornar restrições
    corsProxy: 'https://corsproxy.io/?'
};

let currentBook = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Carregar chaves salvas
    if (CONFIG.anthropicKey) {
        document.getElementById('anthropicKey').value = CONFIG.anthropicKey;
    }
    if (CONFIG.replicateKey) {
        document.getElementById('replicateKey').value = CONFIG.replicateKey;
    }

    // Verificar se já tem chaves
    if (CONFIG.anthropicKey && CONFIG.replicateKey) {
        showFormCard();
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Botões de idade
    document.querySelectorAll('.age-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('age').value = this.dataset.age;
        });
    });

    // Slider de páginas
    const pagesSlider = document.getElementById('numPages');
    const pagesDisplay = document.getElementById('pagesDisplay');
    const timeEstimate = document.getElementById('timeEstimate');
    const costEstimate = document.getElementById('costEstimate');

    pagesSlider.addEventListener('input', function() {
        const pages = parseInt(this.value);
        pagesDisplay.textContent = pages;

        // Atualizar estimativa de tempo
        const estimatedMinutes = Math.ceil(pages * 0.5);
        timeEstimate.textContent = `${estimatedMinutes}-${estimatedMinutes + 2} minutos`;

        // Atualizar custo estimado
        const illustrationCount = Math.floor(pages / 2);
        const estimatedCost = (0.05 + (illustrationCount * 0.04)).toFixed(2);
        costEstimate.textContent = `~R$ ${estimatedCost}`;
    });

    // Submit do formulário
    document.getElementById('bookForm').addEventListener('submit', handleFormSubmit);

    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadBook);
}

// ============================================
// GERENCIAMENTO DE API KEYS
// ============================================

function saveApiKeys() {
    const anthropicKey = document.getElementById('anthropicKey').value.trim();
    const replicateKey = document.getElementById('replicateKey').value.trim();

    if (!anthropicKey || !replicateKey) {
        showAlert('apiError', '⚠️ Por favor, preencha ambas as chaves API!');
        return;
    }

    if (!anthropicKey.startsWith('sk-ant-')) {
        showAlert('apiError', '❌ Chave Anthropic inválida! Deve começar com "sk-ant-"');
        return;
    }

    if (!replicateKey.startsWith('r8_')) {
        showAlert('apiError', '❌ Token Replicate inválido! Deve começar com "r8_"');
        return;
    }

    CONFIG.anthropicKey = anthropicKey;
    CONFIG.replicateKey = replicateKey;

    localStorage.setItem('anthropicKey', anthropicKey);
    localStorage.setItem('replicateKey', replicateKey);

    showAlert('apiSuccess', '✅ Chaves salvas com sucesso! Agora você pode criar livros.');

    setTimeout(() => {
        showFormCard();
    }, 1500);
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

    // Coletar dados do formulário
    const formData = {
        // Personagem
        characterName: document.getElementById('characterName').value.trim(),
        characterGender: document.getElementById('characterGender').value,
        characterAge: document.getElementById('characterAge').value,
        skinTone: document.getElementById('skinTone').value,
        hairType: document.getElementById('hairType').value,
        hairColor: document.getElementById('hairColor').value,
        eyeColor: document.getElementById('eyeColor').value,
        characterClothes: document.getElementById('characterClothes').value.trim(),
        characterTraits: document.getElementById('characterTraits').value.trim(),

        // História
        theme: document.getElementById('theme').value.trim(),
        moralLesson: document.getElementById('moralLesson').value.trim(),
        age: parseInt(document.getElementById('age').value),
        tone: document.getElementById('tone').value,
        numPages: parseInt(document.getElementById('numPages').value),
        authorName: document.getElementById('authorName').value.trim()
    };

    // Validação
    if (!formData.theme || formData.theme.length < 20) {
        showAlert('formError', '⚠️ Por favor, descreva melhor o tema da história (mínimo 20 caracteres)!');
        return;
    }

    if (!formData.authorName || formData.authorName.length < 2) {
        showAlert('formError', '⚠️ Por favor, insira seu nome!');
        return;
    }

    // Iniciar geração
    await generateBook(formData);
}

async function generateBook(formData) {
    try {
        showProgressCard();
        logDebug('🚀 Iniciando geração do livro...');

        // ETAPA 1: Gerar História
        updateProgress(5, 'Preparando a criação...', '🎨', 1);
        logDebug('📝 Enviando requisição para Claude API...');

        await sleep(500);

        updateProgress(10, 'Gerando história com IA...', '✍️', 1);
        const story = await generateStory(formData);
        logDebug(`✅ História criada! Título: "${story.title}"`);

        updateProgress(30, 'História criada com sucesso!', '✅', 1, true);
        await sleep(800);

        // ETAPA 2: Gerar Capa
        updateProgress(35, 'Criando capa mágica...', '🎨', 2);
        logDebug('🎨 Gerando capa...');

        const coverImage = await generateCoverImage(story, formData);
        logDebug('✅ Capa gerada!');

        updateProgress(50, 'Capa pronta!', '✅', 2, true);
        await sleep(800);

        // ETAPA 3: Gerar Ilustrações
        updateProgress(55, 'Iniciando ilustrações...', '🖼️', 3);
        const illustrations = [];

        const illustrationPages = story.pages.filter(p => p.needsIllustration);
        const totalIllustrations = illustrationPages.length;
        logDebug(`🖼️ Gerando ${totalIllustrations} ilustrações...`);

        for (let i = 0; i < totalIllustrations; i++) {
            const page = illustrationPages[i];
            const progress = 55 + Math.floor((i / totalIllustrations) * 25);

            updateProgress(
                progress, 
                `Ilustrando página ${page.pageNumber}/${story.pages.length}...`, 
                '🎨', 
                3
            );

            logDebug(`🎨 Gerando ilustração ${i + 1}/${totalIllustrations}...`);

            const img = await generateIllustration(page.illustrationPrompt, formData);
            illustrations.push({
                pageNumber: page.pageNumber,
                image: img
            });

            logDebug(`✅ Ilustração ${i + 1} concluída!`);
        }

        updateProgress(80, 'Todas as ilustrações prontas!', '✅', 3, true);
        await sleep(800);

        // ETAPA 4: Gerar PDF
        updateProgress(85, 'Montando o livro em PDF...', '📄', 4);
        logDebug('📄 Gerando PDF...');

        const pdf = await generatePDF(story, coverImage, illustrations, formData);

        updateProgress(95, 'PDF quase pronto...', '📚', 4);
        await sleep(500);

        updateProgress(100, 'Livro completo!', '🎉', 4, true);
        logDebug('🎉 Livro concluído com sucesso!');

        await sleep(1000);

        // Salvar e mostrar preview
        currentBook = {
            story,
            coverImage,
            illustrations,
            pdf,
            formData
        };

        showPreviewCard();

    } catch (error) {
        console.error('Erro ao gerar livro:', error);
        logDebug(`❌ ERRO: ${error.message}`);

        let errorMessage = 'Erro ao gerar livro. ';

        if (error.message.includes('401') || error.message.includes('authentication')) {
            errorMessage += 'Chave API inválida ou sem créditos. Verifique suas chaves.';
        } else if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorMessage += 'Limite de requisições atingido. Aguarde alguns minutos.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage += 'Problema de conexão. Verifique sua internet e tente novamente.';
        } else {
            errorMessage += error.message;
        }

        alert('❌ ' + errorMessage);
        hideProgressCard();
    }
}

// ============================================
// GERAÇÃO DE HISTÓRIA (Claude)
// ============================================

async function generateStory(formData) {
    const prompt = buildStoryPrompt(formData);

    logDebug('📤 Enviando prompt para Claude...');

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CONFIG.anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 8000,
                temperature: 0.9,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Claude retornou erro ${response.status}: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        logDebug('📥 Resposta recebida do Claude');

        const storyText = data.content[0].text;

        // Extrair JSON
        const jsonMatch = storyText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Formato de resposta inválido da IA');
        }

        const story = JSON.parse(jsonMatch[0]);
        logDebug(`✅ História parseada: ${story.pages.length} páginas`);

        return story;

    } catch (error) {
        logDebug(`❌ Erro ao chamar Claude: ${error.message}`);
        throw new Error(`Erro ao gerar história: ${error.message}`);
    }
}

function buildStoryPrompt(formData) {
    // Construir descrição do personagem
    let characterDesc = '';

    if (formData.characterName) {
        characterDesc += `Nome: ${formData.characterName}\n`;
    }

    if (formData.characterGender) {
        characterDesc += `Gênero: ${formData.characterGender}\n`;
    }

    if (formData.skinTone) {
        characterDesc += `Aparência: ${formData.skinTone}`;
        if (formData.hairType) characterDesc += `, ${formData.hairType}`;
        if (formData.hairColor) characterDesc += ` ${formData.hairColor}`;
        if (formData.eyeColor) characterDesc += `, ${formData.eyeColor}`;
        characterDesc += `\n`;
    }

    if (formData.characterClothes) {
        characterDesc += `Roupas: ${formData.characterClothes}\n`;
    }

    if (formData.characterTraits) {
        characterDesc += `Características: ${formData.characterTraits}\n`;
    }

    const ageGuidelines = {
        2: 'Vocabulário muito simples, frases curtas (5-8 palavras), conceitos básicos',
        4: 'Vocabulário simples, frases curtas a médias (8-12 palavras)',
        6: 'Vocabulário intermediário, frases médias (10-15 palavras)',
        8: 'Vocabulário avançado, frases completas (12-20 palavras)'
    };

    return `Você é um renomado escritor de livros infantis.

TAREFA: Criar uma história COMPLETA sobre: "${formData.theme}"

${characterDesc ? `PERSONAGEM PRINCIPAL OBRIGATÓRIO:\n${characterDesc}\n` : ''}

PARÂMETROS:
- Idade da criança: ${formData.age} anos
- Tom: ${formData.tone}
- Páginas: ${formData.numPages}
- Linguagem: ${ageGuidelines[formData.age]}
${formData.moralLesson ? `- Mensagem: ${formData.moralLesson}` : ''}

ESTRUTURA JSON:
{
  "title": "Título cativante",
  "subtitle": "Subtítulo opcional",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto (máx ${getMaxWordsPerPage(formData.age)} palavras)",
      "needsIllustration": true,
      "illustrationPrompt": "Descrição DETALHADA para imagem"
    }
  ],
  "mainCharacters": [
    {
      "name": "Nome",
      "description": "Descrição",
      "visualReference": "Referência visual detalhada"
    }
  ],
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "mood": "alegre/aventureiro/calmo",
  "setting": "Descrição do cenário"
}

IMPORTANTE:
- Páginas ímpares: needsIllustration = true
- Páginas pares: needsIllustration = false
- Manter consistência visual do personagem
- illustrationPrompt deve ser em inglês e MUITO detalhado

Retorne APENAS o JSON válido.`;
}

function getMaxWordsPerPage(age) {
    const limits = { 2: 15, 4: 30, 6: 50, 8: 80 };
    return limits[age] || 50;
}

// ============================================
// GERAÇÃO DE IMAGENS (Replicate)
// ============================================

async function generateCoverImage(story, formData) {
    const coverPrompt = `Professional children's book cover illustration:

Title: "${story.title}"
Main characters: ${story.mainCharacters.map(c => c.visualReference).join(', ')}
Setting: ${story.setting}
Mood: ${story.mood}, magical, inviting
Colors: ${story.colorPalette.join(', ')}
Age: ${formData.age} years old

Style: Award-winning children's book cover, vibrant, professional, high quality
NO TEXT in image`;

    return await generateImage(coverPrompt);
}

async function generateIllustration(illustrationPrompt, formData) {
    const enhancedPrompt = `${illustrationPrompt}

Professional children's book illustration
Age-appropriate: ${formData.age} years
High quality, detailed, colorful, warm
NO TEXT`;

    return await generateImage(enhancedPrompt);
}

async function generateImage(prompt) {
    logDebug(`🎨 Iniciando geração de imagem...`);

    try {
        // Iniciar predição
        const startResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${CONFIG.replicateKey}`
            },
            body: JSON.stringify({
                version: "5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637",
                input: {
                    prompt: prompt,
                    go_fast: true,
                    num_outputs: 1,
                    aspect_ratio: "3:4",
                    output_format: "png",
                    output_quality: 90
                }
            })
        });

        if (!startResponse.ok) {
            const errorData = await startResponse.json().catch(() => ({}));
            throw new Error(`Replicate API erro ${startResponse.status}: ${errorData.detail || startResponse.statusText}`);
        }

        const prediction = await startResponse.json();
        logDebug(`⏳ Predição iniciada: ${prediction.id}`);

        // Aguardar conclusão
        let result = prediction;
        let attempts = 0;
        const maxAttempts = 120;

        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
            await sleep(1000);

            const statusResponse = await fetch(
                `https://api.replicate.com/v1/predictions/${result.id}`,
                {
                    headers: {
                        'Authorization': `Token ${CONFIG.replicateKey}`
                    }
                }
            );

            if (!statusResponse.ok) {
                throw new Error('Erro ao verificar status da imagem');
            }

            result = await statusResponse.json();
            attempts++;

            if (attempts % 10 === 0) {
                logDebug(`⏳ Aguardando... (${attempts}s)`);
            }
        }

        if (result.status === 'failed') {
            throw new Error('Falha ao gerar imagem');
        }

        if (attempts >= maxAttempts) {
            throw new Error('Timeout ao gerar imagem');
        }

        logDebug(`✅ Imagem gerada com sucesso!`);

        // Converter para Base64
        const imageUrl = result.output[0];
        return await urlToBase64(imageUrl);

    } catch (error) {
        logDebug(`❌ Erro ao gerar imagem: ${error.message}`);
        throw new Error(`Erro ao gerar imagem: ${error.message}`);
    }
}

async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        throw new Error('Erro ao processar imagem: ' + error.message);
    }
}

// ============================================
// GERAÇÃO DE PDF
// ============================================

async function generatePDF(story, coverImage, illustrations, formData) {
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;

    let illustrationMap = {};
    illustrations.forEach(ill => {
        illustrationMap[ill.pageNumber] = ill.image;
    });

    // CAPA
    pdf.addImage(coverImage, 'PNG', 0, 0, pageWidth, pageHeight);

    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new pdf.GState({opacity: 0.5}));
    pdf.rect(0, pageHeight - 90, pageWidth, 90, 'F');
    pdf.setGState(new pdf.GState({opacity: 1}));

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont(undefined, 'bold');

    const titleLines = pdf.splitTextToSize(story.title, pageWidth - 40);
    let titleY = pageHeight - 70;
    titleLines.forEach(line => {
        const textWidth = pdf.getTextWidth(line);
        pdf.text(line, (pageWidth - textWidth) / 2, titleY);
        titleY += 12;
    });

    pdf.setFontSize(20);
    pdf.text(`Por ${formData.authorName}`, pageWidth / 2, pageHeight - 25, { align: 'center' });

    // CRÉDITOS
    pdf.addPage();
    pdf.setFillColor(252, 252, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setTextColor(100, 100, 100);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'normal');
    pdf.text('Esta história foi criada especialmente', pageWidth / 2, 100, { align: 'center' });

    pdf.setFontSize(24);
    pdf.setTextColor(102, 126, 234);
    pdf.setFont(undefined, 'bold');
    pdf.text(`por ${formData.authorName}`, pageWidth / 2, 125, { align: 'center' });

    pdf.setFontSize(14);
    pdf.setTextColor(120, 120, 120);
    pdf.setFont(undefined, 'normal');
    const date = new Date().toLocaleDateString('pt-BR');
    pdf.text(`Criado em ${date}`, pageWidth / 2, 145, { align: 'center' });

    pdf.setFontSize(48);
    pdf.setTextColor(255, 100, 150);
    pdf.text('♥', pageWidth / 2, 180, { align: 'center' });

    // PÁGINAS
    story.pages.forEach((page) => {
        pdf.addPage();

        if (page.needsIllustration && illustrationMap[page.pageNumber]) {
            pdf.addImage(
                illustrationMap[page.pageNumber], 
                'PNG', 
                0, 0, 
                pageWidth, pageHeight
            );

            pdf.setFillColor(102, 126, 234);
            pdf.circle(pageWidth - 25, pageHeight - 25, 10, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            const pageNumText = String(page.pageNumber);
            const numWidth = pdf.getTextWidth(pageNumText);
            pdf.text(pageNumText, pageWidth - 25 - (numWidth / 2), pageHeight - 22);

        } else {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            pdf.setDrawColor(102, 126, 234);
            pdf.setLineWidth(2);
            pdf.roundedRect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, 8, 8, 'S');

            pdf.setTextColor(40, 40, 40);
            pdf.setFontSize(getFontSizeForAge(formData.age));
            pdf.setFont(undefined, 'normal');

            const textLines = pdf.splitTextToSize(page.text, pageWidth - 2 * margin - 30);
            const lineHeight = pdf.getFontSize() * 0.5;
            const totalTextHeight = textLines.length * lineHeight;
            const textY = (pageHeight - totalTextHeight) / 2;

            textLines.forEach((line, i) => {
                const lineWidth = pdf.getTextWidth(line);
                pdf.text(line, (pageWidth - lineWidth) / 2, textY + (i * lineHeight));
            });

            pdf.setFontSize(12);
            pdf.setTextColor(150, 150, 150);
            pdf.text(String(page.pageNumber), pageWidth / 2, pageHeight - 12, { align: 'center' });
        }
    });

    // FIM
    pdf.addPage();
    pdf.setFillColor(252, 252, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');

    pdf.setFontSize(56);
    pdf.setTextColor(102, 126, 234);
    pdf.setFont(undefined, 'bold');
    pdf.text('Fim', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });

    pdf.setFontSize(28);
    pdf.setTextColor(255, 100, 150);
    pdf.text('♥', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    return pdf;
}

function getFontSizeForAge(age) {
    if (age <= 2) return 22;
    if (age <= 4) return 20;
    if (age <= 6) return 18;
    return 16;
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
        ${currentBook.story.subtitle ? `<p><em>${currentBook.story.subtitle}</em></p>` : ''}
        <p><strong>👤 Autor:</strong> ${currentBook.formData.authorName}</p>
        <p><strong>📄 Páginas:</strong> ${currentBook.formData.numPages}</p>
        <p><strong>👶 Idade:</strong> ${currentBook.formData.age} anos</p>
        <p><strong>🎨 Tom:</strong> ${currentBook.formData.tone}</p>
        <p><strong>🌟 Personagens:</strong> ${currentBook.story.mainCharacters.map(c => c.name).join(', ')}</p>
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

    const filename = sanitizeFilename(currentBook.story.title) + '.pdf';
    currentBook.pdf.save(filename);

    const btn = document.getElementById('downloadBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">✅</span> Download Iniciado!';
    btn.disabled = true;

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }, 3000);
}

function sanitizeFilename(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
}

function shareWhatsApp() {
    const text = `Acabei de criar um livro infantil personalizado com IA! 📚✨\n\nTítulo: "${currentBook.story.title}"`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareTwitter() {
    const text = `Acabei de criar um livro infantil personalizado com IA! "${currentBook.story.title}"`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
}

function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showHelp() {
    alert(`📚 AJUDA

1️⃣ Configure suas chaves API
2️⃣ Preencha o formulário
3️⃣ Aguarde a geração (3-15 min)
4️⃣ Baixe seu PDF!

Custo: ~R$ 0,50-2,00 por livro`);
}

function resetApp() {
    if (confirm('Isso vai apagar suas chaves. Continuar?')) {
        localStorage.clear();
        location.reload();
    }
}

console.log('✨ Gerador de Livros carregado!');
