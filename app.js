async function callGeminiAPI(formData) {
    logDebug('Chamando Gemini API v1');

    const prompt = `Crie uma historia infantil.

Tema: ${formData.theme}
Idade: ${formData.age} anos
Tom: ${formData.tone}
Paginas: ${formData.numPages}

Retorne APENAS JSON valido no formato:
{"title":"Titulo","pages":[{"pageNumber":1,"text":"Texto da pagina","needsIllustration":true,"illustrationPrompt":"descricao em ingles"}],"mainCharacters":[{"name":"Nome","visualReference":"descricao"}],"colorPalette":["#hex"],"mood":"alegre","setting":"cenario"}`;

    // USANDO v1 (estável) ao invés de v1beta
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${CONFIG.geminiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ 
                parts: [{ text: prompt }] 
            }],
            generationConfig: { 
                temperature: 0.9, 
                maxOutputTokens: 8000 
            }
        })
    });

    logDebug('Status: ' + response.status);

    if (!response.ok) {
        const err = await response.text();
        logDebug('Erro completo: ' + err);
        throw new Error('Gemini API erro ' + response.status);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]) {
        logDebug('Resposta invalida: ' + JSON.stringify(data));
        throw new Error('Resposta invalida do Gemini');
    }

    const text = data.candidates[0].content.parts[0].text;
    logDebug('Texto recebido: ' + text.substring(0, 150));

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        logDebug('Texto completo: ' + text);
        throw new Error('JSON nao encontrado na resposta');
    }

    return JSON.parse(jsonMatch[0]);
}
