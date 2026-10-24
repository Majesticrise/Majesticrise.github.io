/* ============================================================
 * config.js —— 站点全局配置（ES Module，被 components.js 导入）
 * 改网站标题、导航、社交链接、分页数量、评论、彩蛋，都只需要改这个文件。
 * 注意：这里不写死 new-site 前缀，所有站内路径都用相对路径。
 * ============================================================ */

export const SITE = {
  /* ---------- 基础信息 ---------- */
  siteTitle: 'LEA聊天记录大赏',
  siteSubtitle: '记录群聊里的荒诞与快乐',
  author: 'Majesticrise',
  lang: 'zh-CN',
  description: 'LEA聊天记录大赏 —— 由 Majesticrise 维护的聊天记录、群像与资源存档站。',

  /* ---------- 社交 / 联系方式（页脚与关于页使用） ---------- */
  email: 'majesticrise@qq.com',
  github: 'https://github.com/Majesticrise',
  bilibili: 'https://space.bilibili.com/3493114226411557',
  minebbs: 'https://www.minebbs.com/members/majesticrise.122701/',
  rss: 'feed.xml',

  /* ---------- 在这里修改导航 ----------
   * label: 显示文字；href: 相对路径或完整外链
   * external: true 时新窗口打开并显示 ↗
   * children: 有子项时渲染成下拉菜单
   */
  nav: [
    { label: '首页', href: 'index.html' },
    { label: '关于我', href: 'about.html' },
    {
      label: 'Resources',
      children: [
        { label: '资源', href: 'resources.html' },
        { label: 'Minebbs 插件', href: 'https://www.minebbs.com/members/majesticrise.122701/', external: true }
      ]
    },
    { label: '标签', href: 'tags.html' },
    { label: '作者主页', href: 'https://space.bilibili.com/3493114226411557', external: true }
  ],

  /* ---------- 列表与分页 ---------- */
  pageSize: 5,   // 首页每次"加载更多"显示的文章数

  /* ---------- giscus 评论（默认关闭） ----------
   * 启用步骤：
   * 1. 在 https://giscus.app 绑定仓库并拿到 repoId / categoryId
   * 2. 把 enabled 改成 true 并填好下面两项
   * 3. giscus 要求仓库是公开的
   */
  giscus: {
    enabled: false,
    repo: 'Majesticrise/Majesticrise.github.io',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    reactionsEnabled: '1',
    inputPosition: 'top',
    theme: 'light',
    lang: 'zh-CN'
  },

  /* ---------- 资源页日期彩蛋（一言） ---------- */
  hitokoto: {
    enabled: true,
    api: 'https://v1.hitokoto.cn'
  }
};
