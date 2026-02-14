// ============================================
// GERADOR DE LIVROS INFANTIS COM IA
// Versão de Teste - 100% Funcional
// ============================================

// Configuração Global
let CONFIG = {
    anthropicKey: localStorage.getItem('anthropicKey') || '',
    replicateKey: localStorage.getItem('replicateKey') || ''
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

    // Verificar se já tem chaves e mostrar formulário
    if (CONFIG.anthropicKey && CONFIG.replicateKey) {
        showFormCard();
    }

    // Event Listeners
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

    pagesSlider.addEventListener('input', function() {
        const pages = parseInt(this.value);
        pagesDisplay.textContent = pages;

        // Atualizar estimativa de tempo
        const estimatedMinutes = Math.ceil(pages * 0.6);
        timeEstimate.textContent = `${estimatedMinutes}-${estimatedMinutes + 1} minutos`;
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

    // Validação
    if (!anthropicKey || !replicateKey) {
        showAlert('apiError', '⚠️ Por favor, preencha ambas as chaves API!');
        return;
    }

    // Validar formato básico
    if (!anthropicKey.startsWith('sk-ant-')) {
        showAlert('apiError', '❌ Chave Anthropic inválida! Deve começar com "sk-ant-"');
        return;
    }

    if (!replicateKey.startsWith('r8_')) {
        showAlert('apiError', '❌ Token Replicate inválido! Deve começar com "r8_"');
        return;
    }

    // Salvar
    CONFIG.anthropicKey = anthropicKey;
    CONFIG.replicateKey = replicateKey;

    localStorage.setItem('anthropicKey', anthropicKey);
    localStorage.setItem('replicateKey', replicateKey);

    // Feedback
    showAlert('apiSuccess', '✅ Chaves salvas com sucesso! Agora você pode criar livros.');

    // Mostrar formulário após 1.5s
    setTimeout(() => {
        showFormCard();
    }, 1500);
}

function showFormCard() {
    document.getElementById('apiSection').style.display = 'none';
    document.getElementById('formCard').style.display = 'block';
}

// ============================================
// GERAÇÃO DO LIVRO - FLUXO PRINCIPAL
// ============================================

async function handleFormSubmit(e) {
    e.preventDefault();

    // Verificar chaves
    if (!CONFIG.anthropicKey || !CONFIG.replicateKey) {
        showAlert('formError', '⚠️ Configure as chaves API primeiro!');
        return;
    }

    // Coletar dados do formulário
    const formData = {
        theme: document.getElementById('theme').value.trim(),
        age: parseInt(document.getElementById('age').value),
        tone: document.getElementById('tone').value,
        numPages: parseInt(document.getElementById('numPages').value),
        authorName: document.getElementById('authorName').value.trim()
    };

    // Validação
    if (!formData.theme || formData.theme.length < 10) {
        showAlert('formError', '⚠️ Por favor, descreva melhor o tema da história!');
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
        // Mostrar progresso
        showProgressCard();

        // ETAPA 1: Gerar História (0-30%)
        updateProgress(5, 'Preparando a criação...', '🎨', 1);
        await sleep(500);

        updateProgress(10, 'Gerando história com IA...', '✍️', 1);
        const story = await generateStory(formData);

        updateProgress(30, 'História criada com sucesso!', '✅', 1, true);
        await sleep(800);

        // ETAPA 2: Gerar Capa (30-50%)
        updateProgress(35, 'Criando capa mágica...', '🎨', 2);
        const coverImage = await generateCoverImage(story, formData);

        updateProgress(50, 'Capa pronta!', '✅', 2, true);
        await sleep(800);

        // ETAPA 3: Gerar Ilustrações (50-80%)
        updateProgress(55, 'Iniciando ilustrações...', '🖼️', 3);
        const illustrations = [];

        const illustrationPages = story.pages.filter(p => p.needsIllustration);
        const totalIllustrations = illustrationPages.length;

        for (let i = 0; i < totalIllustrations; i++) {
            const page = illustrationPages[i];
            const progress = 55 + Math.floor((i / totalIllustrations) * 25);

            updateProgress(
                progress, 
                `Ilustrando página ${page.pageNumber}/${story.pages.length}...`, 
                '🎨', 
                3
            );

            const img = await generateIllustration(page.illustrationPrompt, formData);
            illustrations.push({
                pageNumber: page.pageNumber,
                image: img
            });
        }

        updateProgress(80, 'Todas as ilustrações prontas!', '✅', 3, true);
        await sleep(800);

        // ETAPA 4: Gerar PDF (80-100%)
        updateProgress(85, 'Montando o livro em PDF...', '📄', 4);
        const pdf = await generatePDF(story, coverImage, illustrations, formData);

        updateProgress(95, 'PDF quase pronto...', '📚', 4);
        await sleep(500);

        updateProgress(100, 'Livro completo!', '🎉', 4, true);
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

        let errorMessage = 'Erro ao gerar livro. ';

        if (error.message.includes('API')) {
            errorMessage += 'Verifique se suas chaves API estão corretas e têm créditos.';
        } else if (error.message.includes('rede') || error.message.includes('network')) {
            errorMessage += 'Problema de conexão. Verifique sua internet.';
        } else {
            errorMessage += error.message;
        }

        alert('❌ ' + errorMessage);

        // Voltar ao formulário
        hideProgressCard();
    }
}

// ============================================
// GERAÇÃO DE HISTÓRIA (Claude API)
// ============================================

async function generateStory(formData) {
    const prompt = buildStoryPrompt(formData);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': CONFIG.anthropicKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            temperature: 0.9,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Erro na API Claude: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const storyText = data.content[0].text;

    // Extrair JSON da resposta
    const jsonMatch = storyText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Formato de resposta inválido da IA');
    }

    return JSON.parse(jsonMatch[0]);
}

function buildStoryPrompt(formData) {
    const ageGuidelines = {
        2: 'Vocabulário muito simples, frases curtas (5-8 palavras), conceitos básicos (cores, animais, família)',
        4: 'Vocabulário simples, frases curtas a médias (8-12 palavras), conceitos cotidianos',
        6: 'Vocabulário intermediário, frases médias (10-15 palavras), conceitos mais abstratos',
        8: 'Vocabulário avançado, frases completas (12-20 palavras), temas mais complexos'
    };

    return `Você é um renomado escritor de livros infantis, especializado em criar histórias emocionantes e educativas.

TAREFA: Criar uma história COMPLETA e MÁGICA sobre: "${formData.theme}"

PARÂMETROS OBRIGATÓRIOS:
- Idade da criança: ${formData.age} anos
- Tom da história: ${formData.tone}
- Número exato de páginas: ${formData.numPages}
- Diretrizes de linguagem: ${ageGuidelines[formData.age]}

REQUISITOS DE QUALIDADE:
1. História coesa com início, meio e fim
2. Personagens cativantes e memoráveis
3. Linguagem apropriada e envolvente
4. Mensagem positiva e educativa
5. Ritmo adequado para a idade
6. Elementos visuais ricos para ilustração

ESTRUTURA JSON OBRIGATÓRIA:
{
  "title": "Título Cativante (máx 60 caracteres)",
  "subtitle": "Subtítulo opcional curto",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Texto narrativo da página (máx ${getMaxWordsPerPage(formData.age)} palavras)",
      "needsIllustration": true,
      "illustrationPrompt": "Descrição DETALHADA para ilustração: personagens, cenário, ação, cores, mood, estilo 'children's book illustration'"
    }
  ],
  "mainCharacters": [
    {
      "name": "Nome do personagem",
      "description": "Descrição física e personalidade",
      "visualReference": "Referência visual detalhada para manter consistência"
    }
  ],
  "colorPalette": ["#hexColor1", "#hexColor2", "#hexColor3"],
  "mood": "alegre/aventureiro/calmo/misterioso",
  "setting": "Descrição do cenário principal"
}

INSTRUÇÕES ESPECIAIS:
- Páginas ímpares (1, 3, 5...): needsIllustration = true (terão imagem full-page)
- Páginas pares (2, 4, 6...): needsIllustration = false (texto com decoração)
- Cada illustrationPrompt deve ser MUITO detalhado para IA de imagens
- Manter consistência visual dos personagens em todas as descrições
- Tom ${formData.tone} deve permear toda a narrativa

EXEMPLO de illustrationPrompt bom:
"Children's book illustration: A friendly green dragon with purple wings sitting in a colorful recycling center, surrounded by happy children of diverse ethnicities sorting plastic bottles and paper. Bright daylight, cheerful atmosphere, vibrant colors (green, purple, blue, yellow), cartoon style suitable for 6-year-olds, professional children's book quality"

Retorne APENAS o JSON válido, sem texto adicional.`;
}

function getMaxWordsPerPage(age) {
    const limits = {
        2: 15,
        4: 30,
        6: 50,
        8: 80
    };
    return limits[age] || 50;
}

// ============================================
// GERAÇÃO DE IMAGENS (Replicate API)
// ============================================

async function generateCoverImage(story, formData) {
    const coverPrompt = `Professional children's book cover illustration:

Title: "${story.title}"
Main characters: ${story.mainCharacters.map(c => c.visualReference).join(', ')}
Setting: ${story.setting}
Mood: ${story.mood}, magical, inviting
Color palette: ${story.colorPalette.join(', ')}
Age: ${formData.age} years old

Style: Award-winning children's book cover, vibrant colors, professional illustration, high quality, engaging composition, perfect for bookstore display
Important: NO TEXT in the image, only illustration

Format: Vertical book cover, colorful, eye-catching, commercial children's book standard`;

    return await generateImage(coverPrompt);
}

async function generateIllustration(illustrationPrompt, formData) {
    const enhancedPrompt = `${illustrationPrompt}

Professional children's book illustration style
Age-appropriate: ${formData.age} years old
High quality, detailed, colorful, warm and engaging
Perfect for children's storybook
NO TEXT in image`;

    return await generateImage(enhancedPrompt);
}

async function generateImage(prompt) {
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
        const error = await startResponse.json();
        throw new Error(`Erro ao iniciar geração de imagem: ${error.detail || startResponse.statusText}`);
    }

    const prediction = await startResponse.json();

    // Aguardar conclusão (polling)
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutos máximo

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
        await sleep(1000); // Aguardar 1 segundo

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
    }

    if (result.status === 'failed') {
        throw new Error('Falha ao gerar imagem');
    }

    if (attempts >= maxAttempts) {
        throw new Error('Timeout ao gerar imagem');
    }

    // Converter URL para Base64
    const imageUrl = result.output[0];
    return await urlToBase64(imageUrl);
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
// GERAÇÃO DE PDF (jsPDF)
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

    // ====== PÁGINA 1: CAPA ======
    pdf.addImage(coverImage, 'PNG', 0, 0, pageWidth, pageHeight);

    // Overlay escuro para texto
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new pdf.GState({opacity: 0.5}));
    pdf.rect(0, pageHeight - 90, pageWidth, 90, 'F');
    pdf.setGState(new pdf.GState({opacity: 1}));

    // Título
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

    // Autor
    pdf.setFontSize(20);
    pdf.text(`Por ${formData.authorName}`, pageWidth / 2, pageHeight - 25, { align: 'center' });

    // ====== PÁGINA 2: CRÉDITOS ======
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
    const date = new Date().toLocaleDateString('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    pdf.text(`Criado em ${date}`, pageWidth / 2, 145, { align: 'center' });

    // Coração
    pdf.setFontSize(48);
    pdf.setTextColor(255, 100, 150);
    pdf.text('♥', pageWidth / 2, 180, { align: 'center' });

    // ====== PÁGINAS DA HISTÓRIA ======
    story.pages.forEach((page, index) => {
        pdf.addPage();

        if (page.needsIllustration && illustrationMap[page.pageNumber]) {
            // Página de ilustração (full page)
            pdf.addImage(
                illustrationMap[page.pageNumber], 
                'PNG', 
                0, 0, 
                pageWidth, pageHeight
            );

            // Número da página com círculo
            pdf.setFillColor(102, 126, 234);
            pdf.circle(pageWidth - 25, pageHeight - 25, 10, 'F');

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.setFont(undefined, 'bold');
            const pageNumText = String(page.pageNumber);
            const numWidth = pdf.getTextWidth(pageNumText);
            pdf.text(pageNumText, pageWidth - 25 - (numWidth / 2), pageHeight - 22);

        } else {
            // Página de texto
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            // Borda decorativa
            pdf.setDrawColor(102, 126, 234);
            pdf.setLineWidth(2);
            pdf.roundedRect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, 8, 8, 'S');

            // Pequena decoração (flores nos cantos)
            pdf.setFontSize(24);
            pdf.setTextColor(102, 126, 234);
            pdf.text('✿', margin + 5, margin + 10);
            pdf.text('✿', pageWidth - margin - 10, margin + 10);
            pdf.text('✿', margin + 5, pageHeight - margin - 5);
            pdf.text('✿', pageWidth - margin - 10, pageHeight - margin - 5);

            // Texto da página
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

            // Número da página
            pdf.setFontSize(12);
            pdf.setTextColor(150, 150, 150);
            pdf.text(String(page.pageNumber), pageWidth / 2, pageHeight - 12, { align: 'center' });
        }
    });

    // ====== ÚLTIMA PÁGINA: FIM ======
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

    pdf.setFontSize(16);
    pdf.setTextColor(120, 120, 120);
    pdf.setFont(undefined, 'normal');
    pdf.text('Esperamos que você tenha adorado!', pageWidth / 2, pageHeight / 2 + 40, { align: 'center' });

    return pdf;
}

