# Tinge: Minimalist Image Management & Processing

Tinge is a premium, high-performance image gateway designed for the Cloudflare ecosystem. It consolidates flexible storage (GitHub & R2), intelligent WASM-powered AVIF optimization, and a minimalist management interface into a single unified worker.

## 🌟 Core Features

- 🖼️ **Smart Optimization**:
    - **Cloudflare R2**: Automatically converts images to **AVIF** using high-performance WebAssembly modules (`@jsquash`) before storage.
    - **GitHub**: Performs direct uploads to preserve original file formats for Git-based workflows.
- 📦 **Multi-Target Distribution**: Distribute your media to **GitHub** and **Cloudflare R2** simultaneously with a single click.
- ⚡ **Minimalist Management**: A high-fidelity Web interface built with the **Chronicle Design System**, featuring:
    - Global configuration header for Auth and Storage targets.
    - Batch file uploads with drag-and-drop.
    - URL-based resource ingestion.
    - Integrated R2 asset manager (list, copy, delete).
- 🔐 **Unified Security**: Robust token-based authentication (`X-Worker-Auth`) enforced across all API and management operations.
- 🕸️ **Serverless Efficiency**: Built on the Hono framework and optimized for Cloudflare Workers' globally distributed edge.

## 🛠️ Configuration (GitHub Secrets)

To enable automated deployment via GitHub Actions, configure the following **Secrets** in your repository (**Settings > Secrets and variables > Actions**):

### 🔑 Authentication & Access
| Secret Name | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API Token with Workers/R2 permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID. |
| `AUTH_TOKEN` | Custom secret for API authentication (used in `X-Worker-Auth` header). |

### 📂 Storage Integration (GitHub)
| Secret Name | Description |
| :--- | :--- |
| `GH_TOKEN` | GitHub Personal Access Token (with `repo` scope). |
| `GH_USER` | Your GitHub username. |
| `GH_REPO` | The name of the repository to store images. |
| `IMAGE_DOMAIN` | The public domain for accessing GitHub images (e.g., `https://cdn.example.com`). |

### ☁️ Cloudflare Infrastructure
| Secret Name | Description |
| :--- | :--- |
| `WORKER_DOMAIN` | The custom domain or `*.workers.dev` address of your worker. |
| `PUBLIC_URL` | The base URL for accessing R2 assets (e.g., `https://img.example.com`). |

## 🚀 Deployment

1. **R2 Bucket Setup**:  
   Create an R2 bucket named `tinge` in your Cloudflare dashboard before deployment.

2. **Deploy to Production**:  
   Push your code to the `main` branch. The included GitHub Action will automatically generate the `wrangler.toml` and deploy the service.

3. **Local Development**:
   ```bash
   npm install
   npx wrangler dev
   ```

## 📝 Usage

### Web Interface
Access the root path `/` of your worker. Enter your `AUTH_TOKEN` in the top configuration bar to unlock the management features and select your preferred storage targets.

### API Integration
**Endpoint**: `POST /api/upload` (Form Data) or `POST /api/convert` (JSON)  
**Header**: `X-Worker-Auth: {YOUR_AUTH_TOKEN}`

#### JSON Payload Example (`/api/convert`):
```json
{
  "urls": ["https://example.com/img.jpg"],
  "storage": ["github", "r2"]
}
```
*Note: The `storage` parameter supports string arrays, single strings, or comma-separated values.*

## 🎨 Design Philosophy
Tinge adheres to the **Chronicle Design System**, prioritizing typography, negative space, and subtle micro-interactions to create a premium "print-on-screen" experience.

---

> [!IMPORTANT]
> Ensure the `tinge` R2 bucket is bound correctly. The deployment workflow handles this via the dynamic `wrangler.toml` generation using the `tinge` binding name.
