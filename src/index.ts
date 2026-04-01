import { Hono } from 'hono'
import htmlContent from './assets/index.html'

type Bindings = {
    GH_TOKEN: string
    GH_REPO: string
    GH_USER: string
    TG_BOT_TOKEN: string
    IMAGE_DOMAIN: string
    AUTH_TOKEN: string
    TG_ALLOWED_USERS: string
    WORKER_DOMAIN: string
}

const MINIMAL_ASSETS = {
    colors: {
        accent: '#000000',      // Primary Accent
        slate: '#475569',       // Secondary Slate
        bg: '#F8F9FA',          // Background tint
        black: '#000000',
        white: '#FFFFFF'
    },
};

// Helper: Sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const app = new Hono<{ Bindings: Bindings }>()

// Helper to render Bauhaus UI
function renderMinimalUI() {
    let html = htmlContent
    html = html.replace('{{ACCENT}}', MINIMAL_ASSETS.colors.accent)
    html = html.replace('{{SLATE}}', MINIMAL_ASSETS.colors.slate)
    html = html.replace('{{BG}}', MINIMAL_ASSETS.colors.bg)
    html = html.replace('{{BLACK}}', MINIMAL_ASSETS.colors.black)
    html = html.replace('{{WHITE}}', MINIMAL_ASSETS.colors.white)
    return html
}

// Helper: ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const CHUNK_SIZE = 8192 // 每次处理 8KB
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE)
        binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
}

// Helper: 校验 Telegram 用户是否在白名单内
function isTelegramUserAllowed(userId: number | undefined, env: Bindings): boolean {
    if (!userId) return false
    if (!env.TG_ALLOWED_USERS) return false // 未配置白名单则拒绝所有请求
    const allowedIds = env.TG_ALLOWED_USERS.split(',').map(id => id.trim())
    return allowedIds.includes(String(userId))
}

// Helper: Get extension from Content-Type
function getExtensionFromContentType(contentType: string | null): string {
    if (!contentType) return '.bin'
    const type = contentType.split(';')[0].trim().toLowerCase()
    const map: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/avif': '.avif',
        'image/svg+xml': '.svg',
        'image/x-icon': '.ico',
        'image/bmp': '.bmp'
    }
    return map[type] || '.bin'
}

