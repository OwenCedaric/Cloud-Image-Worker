# Cloud-Image-Worker: Cloudflare Image Processor & GitHub Storage

这是一个基于 Cloudflare Workers 的图像处理与存储方案，它可以将图片下载并转换为 **AVIF** 格式，然后自动上传到指定的 GitHub 仓库中。

## 🌟 主要功能

- 🖼️ **自动转换**: 将任意来源的图片通过 Cloudflare Image Resizing 转换为更高效的 AVIF 格式。
- 📦 **GitHub 存储**: 自动将处理后的图片上传到 GitHub 仓库，利用 GitHub Pages 或 CDN 进行分发。
- 🕸️ **多渠道输入**:
  - **精美网页端**: 提供直观的 Web 界面进行单张或批量图片转换。
  - **API 接口**: 通过 `/api/convert` 接口支持跨应用集成。
  - **Telegram 机器人**: 直接在 Telegram 中发送图片链接，机器人会自动处理并返回结果。
- ⚡ **无服务器架构**: 基于 Hono 框架，部署在 Cloudflare Workers 上，响应迅速且成本低廉。

## 🛠️ 环境配置

在部署之前，请确保在 Cloudflare Workers 的设置或 `wrangler.toml` 中配置了以下变量：

| 变量名 | 描述 |
| :--- | :--- |
| `GH_TOKEN` | GitHub 个人访问令牌 (Classic 或 Fine-grained) |
| `GH_REPO` | 存储图片的 GitHub 仓库名称 |
| `GH_USER` | 你的 GitHub 用户名 |
| `TG_BOT_TOKEN` | Telegram Bot API 令牌 |
| `TG_ALLOWED_USERS` | Telegram User ID |
| `IMAGE_DOMAIN` | 访问图片的域名 (例如: `https://cdn.example.com` 或 `https://user.github.io/repo`) |
| `WORKER_DOMAIN` | Workers 服务的自定义域名 (用于配置 `[[routes]]`) |
| `AUTH_TOKEN` | 用于验证 API 请求的令牌 (需在 Header 中添加 `X-Worker-Auth`) |

## 🚀 部署指南

1. **克隆仓库**:
   ```bash
   git clone <your-repo-url>
   cd cloud-image-worker
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **配置 Wrangler**:
   在 `wrangler.toml` 中填写你的服务名称和环境变量。

4. **部署到 Cloudflare**:
   ```bash
   npx wrangler deploy
   ```

## 🤖 GitHub Actions 配置

本项目支持通过 GitHub Actions 自动部署。请在 GitHub 仓库的 **Settings > Secrets and variables > Actions > Secrets** 中配置以下内容：

### Secrets (机密)
- `CLOUDFLARE_API_TOKEN`: Cloudflare API 令牌
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 账户 ID
- `GH_TOKEN`: GitHub 个人访问令牌 (需包含 repo 权限)
- `GH_USER`: GitHub 用户名
- `GH_REPO`: 存储图片的仓库名
- `IMAGE_DOMAIN`: 图片访问域名 (例如: `https://user.github.io/repo`)
- `WORKER_DOMAIN`: Workers 服务的自定义域名 (用于配置 `[[routes]]`)
- `TG_BOT_TOKEN`: Telegram 机器人令牌
- `TG_ALLOWED_USERS`: Telegram 机器人准许使用的用户列表
- `AUTH_TOKEN`: 你自定义的 API 验证令牌 (由于 Surge 注入)

## 📝 使用方法

### Web 界面
访问你的 Worker 根路径 `/`，即可看到转换页面。粘贴图片链接并点击 "Convert"。

### API 接口
请求地址：`POST /api/convert`
Header: `X-Worker-Auth: {您的 AUTH_TOKEN}`

**请求体 (JSON)**:
```json
{
  "urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.png"
  ]
}
```

**响应体 (JSON)**:
```json
{
  "results": {
    "https://example.com/image1.jpg": "https://your-image-domain.com/hash1.avif",
    "https://example.com/image2.png": "Error: Failed to fetch image"
  }
}
```

#### Surge 配置参考
- **直接使用静态资产链接**: [https://your-worker-domain.com/surge.sgmodule](https://your-worker-domain.com/surge.sgmodule)

直接在 Surge 中添加该模块，然后在模块设置中填写你的 `Auth` (即 `AUTH_TOKEN`)。该模块会自动处理域名匹配并注入 `X-Worker-Auth` 请求头。

> [!TIP]
> 该模块会自动匹配你的域名并注入 `X-Worker-Auth` 请求头。如果失效，请确保在 Surge 模块设置中开启了相应的域名。

### Telegram 机器人
#### 1. 自动初始化 (推荐)
部署成功后，访问以下链接即可自动完成 Webhook 设置：
`https://your-worker-domain.com/telegram/init`

#### 2. 手动设置
1. 将你的 Webhook URL 设置为 `https://your-worker.workers.dev/telegram`。
2. 在 Telegram 中直接给机器人发送包含图片链接的消息。

---

> [!NOTE]
> 获取 AVIF 格式转换功能需要 Cloudflare 账户开启 **Image Resizing**（通常在付费计划中提供）。如果该功能未开启，程序将默认保存原图。
