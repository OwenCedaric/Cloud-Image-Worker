import { Hono } from 'hono'
import htmlContent from './assets/index.html'

type Bindings = {
    GH_TOKEN: string
    GH_REPO: string
    GH_USER: string
    IMAGE_DOMAIN: string
    AUTH_TOKEN: string
    WORKER_DOMAIN: string
    // Tinge Bindings
    tinge: R2Bucket
    PUBLIC_URL: string
}

const MINIMAL_ASSETS = {
    colors: {
        baseSurface: '#fbf9f6',
        primaryInk: '#3d4451',
        secondaryInk: '#757d8a',
        accent: '#82a1b9',
        white: '#FFFFFF',
        black: '#000000'
    },
};

const app = new Hono<{ Bindings: Bindings }>()

// Error Handlers
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.notFound((c) => {
    return c.json({ error: 'Route not found' }, 404);
});

// Helper: ArrayBuffer to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const CHUNK_SIZE = 8192
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE)
        binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
}

// Helper: Ensure URL has protocol
function formatBaseUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim().replace(/\/$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    return `https://${trimmed}`;
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

// Helper: Get Content-Type from extension
function getContentTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'avif': 'image/avif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'bmp': 'image/bmp'
    }
    return map[ext || ''] || 'application/octet-stream';
}

function renderMinimalUI() {
    let html = htmlContent
    html = html.replace(/{{BASE_SURFACE}}/g, MINIMAL_ASSETS.colors.baseSurface)
    html = html.replace(/{{PRIMARY_INK}}/g, MINIMAL_ASSETS.colors.primaryInk)
    html = html.replace(/{{SECONDARY_INK}}/g, MINIMAL_ASSETS.colors.secondaryInk)
    html = html.replace(/{{ACCENT}}/g, MINIMAL_ASSETS.colors.accent)
    html = html.replace(/{{WHITE}}/g, MINIMAL_ASSETS.colors.white)
    html = html.replace(/{{BLACK}}/g, MINIMAL_ASSETS.colors.black)
    return html
}

interface GitHubFile {
    filename: string;
    content: ArrayBuffer;
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
    let branch = 'main';
    try {
        const repoRes = await fetch(baseUrl, { headers });
        if (repoRes.ok) {
            const rData: any = await repoRes.json();
            if (rData.default_branch) branch = rData.default_branch;
        }
    } catch { }

    const refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers });
    if (!refRes.ok) throw new Error(`GitHub Auth/Ref Error: ${refRes.status}`);
    const refData: any = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, { headers });
    const commitData: any = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const treeItems = [];
    for (const file of files) {
        const base64 = arrayBufferToBase64(file.content);
        const blobRes = await fetch(`${baseUrl}/git/blobs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content: base64, encoding: 'base64' })
        });
        const blobData: any = await blobRes.json();
        treeItems.push({ path: file.filename, mode: '100644', type: 'blob', sha: blobData.sha });
    }

    const treeRes = await fetch(`${baseUrl}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    const treeData: any = await treeRes.json();

    const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: commitMessage, tree: treeData.sha, parents: [latestCommitSha] })
    });
    const newCommitData: any = await newCommitRes.json();

    await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommitData.sha, force: false })
    });
}

// Routes
app.get('/', (c) => c.html(renderMinimalUI()))

app.post('/api/upload', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth') || c.req.header('X-Access-Token')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const formData = await c.req.parseBody({ all: true });
    const storageRaw = formData['storage'] || c.req.header('X-Storage');
    const storageTargets = typeof storageRaw === 'string' ? storageRaw.split(',').map(s => s.trim()) : (Array.isArray(storageRaw) ? storageRaw : []);

    if (storageTargets.length === 0) return c.json({ error: 'No storage target' }, 400);

    const files: File[] = [];
    for (const key in formData) {
        const val = formData[key];
        if (Array.isArray(val)) val.forEach(v => { if (v instanceof File) files.push(v) });
        else if (val instanceof File) files.push(val);
    }

    const results: Record<string, string> = {}
    const ghItems: GitHubFile[] = [];

    for (const file of files) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        const ext = getExtensionFromContentType(file.type);
        const filename = `${hash}${ext}`;
        const outputUrls: string[] = [];

        if (storageTargets.includes('r2')) {
            const key = filename;
            await c.env.tinge.put(key, buffer, { httpMetadata: { contentType: file.type } });
            outputUrls.push(`${formatBaseUrl(c.env.PUBLIC_URL || c.env.IMAGE_DOMAIN)}/${key}`);
        }
        
        if (storageTargets.includes('github')) {
            ghItems.push({ filename, content: buffer });
            outputUrls.push(`${formatBaseUrl(c.env.IMAGE_DOMAIN)}/${hash}.avif`);
        }
        results[file.name] = outputUrls.join(' | ');
    }

    if (ghItems.length > 0) {
        await batchPushToGitHub(ghItems, c.env, `Upload ${ghItems.length} images`);
    }

    return c.json({ results })
})

// Remote fetch and upload
app.post('/api/convert', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth') || c.req.header('X-Access-Token')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)

    const { urls, storage } = await c.req.json();
    const storageTargets = Array.isArray(storage) ? storage : [storage];
    const results: Record<string, string> = {};
    const ghItems: GitHubFile[] = [];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
            const buffer = await res.arrayBuffer();
            const contentType = res.headers.get('Content-Type');
            const ext = getExtensionFromContentType(contentType);
            
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
            const filename = `${hash}${ext}`;
            const outputUrls: string[] = [];

            if (storageTargets.includes('r2')) {
                const key = filename;
                await c.env.tinge.put(key, buffer, { httpMetadata: { contentType: contentType || 'image/jpeg' } });
                outputUrls.push(`${formatBaseUrl(c.env.PUBLIC_URL || c.env.IMAGE_DOMAIN)}/${key}`);
            }
            if (storageTargets.includes('github')) {
                ghItems.push({ filename, content: buffer });
                outputUrls.push(`${formatBaseUrl(c.env.IMAGE_DOMAIN)}/${hash}.avif`);
            }
            results[url] = outputUrls.join(' | ');
        } catch (e: any) {
            results[url] = `Error: ${e.message}`;
        }
    }

    if (ghItems.length > 0) await batchPushToGitHub(ghItems, c.env, `Remote upload ${ghItems.length} images`);
    return c.json({ results });
})

// R2 Image Management
app.get('/api/images', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth') || c.req.header('X-Access-Token')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
    
    const list = await c.env.tinge.list({ limit: parseInt(c.req.query('limit') || '50', 10), cursor: c.req.query('cursor') || undefined });
    const baseUrl = formatBaseUrl(c.env.PUBLIC_URL || c.env.IMAGE_DOMAIN);
    
    return c.json({
        status: 'success',
        data: {
            objects: list.objects.map(obj => ({ key: obj.key, size: obj.size, uploaded: obj.uploaded, url: `${baseUrl}/${obj.key}` })),
            cursor: list.truncated ? list.cursor : null
        }
    });
});

app.delete('/api/images', async (c) => {
    const authHeader = c.req.header('X-Worker-Auth') || c.req.header('X-Access-Token')
    if (c.env.AUTH_TOKEN && authHeader !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
    const { key } = await c.req.json();
    await c.env.tinge.delete(key);
    return c.json({ status: 'success' });
});

export default app