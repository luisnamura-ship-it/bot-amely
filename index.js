// ==============================================================
//  BOT WHATSAPP + CLAUDE  —  Seu "Colega Virtual" no Grupo
//  Autor: configurado para Namura / Turma ITA
// ==============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Anthropic = require('@anthropic-ai/sdk');

// ──────────────────────────────────────────────────────────────
// ⚙️  CONFIGURAÇÕES  (só mexa aqui)
// ──────────────────────────────────────────────────────────────

const NOME_DO_BOT     = 'Amely';
const ANTHROPIC_KEY   = process.env.ANTHROPIC_KEY || 'SUA_CHAVE_AQUI';
const PERSONALIDADE   = `
Você é um assistente inteligente e simpático dentro de um grupo de WhatsApp.
Responda de forma clara, direta e amigável.
Quando a pergunta for técnica, use analogias simples.
Mantenha respostas em no máximo 3 parágrafos para não sobrecarregar o grupo.
`;

// ──────────────────────────────────────────────────────────────
// 🚀  INICIALIZAÇÃO
// ──────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// ──────────────────────────────────────────────────────────────
// 📡  EVENTOS DE CONEXÃO
// ──────────────────────────────────────────────────────────────

// Exibe QR Code no terminal para escanear
client.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp do bot:\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log(`\n✅ ${NOME_DO_BOT} está online e pronto para responder!\n`);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Falha na autenticação:', msg);
});

client.on('disconnected', (reason) => {
    console.log('🔌 Bot desconectado:', reason);
});

// ──────────────────────────────────────────────────────────────
// 💬  PROCESSAMENTO DE MENSAGENS
// ──────────────────────────────────────────────────────────────

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        const texto = msg.body.trim();

        // Só responde se mencionar o nome do bot ou for mensagem direta
        const mencionado = texto.toLowerCase().includes(NOME_DO_BOT.toLowerCase());
        const isDireto   = !chat.isGroup;

        if (!mencionado && !isDireto) return;
        if (msg.fromMe) return;

        console.log(`📩 Mensagem recebida: ${texto}`);

        // Remove o nome do bot da mensagem antes de enviar para Claude
        const pergunta = texto.replace(new RegExp(NOME_DO_BOT, 'gi'), '').trim();

        const resposta = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: PERSONALIDADE,
            messages: [{ role: 'user', content: pergunta }]
        });

        const textoResposta = resposta.content[0].text;
        await msg.reply(textoResposta);
        console.log(`✅ Respondido: ${textoResposta.substring(0, 50)}...`);

    } catch (erro) {
        console.error('❌ Erro ao processar mensagem:', erro);
    }
});

// ──────────────────────────────────────────────────────────────
// ▶️  INICIAR
// ──────────────────────────────────────────────────────────────

client.initialize();
