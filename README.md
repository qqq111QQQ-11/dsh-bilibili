# dsh-bilibili

在 **DeepSeek Harness** 里刷哔哩哔哩。

## 功能

- **未登录也能刷**：推荐流、搜索、视频详情、播放、评论列表全部可用，不需要账号
- **扫码登录**：面板里直接出二维码，哔哩哔哩 App 扫一下即可；也支持手动粘贴 Cookie 兜底
- **推荐流**：排行榜（100 条），封面 / 标题 / UP 主 / 播放 / 弹幕 / 时长
- **搜索**：走 WBI 签名的官方搜索接口（未登录可用）
- **视频详情**：内嵌官方播放器，可直接看
- **点赞**：真实调用 `archive/like`，带 CSRF 校验（需登录）
- **评论**：发送评论 + 加载评论列表（看评论不需要登录，发评论需要）
- **转发**：转发视频到自己的动态（需登录）

## 登录与安全

- 扫码后 Cookie 只写本机 `~/.dsh/dsh-bilibili/session.json`（权限 0600）
- 浏览器侧**永远拿不到** Cookie 原文，只拿到昵称、头像、等级
- 所有写操作（点赞 / 评论 / 转发）都在 Host 侧签名并携带 `bili_jct` CSRF
- 接口只接受 `127.0.0.1` / `::1` 且 Origin 与 Host 同源的请求

## 实现要点

- **WBI 签名**：从 `/x/web-interface/nav` 取 `wbi_img`，按 64 位混淆表还原 `mixin_key`，参数排序 + 去特殊字符 + MD5，缓存 1 小时
- **风控兜底**：首次请求自动调 `/x/frontend/finger/spi` 补 `buvid3` / `buvid4`，否则大量接口会返回 `-352`
- **零外部依赖**：Host 只 import `node:` 内置模块；QR 生成库以静态脚本由 Host 提供，不塞进 client bundle
- **启动顺序**：`ctx.inject(['webServer'])` 等 web 服务就绪再挂路由，避免"插件 live 但接口全 404"

## 安装

```bash
dsh plugin --profile desktop add github:<owner>/dsh-bilibili
```

装完重启 DSH，进 **设置 → 哔哩哔哩**。

## 自检

```bash
node test/selfcheck.mjs
```

覆盖：14 条路由挂载、越权拦截、未登录拒绝、二维码真实生成、推荐流、视频详情、评论列表、QR 库分发、client bundle 加载与插槽注册。

## License

MIT
