# LEA聊天记录大赏

纯静态博客：收集、整理和展示群聊中出现过的有趣片段、人物群像、梗与相关资源。
由 [Majesticrise](https://github.com/Majesticrise) 维护，线上地址
**https://majesticrise.github.io**。

原生 HTML / CSS / JavaScript（ES Module），没有框架、没有构建步骤、不依赖
Jekyll 或任何服务端。Markdown 渲染、代码高亮等库已全部本地化在
`new-site/assets/vendor/`，部署后不依赖任何外部 CDN。

## 目录结构

```
.github/workflows/deploy-new-site.yml   部署工作流（推 master 自动发布）
new-site/                               站点本体（部署的就是这个目录）
├── index.html / article.html / about.html / resources.html / tags.html / 404.html
├── posts/                              ★ 文章目录（Markdown + Front Matter）
├── assets/
│   ├── css/style.css                   全站样式（配色集中在 :root 变量）
│   ├── js/site-config.js               ★ 站点配置（标题/导航/社交/评论/问答/统计）
│   ├── js/components.js                共享组件（导航/页脚/主题切换/灯箱/清单加载）
│   ├── js/main.js, tags.js, article.js, resources.js
│   ├── data/resources.json             ★ 取件码映射
│   ├── data/posts.json                 文章清单（脚本生成，勿手改）
│   ├── data/posts.fallback.json        本地预览回退清单
│   └── vendor/                         marked.js / highlight.js / DOMPurify 本地副本
├── scripts/
│   ├── generate-posts-manifest.js      清单生成（Node 版，GitHub Actions 使用）
│   ├── generate-posts-manifest.py      清单生成（Python 版，本地使用）
│   ├── generate-feed.js / generate-sitemap.js
└── update/version.json                 插件在线更新清单（勿改路径）
```

## 常见操作

**新增文章**：在 `new-site/posts/` 新建 `YYYY-MM-DD-标题.md`：

```markdown
---
title: "文章标题"
date: 2026-08-19
tags: ["标签1", "标签2"]
summary: "一句话摘要"
---

正文 Markdown。
```

push 后 GitHub Actions 自动重新生成清单并部署。想本地立即看到新文章：
`cd new-site && python scripts/generate-posts-manifest.py`。

**新增取件码**：只改 `new-site/assets/data/resources.json`，照抄一条条目改键名和
`html` 字段。

**给文章上锁**：在文章 Front Matter 里加一行 `gate: true`，该文章被访问时会
先弹出进门问答（问题/答案/跳转地址在 `site-config.js` 的 `entranceGate` 段），
答对才能阅读。技术类、杂谈类文章不加此标识即可直接阅读。

**改导航 / 页脚 / 评论 / 进门问答 / 统计**：全部在
`new-site/assets/js/site-config.js`，文件内有中文注释标注维护位置。

**本地预览**（无需 Node）：仓库根目录运行
`python -m http.server 8000`，浏览器打开
`http://127.0.0.1:8000/new-site/`。

**部署**：推送到 `master` 自动构建发布（GitHub Pages 来源须为
"GitHub Actions"）；`test/**` 分支只构建不发布，可下载 artifact 预览。

## 备注

- 旧 Jekyll 站的完整备份在 `old-site-backup-2026-10-24.zip`
  （已在 `.gitignore` 中排除，不会被提交）。
- 评论用 giscus，默认关闭；在 https://giscus.app 拿到 repoId/categoryId 后到
  `site-config.js` 的 `giscus` 段开启。
