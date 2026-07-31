# 六爻问卦 · 部署到 Vercel

## 🎯 部署前的准备

### 1. 撤销并重新生成 DeepSeek API Key ⚠️
之前的 Key 曾出现在前端代码里，为了安全，**必须**：
1. 打开 https://platform.deepseek.com/api_keys
2. 找到旧 Key，点击"删除"或"禁用"
3. 点击"Create new API Key"生成一个新的
4. 复制新 Key 备用（后面配 Vercel 时用）

### 2. 准备 GitHub 账号和 Vercel 账号
- 有 GitHub 账号（用来存代码）
- 有 Vercel 账号（免费，用 GitHub 登录即可）

---

## 🚀 部署步骤（首次部署）

### Step 1：把代码推到 GitHub

```bash
cd /Users/jieshen/liuyao

# 首次初始化 git
git init
git add .
git commit -m "初始版本"

# 在 GitHub 网页上创建一个新仓库（名字随意，比如 liuyao），然后：
git remote add origin https://github.com/你的用户名/liuyao.git
git branch -M main
git push -u origin main
```

### Step 2：在 Vercel 导入项目

1. 打开 https://vercel.com/new
2. 找到你刚创建的 `liuyao` 仓库，点 "Import"
3. **保持所有默认设置**（不用改 Build Command，Framework Preset 选 "Other"）
4. **展开 "Environment Variables"，添加两个变量**：

   | Name | Value |
   |------|-------|
   | `DEEPSEEK_KEY` | 你新生成的 DeepSeek API Key |
   | `ALLOWED_ORIGINS` | 你的域名（部署后填，先留空） |

5. 点 "Deploy"，等 30 秒左右

### Step 3：首次部署完成后

Vercel 会给你一个域名，比如 `liuyao-abc123.vercel.app`

1. 回到 Vercel 项目的 Settings → Environment Variables
2. 编辑 `ALLOWED_ORIGINS`，填入你的域名，例如：
   ```
   liuyao-abc123.vercel.app
   ```
   (如果有自定义域名，也加进来，用逗号分隔：`liuyao-abc123.vercel.app,你的域名.com`)
3. 回到 Deployments 页，点最新一次部署右侧 "..." → "Redeploy"，重新部署一次

**完成！** 现在你的网站就在线了，任何人打开都能用 AI 解卦。

---

## 🔒 已配置的防滥用措施

后端 API `/api/interpret` 会自动做这些保护：

| 保护措施 | 规则 |
|---------|------|
| 单 IP 每小时限流 | 最多 5 次 |
| 单 IP 每日限流 | 最多 20 次 |
| Origin/Referer 校验 | 只允许 `ALLOWED_ORIGINS` 里的域名 |
| 请求方法限制 | 只接受 POST |
| 请求参数校验 | question 最多 500 字 |

如果需要更强的保护（比如全站每日总量），后续可以接入 Vercel KV 做分布式限流。

---

## 🔄 修改代码后如何更新

改完代码之后：
```bash
cd /Users/jieshen/liuyao
git add .
git commit -m "描述你改了什么"
git push
```

Vercel 会自动检测到 push 并重新部署，1-2 分钟后线上就更新了。

---

## 💰 费用说明

- **Vercel**：免费额度足够个人用（Hobby 计划：每月 100GB 流量、100 小时 Serverless 运行时间）
- **DeepSeek**：每次解卦约 ¥0.002-0.005
  - 单次输入 ~1500 tokens + 输出 ~800 tokens
  - 按 deepseek-chat 定价约 ¥0.003
  - 1000 次约 ¥3；10000 次约 ¥30

---

## ❓ 常见问题

**Q: 部署后点"AI 智能解卦"报错 "AI 服务未配置"？**
A: 检查 Vercel 项目 Settings → Environment Variables 里有没有 `DEEPSEEK_KEY`，值是否是完整的新 Key。改完记得 Redeploy。

**Q: 报 "来源不合法"？**
A: `ALLOWED_ORIGINS` 里没有填当前访问的域名。加进去后 Redeploy。

**Q: 本地开发时 AI 解卦不工作？**
A: 本地没有 `/api/interpret` 后端。可以：
- 装 Vercel CLI，运行 `vercel dev` 会自动跑起后端
- 或者仅测试前端时先把 AI 按钮设成不可点

**Q: 遇到 429 "问卦次数已到"？**
A: 是防滥用起作用了。如果误伤了自己，可以稍等或者调高 `api/interpret.js` 里的 `hourly`/`daily` 限制。
