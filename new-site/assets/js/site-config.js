/* ============================================================
 * site-config.js —— 站点全局配置（普通脚本，先于其它模块加载）
 * 修改网站标题、导航、社交链接、分页数量、评论等，都只需要改这个文件。
 * 注意：这里不要写死 new-site 前缀，所有路径都是相对路径。
 * ============================================================ */

window.SITE_CONFIG = {
  /* ---------- 基础信息 ---------- */
  siteTitle: 'LEA聊天记录大赏',
  siteSubtitle: '群聊存档 · Minecraft 技术 · 杂谈',
  author: 'Majesticrise',
  lang: 'zh-CN',
  description: 'LEA聊天记录大赏 —— 群聊存档、Minecraft 技术笔记与杂谈，由 Majesticrise 维护。',

  /* ---------- 社交 / 联系方式（页脚使用） ---------- */
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
  pageSize: 5,              // 首页每页文章数
  siteUrl: '',              // 留空则由脚本自动推断（feed/sitemap 生成器另有 SITE_URL 变量）

  /* ---------- giscus 评论（默认关闭） ----------
   * 启用步骤：
   * 1. 在 https://giscus.app 绑定仓库并拿到 repoId / categoryId
   * 2. 把 enabled 改成 true 并填好下面四项
   * 3. 若仓库是私有的，评论将无法使用（giscus 要求公开仓库）
   */
  giscus: {
    enabled: false,
    repo: 'Majesticrise/Majesticrise.github.io',
    repoId: '',
    category: 'Announcements',
    categoryId: '',
    mapping: 'pathname',
    reactionsEnabled: '1',
    inputPosition: 'top',
    theme: 'light',
    lang: 'zh-CN'
  },

  /* ---------- 资源页日期彩蛋 ---------- */
  hitokoto: {
    enabled: true,
    api: 'https://v1.hitokoto.cn'
  },

  /* ---------- 不蒜子阅读量统计（页脚"本页阅读 N 次"） ----------
   * 依赖第三方服务 busuanzi.ibruce.info，稳定性一般；加载失败时页脚不显示该行。
   * 【在这里关闭统计】enabled 改成 false 即可。
   */
  busuanzi: {
    enabled: true
  },

  /* ---------- 进门问答（加锁文章用；首页彩蛋默认关闭） ----------
   * enabled: 总开关。关闭后首页与加锁文章都不再弹问答。
   * homeEnabled: 是否在访问首页时弹问答（旧站彩蛋）。
   * 【在这里修改问答内容】question / answer / redirectUrl。
   * oncePerSession: true 时答对一次后本次浏览器会话不再询问。
   * 文章加锁：在文章 Front Matter 里加一行 `gate: true`，
   * 该文章被访问时同样会弹出这里的问答（见 article.js）。
   */
  entranceGate: {
    enabled: true,
    homeEnabled: false,
    question: 'LEA工会现任社长是谁(完整QQ用户名)？',
    answer: 'XiaoHui_',
    redirectUrl: 'https://www.bilibili.com/video/BV1GJ411x7h7/',
    oncePerSession: false
  },

  /* ---------- 首页小部件：现在时间 / 高考倒计时 ----------
   * 【在这里修改倒计时目标】target 填 YYYY-MM-DD，按当天零点计算。
   * time.weekdayStyle: 'jp' 为旧站的日曜日风格，'cn' 为星期日风格。
   */
  homeWidgets: {
    time: {
      enabled: true,
      label: '现在时间',
      weekdayStyle: 'jp'
    },
    countdown: {
      enabled: true,
      label: '⏳ 2029年高考倒计时',
      target: '2029-06-07',
      doneText: '🎉 高考已开始，祝考生金榜题名！'
    }
  }
};
