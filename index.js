// ==============================================================
//  BOT WHATSAPP + CLAUDE  —  Seu "Colega Virtual" no Grupo
//  Versão: Baileys com QR Code corrigido
//  Autor: configurado para Namura / Turma ITA
// ==============================================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Anthropic = require('@anthropic-ai/sdk');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

// ──────────────────────────────────────────────────────────────
// ⚙️  CONFIGURAÇÕES
// ──────────────────────────────────────────────────────────────

const NOME_DO_BOT   = 'Amely';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || 'SUA_CHAVE_AQUI';
const PERSONALIDADE = `
Você é um assistente inteligente e simpático dentro de um grupo de WhatsApp.
Responda de forma clara, direta e amigável.
Quando a pergunta for técnica, use analogias simples.
Mantenha respostas em no máximo 3 parágrafos para não sobrecarregar o grupo.
`;

// ──────────────────────────────────────────────────────────────
// 🚀  INICIALIZAÇÃO
// ──────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    // Exibe QR Code nos logs
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 ESCANEIE O QR CODE ABAIXO COM O WHATSAPP DO BOT:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão encerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`\n✅ ${NOME_DO_BOT} está online e pronto para responder!\n`);
        }
    });

    // ──────────────────────────────────────────────────────────
    // 💬  PROCESSAMENTO DE MENSAGENS
    // ──────────────────────────────────────────────────────────

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                if (msg.key.fromMe) continue;

                const texto = msg.message?.conversation
                    || msg.message?.extendedTextMessage?.text
                    || '';

                if (!texto) continue;

                const isGroup = msg.key.remoteJid?.endsWith('@g.us');
                const mencionado = texto.toLowerCase().includes(NOME_DO_BOT.toLowerCase());

                if (isGroup && !mencionado) continue;

                console.log(`📩 Mensagem recebida: ${texto}`);

                const pergunta = texto.replace(new RegExp(NOME_DO_BOT, 'gi'), '').trim();

                const resposta = await anthropic.messages.create({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 500,
                    system: PERSONALIDADE,
                    messages: [{ role: 'user', content: pergunta }]
                });

                const textoResposta = resposta.content[0].text;
                await sock.sendMessage(msg.key.remoteJid, { text: textoResposta }, { quoted: msg });
                console.log(`✅ Respondido: ${textoResposta.substring(0, 50)}...`);

            } catch (erro) {
                console.error('❌ Erro ao processar mensagem:', erro);
            }
        }
    });
}

startBot();
