import { Hono } from 'hono'
import htmlContent from './assets/index.html'
import { processImageToAvif } from './imageProcessor'

type Bindings = {
    GH_TOKEN: string
    GH_REPO: string
    GH_USER: string
    GH_BRANCH?: string
    AUTH_TOKEN: string
    DOMAIN?: string
    IMAGE_ASSETS?: Fetcher
    IMAGE_DOMAIN?: string
    WORKER_DOMAIN?: string
    PUBLIC_URL?: string
    // R2 Bindings
    R2?: R2Bucket
    R2_BUCKET?: R2Bucket
    BUCKET?: R2Bucket
    [key: string]: any
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

// Helper: Extract Auth Token
function getAuthToken(c: any): string | undefined {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return undefined;
}

const app = new Hono<{ Bindings: Bindings }>()

// Error Handlers
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

app.notFound(async (c) => {
    if (c.req.method === 'GET') {
        const url = new URL(c.req.url);
        const path = url.pathname.slice(1);

        // 1. Check R2 storage if configured
        const r2 = getR2Bucket(c.env);
        if (r2 && path) {
            try {
                const object = await r2.get(path);
                if (object) {
                    const headers = new Headers();
                    object.writeHttpMetadata(headers);
                    headers.set('etag', object.httpEtag);
                    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                    return new Response(object.body, { headers });
                }
            } catch (e) {
                console.error('Failed to get object from R2:', e);
            }
        }

        // 2. Fall back to IMAGE_ASSETS Service Binding
        if (c.env.IMAGE_ASSETS) {
            try {
                // 1. Try exact requested path (e.g., /fc2a8c1c651bc43b.avif)
                let res = await c.env.IMAGE_ASSETS.fetch(c.req.raw);

                // 2. If 404 and path had folders (e.g. /9/abc.avif), try flattened root path (/abc.avif)
                if (res.status === 404 && url.pathname.includes('/')) {
                    const filename = url.pathname.split('/').pop();
                    if (filename) {
                        const flatReq = new Request(`https://internal/${filename}`, c.req.raw);
                        res = await c.env.IMAGE_ASSETS.fetch(flatReq);
                    }
                }

                if (res.status !== 404) {
                    const newRes = new Response(res.body, res);
                    newRes.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                    return newRes;
                }
            } catch (e) {
                console.error('Failed to proxy via Service Binding IMAGE_ASSETS:', e);
            }
        }
    }
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

// Helper: Get base domain URL
function getBaseDomainUrl(cOrEnv: any): string {
    if (cOrEnv && cOrEnv.req && cOrEnv.req.url) {
        try {
            const origin = new URL(cOrEnv.req.url).origin;
            if (origin && origin !== 'null') {
                return origin;
            }
        } catch {}
    }
    const env = cOrEnv?.env || cOrEnv || {};
    const raw = env.DOMAIN || env.IMAGE_DOMAIN || env.WORKER_DOMAIN || env.PUBLIC_URL || '';
    return formatBaseUrl(raw);
}

// Helper: Resolve R2 Bucket dynamically
function getR2Bucket(env: any): R2Bucket | undefined {
    if (env.R2) return env.R2;
    if (env.R2_BUCKET) return env.R2_BUCKET;
    if (env.BUCKET) return env.BUCKET;
    for (const key of Object.keys(env)) {
        const val = env[key];
        if (val && typeof val.put === 'function' && typeof val.get === 'function' && typeof val.list === 'function') {
            return val as R2Bucket;
        }
    }
    return undefined;
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
    let branch = env.GH_BRANCH || 'images';
    if (!env.GH_BRANCH) {
        try {
            const repoRes = await fetch(baseUrl, { headers });
            if (repoRes.ok) {
                const rData: any = await repoRes.json();
                if (rData.default_branch) branch = rData.default_branch;
            }
        } catch { }
    }

    const refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers });
    if (!refRes.ok) {
        if (refRes.status === 404) {
            throw new Error(`Target branch "${branch}" not found in repository ${env.GH_USER}/${env.GH_REPO}. Please initialize the branch first.`);
        }
        if (refRes.status === 401 || refRes.status === 403) {
            throw new Error(`GitHub auth failed (HTTP ${refRes.status}). Please check GH_TOKEN permissions.`);
        }
        throw new Error(`GitHub Auth/Ref Error: ${refRes.status}`);
    }
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
    const token = getAuthToken(c);
    if (c.env.AUTH_TOKEN && token !== c.env.AUTH_TOKEN) {
        return c.json({ error: 'Unauthorized' }, 401)
    }

    const formData = await c.req.parseBody({ all: true });
    const storageRaw = formData['storage'] || c.req.header('X-Storage');
    const storageTargets = typeof storageRaw === 'string' ? storageRaw.split(',').map(s => s.trim()) : (Array.isArray(storageRaw) ? storageRaw : []);

    if (storageTargets.length === 0) return c.json({ error: 'No storage target' }, 400);

    const r2 = storageTargets.includes('r2') ? getR2Bucket(c.env) : undefined;
    if (storageTargets.includes('r2') && !r2) {
        return c.json({ error: 'R2 storage is not configured or bound to this Worker' }, 500);
    }

    if (storageTargets.includes('github') && (!c.env.GH_TOKEN || !c.env.GH_USER || !c.env.GH_REPO)) {
        return c.json({ error: 'GitHub storage configuration is incomplete (GH_TOKEN, GH_USER, GH_REPO required)' }, 400);
    }

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

        if (storageTargets.includes('r2') && r2) {
            let r2Buffer = buffer;
            let r2Ext = ext;
            let r2ContentType = file.type || 'application/octet-stream';

            if (!r2ContentType.includes('svg') && r2ContentType.startsWith('image/')) {
                try {
                    r2Buffer = await processImageToAvif(buffer, r2ContentType);
                    r2Ext = '.avif';
                    r2ContentType = 'image/avif';
                } catch (e) {
                    console.error("Image conversion failed, falling back to original:", e);
                }
            }

            const r2HashBuffer = await crypto.subtle.digest('SHA-256', r2Buffer);
            const r2Hash = Array.from(new Uint8Array(r2HashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
            const key = `${r2Hash}${r2Ext}`;

            await r2.put(key, r2Buffer, { httpMetadata: { contentType: r2ContentType } });
            outputUrls.push(`${getBaseDomainUrl(c)}/${key}`);
        }
        
        if (storageTargets.includes('github')) {
            ghItems.push({ filename, content: buffer });
            outputUrls.push(`${getBaseDomainUrl(c)}/${hash}${ext === '.svg' ? '.svg' : '.avif'}`);
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
    const token = getAuthToken(c);
    if (c.env.AUTH_TOKEN && token !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)

    const { urls, storage } = await c.req.json();
    const storageTargets = Array.isArray(storage) ? storage : [storage];
    const r2 = storageTargets.includes('r2') ? getR2Bucket(c.env) : undefined;
    if (storageTargets.includes('r2') && !r2) {
        return c.json({ error: 'R2 storage is not configured or bound to this Worker' }, 500);
    }
    if (storageTargets.includes('github') && (!c.env.GH_TOKEN || !c.env.GH_USER || !c.env.GH_REPO)) {
        return c.json({ error: 'GitHub storage configuration is incomplete (GH_TOKEN, GH_USER, GH_REPO required)' }, 400);
    }
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

            if (storageTargets.includes('r2') && r2) {
                let r2Buffer = buffer;
                let r2Ext = ext;
                let r2ContentType = contentType || 'application/octet-stream';

                if (!r2ContentType.includes('svg') && r2ContentType.startsWith('image/')) {
                    try {
                        r2Buffer = await processImageToAvif(buffer, r2ContentType);
                        r2Ext = '.avif';
                        r2ContentType = 'image/avif';
                    } catch (e) {
                        console.error("Image conversion failed, falling back to original:", e);
                    }
                }

                const r2HashBuffer = await crypto.subtle.digest('SHA-256', r2Buffer);
                const r2Hash = Array.from(new Uint8Array(r2HashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
                const key = `${r2Hash}${r2Ext}`;

                await r2.put(key, r2Buffer, { httpMetadata: { contentType: r2ContentType } });
                outputUrls.push(`${getBaseDomainUrl(c)}/${key}`);
            }
            if (storageTargets.includes('github')) {
                ghItems.push({ filename, content: buffer });
                outputUrls.push(`${getBaseDomainUrl(c)}/${hash}${ext === '.svg' ? '.svg' : '.avif'}`);
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
    const token = getAuthToken(c);
    if (c.env.AUTH_TOKEN && token !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
    
    const r2 = getR2Bucket(c.env);
    if (!r2) return c.json({ error: 'R2 storage is not configured or bound' }, 500);

    const list = await r2.list({ limit: parseInt(c.req.query('limit') || '50', 10), cursor: c.req.query('cursor') || undefined });
    const baseUrl = getBaseDomainUrl(c);
    
    return c.json({
        status: 'success',
        data: {
            objects: list.objects.map(obj => ({ key: obj.key, size: obj.size, uploaded: obj.uploaded, url: `${baseUrl}/${obj.key}` })),
            cursor: list.truncated ? list.cursor : null
        }
    });
});

app.delete('/api/images', async (c) => {
    const token = getAuthToken(c);
    if (c.env.AUTH_TOKEN && token !== c.env.AUTH_TOKEN) return c.json({ error: 'Unauthorized' }, 401)
    const r2 = getR2Bucket(c.env);
    if (!r2) return c.json({ error: 'R2 storage is not configured or bound' }, 500);

    const { key } = await c.req.json();
    await r2.delete(key);
    return c.json({ status: 'success' });
});

export default app