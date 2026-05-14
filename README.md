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

### ⚙️ Environment Variables (GitHub Variables)
In addition to secrets, you can configure these **Variables** (**Settings > Secrets and variables > Actions > Variables**):

| Variable Name | Description | Default |
| :--- | :--- | :--- |
| `WORKER_NAME` | The name of your Cloudflare Worker. | `cloud-image-worker` |
| `R2_BINDING` | The R2 binding name accessed by the code. | `tinge` |
| `R2_BUCKET` | The actual name of your R2 bucket. | `tinge` |

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
   Create an R2 bucket in your Cloudflare dashboard. Note the name and set it as `R2_BUCKET` in your GitHub Variables.

2. **Deploy to Production**:  
   Push your code to the `main` branch. The included GitHub Action will automatically generate the `wrangler.toml`, prepare local assets (fonts, styles), and deploy the service.

3. **Local Development**:
   ```bash
   npm install
   # Prepare local fonts and external styles
   ./scripts/prepare-fonts.sh
   npx wrangler dev
   ```

## 📝 Usage

### Web Interface
Access the root path `/` of your worker. Enter your `AUTH_TOKEN` in the top configuration bar to unlock the management features. 

**New in v1.1**:
- **Dual-Pane Upload**: Drag files into the vacuum on the left and manage your pending queue on the right. 
- **Additive Selection**: Add files in multiple batches before processing.
- **Batch Removal**: Remove individual files from the pending list with a single click.

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
Tinge adheres to the **Chronicle Design System**, prioritizing typography, negative space, and a chromatic austerity (one accent color). It utilizes local font hosting and modular CSS to maintain a premium, performant, and privacy-respecting profile.

---

> [!IMPORTANT]
> The worker relies on the `R2_BINDING` variable to match the binding name in `src/index.ts`. By default, this is set to `tinge`. If you change the binding name in variables, ensure you also update the `Bindings` type in `src/index.ts`.