function getFontSizeForAge(age) {
    if (age <= 2) return 22;
    if (age <= 4) return 20;
    if (age <= 6) return 18;
    return 16;
}

// ============================================
// INTERFACE - PROGRESSO E NAVEGAÇÃO
// ============================================

function updateProgress(percent, message, icon, step, completed = false) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon = document.getElementById('statusIcon');

    progressFill.style.width = percent + '%';
    progressPercent.textContent = Math.round(percent) + '%';
    statusMessage.textContent = message;
    statusIcon.textContent = icon;

    // Atualizar steps
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

    // Scroll to top
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

    // Preencher informações
    const bookCover = document.getElementById('bookCover');
    bookCover.src = currentBook.coverImage;

    const bookInfo = document.getElementById('bookInfo');
    bookInfo.innerHTML = `
        <h3>${currentBook.story.title}</h3>
        ${currentBook.story.subtitle ? `<p><em>${currentBook.story.subtitle}</em></p>` : ''}
        <p><strong>👤 Autor:</strong> ${currentBook.formData.authorName}</p>
        <p><strong>📄 Páginas:</strong> ${currentBook.formData.numPages}</p>
        <p><strong>👶 Idade recomendada:</strong> ${currentBook.formData.age} anos</p>
        <p><strong>🎨 Tom:</strong> ${currentBook.formData.tone}</p>
        <p><strong>🌟 Personagens:</strong> ${currentBook.story.mainCharacters.map(c => c.name).join(', ')}</p>
        <p><strong>🎭 Cenário:</strong> ${currentBook.story.setting}</p>
    `;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAlert(elementId, message) {
    const alert = document.getElementById(elementId);
    alert.textContent = message;
    alert.style.display = 'block';

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// ============================================
// DOWNLOAD E COMPARTILHAMENTO
// ============================================

function downloadBook() {
    if (!currentBook) return;

    const filename = sanitizeFilename(currentBook.story.title) + '.pdf';
    currentBook.pdf.save(filename);

    // Feedback visual
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
    const text = `Acabei de criar um livro infantil personalizado incrível usando IA! 📚✨\n\nTítulo: "${currentBook.story.title}"\n\nExperimente você também!`;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}%20${url}`, '_blank');
}

function shareTwitter() {
    const text = `Acabei de criar um livro infantil personalizado com IA! 📚✨ "${currentBook.story.title}"`;
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`, '_blank');
}

function shareFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

// ============================================
// UTILITÁRIOS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showHelp() {
    alert(`📚 AJUDA - Gerador de Livros Infantis

1️⃣ Configure suas chaves API (grátis):
   - Anthropic (Claude): console.anthropic.com
   - Replicate: replicate.com

2️⃣ Preencha o formulário com:
   - Tema detalhado da história
   - Idade da criança
   - Tom desejado
   - Número de páginas

3️⃣ Clique em "Gerar Livro" e aguarde 3-5 minutos

4️⃣ Baixe seu PDF profissional!

💰 CUSTOS:
- ~R$ 0,75 por livro
- Cobrado das suas APIs
- Você tem créditos grátis iniciais

❓ PROBLEMAS?
- Verifique se as chaves estão corretas
- Confirme que tem créditos nas APIs
- Tente com menos páginas primeiro

Divirta-se criando histórias mágicas! ✨`);
}

function resetApp() {
    if (confirm('⚠️ Isso vai apagar suas chaves salvas e reiniciar o aplicativo. Continuar?')) {
        localStorage.clear();
        location.reload();
    }
}

// ============================================
// TRATAMENTO DE ERROS GLOBAL
// ============================================

window.addEventListener('error', (event) => {
    console.error('Erro global:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rejeitada:', event.reason);
});

console.log('✨ Gerador de Livros Infantis carregado com sucesso!');