// Helper to get the final generated URL based on extension
function getFinalUrl(domain: string, filename: string): string {
    const extMatch = filename.match(/\.[^.]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : '';
    const convertible = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    
    if (convertible.includes(ext)) {
        return `${domain}/${filename.substring(0, filename.lastIndexOf('.'))}.avif`;
    }
    return `${domain}/${filename}`;
}

interface GitHubFile {
    filename: string;
    content: ArrayBuffer;
}

interface ProcessedItem {
    originalInput: string;
    filename: string;
    content: ArrayBuffer;
    finalUrl: string;
}

// Helper to push batch of files via GitHub Git Database API
async function batchPushToGitHub(files: GitHubFile[], env: Bindings, commitMessage: string) {
    if (files.length === 0) return;

    const headers = {
        'Authorization': `token ${env.GH_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cloudflare-Worker-Image-Processor',
        'Content-Type': 'application/json'
    };
    
    const baseUrl = `https://api.github.com/repos/${env.GH_USER}/${env.GH_REPO}`;

    // 1. Get default branch (typically main)
    let branch = 'main';
    try {
        const repoRes = await fetch(baseUrl, { headers });
        if (repoRes.ok) {
            const rData: any = await repoRes.json();
            if (rData.default_branch) branch = rData.default_branch;
        }
    } catch { }

    // 2. Get HEAD ref
    const refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error(`Cannot get branch ref: ${await refRes.text()}`);
    const refData: any = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 3. Get commit tree sha
    const commitRes = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, { headers });
    if (!commitRes.ok) throw new Error(`Cannot get commit: ${await commitRes.text()}`);
    const commitData: any = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 4. Create blobs and gather unique files
    const treeItems = [];
    const uniqueFiles = new Map<string, GitHubFile>();
    for (const file of files) {
        if (!uniqueFiles.has(file.filename)) {
            uniqueFiles.set(file.filename, file);
        }
    }

    for (const file of uniqueFiles.values()) {
        const base64 = arrayBufferToBase64(file.content);
        const blobRes = await fetch(`${baseUrl}/git/blobs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: base64, encoding: 'base64' })
        });
        if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.filename}: ${await blobRes.text()}`);
        const blobData: any = await blobRes.json();
        treeItems.push({
            path: file.filename,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        });
    }

    // 5. Create new tree
    const treeRes = await fetch(`${baseUrl}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeItems
        })
    });
    if (!treeRes.ok) throw new Error(`Failed to create tree: ${await treeRes.text()}`);
    const treeData: any = await treeRes.json();

    // 6. Create commit
    const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [latestCommitSha]
        })
    });
    if (!newCommitRes.ok) throw new Error(`Failed to create commit: ${await newCommitRes.text()}`);
    const newCommitData: any = await newCommitRes.json();

    // 7. Update ref
    const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
            sha: newCommitData.sha,
            force: false
        })
    });
    if (!updateRefRes.ok) throw new Error(`Failed to update branch ref: ${await updateRefRes.text()}`);
}

// Prepare image buffer
async function prepareBuffer(buffer: ArrayBuffer, contentType: string | null, env: Bindings, originalInput: string): Promise<ProcessedItem> {
    const hashObject = await crypto.subtle.digest('SHA-256', buffer)
    const hashHex = Array.from(new Uint8Array(hashObject))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 16)

    const extension = getExtensionFromContentType(contentType)
    const filename = `${hashHex}${extension}`

    return {
        originalInput,
        filename,
        content: buffer,
        finalUrl: getFinalUrl(env.IMAGE_DOMAIN, filename)
    }
}

// Fetch and prepare from URL
async function prepareUrl(imgUrl: string, env: Bindings): Promise<ProcessedItem> {
    const response = await fetch(imgUrl, {
        headers: { 'User-Agent': 'Cloudflare-Worker-Image-Processor' }
    })

    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)

    const contentType = response.headers.get('Content-Type')
    const buffer = await response.arrayBuffer()

    return prepareBuffer(buffer, contentType, env, imgUrl)
}

// Helper to reply via Telegram
async function replyTelegram(chatId: string | number, text: string, replyTo: number | null, env: Bindings) {
    const body: any = { chat_id: chatId, text: text }
    if (replyTo) body.reply_to_message_id = replyTo;
    await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
}

// Routes
app.get('/', (c) => {
    return c.html(renderMinimalUI())
})

app.post('/api/convert', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const { urls } = await c.req.json()
    if (!urls || !Array.isArray(urls)) return c.json({ error: 'Invalid input' }, 400)

    const items: ProcessedItem[] = [];
    const results: Record<string, string> = {}
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        try {
            const item = await prepareUrl(url, c.env)
            items.push(item)
        } catch (e: any) {
            results[url] = `Error: ${e.message}`
        }
    }

    if (items.length > 0) {
        try {
            await batchPushToGitHub(items.map(i => ({ filename: i.filename, content: i.content })), c.env, `Added ${items.length} file(s) from API`)
            items.forEach(i => results[i.originalInput] = i.finalUrl)
        } catch (e: any) {
            items.forEach(i => results[i.originalInput] = `Error committing to github: ${e.message}`)
        }
    }

    return c.json({ results })
})

app.post('/api/upload', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    let formData;
    try {
        formData = await c.req.parseBody();
    } catch (err) {
        return c.json({ error: 'Failed to parse form data' }, 400);
    }

    const files: File[] = [];
    for (const key in formData) {
        const val = formData[key];
        if (Array.isArray(val)) {
            val.forEach(v => {
                if (v instanceof File) files.push(v);
            });
        } else if (val instanceof File) {
            files.push(val);
        }
    }

    if (files.length === 0) return c.json({ error: 'No files uploaded' }, 400);

    const items: ProcessedItem[] = [];
    const results: Record<string, string> = {}
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
            const buffer = await file.arrayBuffer()
            const item = await prepareBuffer(buffer, file.type, c.env, file.name)
            items.push(item)
        } catch (e: any) {
            results[file.name] = `Error: ${e.message}`
        }
    }

    if (items.length > 0) {
        let commitMsg = `Upload ${items.length} file(s): ${items.map(i => i.filename).join(', ')}`
        if (commitMsg.length > 100) commitMsg = `Upload ${items.length} files from Form`
        try {
            await batchPushToGitHub(items.map(i => ({ filename: i.filename, content: i.content })), c.env, commitMsg)
            items.forEach(i => results[i.originalInput] = i.finalUrl)
        } catch (e: any) {
            items.forEach(i => results[i.originalInput] = `Error committing to github: ${e.message}`)
        }
    }

    return c.json({ results })
})

// Telegram Bot Webhook
app.get('/telegram/init', async (c) => {
    const origin = new URL(c.req.url).origin
    const webhookUrl = `${origin}/telegram`

    const res = await fetch(`https://api.telegram.org/bot${c.env.TG_BOT_TOKEN}/setWebhook?url=${webhookUrl}`)
    const data = await res.json()

    return c.json({
        message: 'Telegram Webhook Initialization',
        webhook_url: webhookUrl,
        telegram_response: data
    })
})

app.post('/telegram', async (c) => {
    const update: any = await c.req.json()
    const message = update.message;

    if (!message) return c.text('OK');

    const chatId = message.chat.id
    const userId: number | undefined = message.from?.id

    // 白名单校验
    if (!isTelegramUserAllowed(userId, c.env)) {
        if (message.text || message.photo || message.document) {
            await replyTelegram(chatId, `⛔ Unauthorized. Your Telegram user ID is ${userId}, contact the admin to get access.`, null, c.env);
        }
        return c.text('OK')
    }

    // 处理文本中的URL
    if (message.text) {
        const text = message.text
        const urls = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.startsWith('http'))
        
        if (urls.length > 0) {
            const items: ProcessedItem[] = [];
            const processedMsgs: string[] = [];

            for (let i = 0; i < urls.length; i++) {
                const url = urls[i]
                try {
                    const item = await prepareUrl(url, c.env)
                    items.push(item)
                } catch (e: any) {
                    processedMsgs.push(`Error (${url}): ${e.message}`)
                }
            }

            if (items.length > 0) {
                try {
                    await batchPushToGitHub(items.map(i => ({ filename: i.filename, content: i.content })), c.env, `Added ${items.length} file(s) via Telegram Text Links`)
                    items.forEach(i => processedMsgs.push(i.finalUrl))
                } catch (e: any) {
                    items.forEach(i => processedMsgs.push(`Error committing ${i.originalInput}: ${e.message}`))
                }
            }

            if (processedMsgs.length > 0) {
                await replyTelegram(chatId, processedMsgs.join('\n'), message.message_id, c.env)
            }
        }
    } 
    // 处理发送的图片和文件
    else if (message.photo || message.document) {
        let fileId = null;
        if (message.photo) {
            const photos = message.photo;
            fileId = photos[photos.length - 1].file_id; // 获取最大分辨率图
        } else if (message.document) {
            fileId = message.document.file_id;
        }

        if (fileId) {
            try {
                const fileRes = await fetch(`https://api.telegram.org/bot${c.env.TG_BOT_TOKEN}/getFile?file_id=${fileId}`);
                const fileData = await fileRes.json();
                
                if (!fileData.ok) throw new Error('Cannot get file id from Telegram');
                
                const fileUrl = `https://api.telegram.org/file/bot${c.env.TG_BOT_TOKEN}/${fileData.result.file_path}`;
                const item = await prepareUrl(fileUrl, c.env);
                
                await batchPushToGitHub([{ filename: item.filename, content: item.content }], c.env, `Added file via Telegram Attachment`);
                await replyTelegram(chatId, item.finalUrl, message.message_id, c.env);
            } catch (e: any) {
                await replyTelegram(chatId, `Error Uploading: ${e.message}`, null, c.env)
            }
        }
    }

    return c.text('OK')
})

export default app