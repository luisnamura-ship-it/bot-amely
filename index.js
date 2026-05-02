// ============================================================
//  BOT WHATSAPP + CLAUDE  —  Seu "Colega Virtual" no Grupo
//  Autor: configurado para Namura / Turma ITA
// ============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Anthropic = require('@anthropic-ai/sdk');

// ─────────────────────────────────────────────
//  ⚙️  CONFIGURAÇÕES  (só mexa aqui)
// ─────────────────────────────────────────────

const NOME_DO_BOT    = 'Oto';               // 👈 Troque pelo nome que quiser
const ANTHROPIC_KEY  = 'SUA_CHAVE_AQUI';   // 👈 Cole sua API Key da Anthropic
const PERSONALIDADE  = `
Você é um assistente inteligente e simpático dentro de um grupo de WhatsApp.
Responda de forma clara, direta e amigável.
Quando a pergunta for técnica, use analogias simples.
Mantenha respostas em no máximo 3 parágrafos para não sobrecarregar o grupo.
`;

// ─────────────────────────────────────────────
//  🚀  INICIALIZAÇÃO
// ─────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const client = new Client({
    authStrategy: new LocalAuth(),   // Salva sessão — só escaneia QR uma vez
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ─────────────────────────────────────────────
//  📱  EVENTOS DE CONEXÃO
// ─────────────────────────────────────────────

// Exibe QR Code no terminal para escanear
client.on('qr', (qr) => {
    console.log('\n📱 Escaneie o QR Code abaixo com o WhatsApp do bot:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n(Use o WhatsApp do número dedicado ao bot — NÃO o seu pessoal)\n');
});

// Confirmação de conexão
client.on('ready', () => {
    console.log(`\n✅ Bot "${NOME_DO_BOT}" está ONLINE e monitorando grupos!\n`);
    console.log(`   Gatilho ativo: @${NOME_DO_BOT}`);
    console.log('   Aguardando mensagens...\n');
});

// Reconexão automática
client.on('disconnected', (reason) => {
    console.log('⚠️  Bot desconectado:', reason);
    console.log('🔄  Reconectando em 10 segundos...');
    setTimeout(() => client.initialize(), 10000);
});

// ─────────────────────────────────────────────
//  💬  PROCESSAMENTO DE MENSAGENS
// ─────────────────────────────────────────────

client.on('message', async (message) => {

    // 1) Ignora mensagens do próprio bot e de status
    if (message.fromMe) return;
    if (message.from === 'status@broadcast') return;

    const chat = await message.getChat();

    // 2) Só age em grupos (não em conversas privadas)
    if (!chat.isGroup) return;

    const texto   = message.body || '';
    const gatilho = `@${NOME_DO_BOT}`;

    // 3) Verifica se a mensagem contém o gatilho (case-insensitive)
    if (!texto.toLowerCase().includes(gatilho.toLowerCase())) return;

    // 4) Extrai a pergunta — tudo após "@NomeDoBot"
    const posicao = texto.toLowerCase().indexOf(gatilho.toLowerCase());
    const pergunta = texto.substring(posicao + gatilho.length).trim();

    // 5) Se chamou o bot mas não fez pergunta
    if (!pergunta) {
        await message.reply(
            `Olá! 👋 Pode me perguntar qualquer coisa assim:\n\n` +
            `*${gatilho} qual é sua dúvida aqui?*`
        );
        return;
    }

    // 6) Indica que está "digitando"
    await chat.sendStateTyping();

    console.log(`\n📥 Pergunta recebida: "${pergunta}"`);

    try {
        // 7) Chama a API do Claude
        const resposta = await anthropic.messages.create({
            model      : 'claude-opus-4-5',
            max_tokens : 1024,
            system     : PERSONALIDADE,
            messages   : [{ role: 'user', content: pergunta }]
        });

        const texto_resposta = resposta.content[0].text;

        console.log(`✅ Resposta enviada (${texto_resposta.length} caracteres)\n`);

        // 8) Responde no grupo (como reply, citando a mensagem original)
        await message.reply(texto_resposta);

    } catch (erro) {
        console.error('❌ Erro ao chamar Claude:', erro.message);
        await message.reply(
            '⚠️ Tive um problema técnico momentâneo. Por favor, tente novamente!'
        );
    }
});

// ─────────────────────────────────────────────
//  ▶️  INICIA O BOT
// ─────────────────────────────────────────────

client.initialize();