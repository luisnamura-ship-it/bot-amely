// ==============================================================
//  BOT WHATSAPP + CLAUDE  —  Seu "Colega Virtual" no Grupo
//  Versão: Baileys com reset de sessão forçado
//  Autor: configurado para Namura / Turma ITA
// ==============================================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Anthropic = require('@anthropic-ai/sdk');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// ⚙️  CONFIGURAÇÕES
// ──────────────────────────────────────────────────────────────

const NOME_DO_BOT   = 'Amely';
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || 'SUA_CHAVE_AQUI';
const AUTH_FOLDER   = 'auth_info';
const PERSONALIDADE = `
Você é um assistente inteligente e simpático dentro de um grupo de WhatsApp.
Responda de forma clara, direta e amigável.
Quando a pergunta for técnica, use analogias simples.
Mantenha respostas em no máximo 3 parágrafos para não sobrecarregar o grupo.
`;

// ──────────────────────────────────────────────────────────────
// 🗑️  LIMPA SESSÃO ANTIGA
// ──────────────────────────────────────────────────────────────

if (fs.existsSync(AUTH_FOLDER)) {
    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    console.log('🗑️  Sessão antiga removida. Gerando novo QR Code...');
}

// ──────────────────────────────────────────────────────────────
// 🚀  INICIALIZAÇÃO
// ──────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    version: [2, 3000, 1035194821]
});

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !state.creds.registered) {
            sock.requestPairingCode('551296802477').then(code => {
                console.log(`\n🔑 SEU CÓDIGO DE PAREAMENTO: ${code}\n`);
            });
        }
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão encerrada. Código:', code, '| Reconectando:', shouldReconnect);
            if (shouldReconnect && code !== 408) startBot();
        } else if (connection === 'open') {
            console.log(`\n✅ ${NOME_DO_BOT} está online e pronto para responder!\n`);
        }
    });

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
