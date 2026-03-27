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

// Helper to push to GitHub
async function pushToGitHub(filename: string, content: ArrayBuffer, env: Bindings) {
    const base64 = arrayBufferToBase64(content)
    const url = `https://api.github.com/repos/${env.GH_USER}/${env.GH_REPO}/contents/${filename}`

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${env.GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-Worker-Image-Processor',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Upload ${filename}`,
            content: base64
        })
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error(`GitHub Upload Failed: ${err}`)
    }
}

// Image processing logic
async function processImage(imgUrl: string, env: Bindings) {
    const response = await fetch(imgUrl, {
        headers: { 'User-Agent': 'Cloudflare-Worker-Image-Processor' }
    })

    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)

    // Convert to AVIF using Cloudflare Image Resizing (Requires Paid Plan)
    const avifResponse = await fetch(imgUrl, {
        cf: {
            image: {
                format: 'avif',
                quality: 80
            }
        }
    })

    const buffer = await (avifResponse.ok ? avifResponse : response).arrayBuffer()

    const hashObject = await crypto.subtle.digest('SHA-256', buffer)
    const hashHex = Array.from(new Uint8Array(hashObject))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 16)

    const filename = `${hashHex}.avif`
    await pushToGitHub(filename, buffer, env)

    return `${env.IMAGE_DOMAIN}/${filename}`
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

    const results: Record<string, string> = {}
    
    await Promise.all(urls.map(async (url: string) => {
        try {
            results[url] = await processImage(url, c.env)
        } catch (e: any) {
            results[url] = `Error: ${e.message}`
        }
    }))

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

    if (update.message?.text) {
        const chatId = update.message.chat.id
        const userId: number | undefined = update.message.from?.id
        const text = update.message.text

        // 白名单校验
        if (!isTelegramUserAllowed(userId, c.env)) {
            await fetch(`https://api.telegram.org/bot${c.env.TG_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `⛔ Unauthorized. Your Telegram user ID is ${userId}, contact the admin to get access.`
                })
            })
            return c.text('OK')
        }

        // 分行处理
        const urls = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.startsWith('http'))
        
        if (urls.length === 0) return c.text('OK')

        for (const url of urls) {
            try {
                const resultUrl = await processImage(url, c.env)
                await fetch(`https://api.telegram.org/bot${c.env.TG_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: resultUrl,
                        reply_to_message_id: update.message.message_id
                    })
                })
            } catch (e: any) {
                await fetch(`https://api.telegram.org/bot${c.env.TG_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: `Error (${url}): ${e.message}`
                    })
                })
            }
        }
    }

    return c.text('OK')
})

export default app