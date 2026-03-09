# 人选天选论 · 前端

基于 Taro + React + TypeScript 的跨平台H5应用。

## 技术栈

- **框架**: Taro 3.6 + React 18
- **语言**: TypeScript
- **样式**: SCSS
- **状态管理**: Zustand
- **加密**: Web Crypto API (PBKDF2 + AES-256-GCM)
- **PWA**: Service Worker + Web App Manifest

## 项目结构

```
src/
├── app.ts                    # 应用入口
├── app.config.ts             # 路由配置
├── app.scss                  # 全局样式（配色、动画）
├── assets/                   # 静态资源
│   ├── icons/                # Tab图标
│   ├── manifest.json         # PWA配置
│   └── sw.js                 # Service Worker
├── pages/
│   ├── index/                # 首页（路由分发）
│   ├── onboarding/           # 新用户引导（3屏）
│   ├── login/                # 登录（手机号+验证码）
│   ├── pin-setup/            # PIN码设置（4位加密密码）
│   ├── articles/             # 文章列表
│   ├── article-detail/       # 文章详情
│   ├── diary/                # 道痕日记（7层引导式写作）
│   ├── diary-history/        # 日记历史列表
│   ├── diary-detail/         # 日记详情（解密查看）
│   ├── riverbed/             # 石头收藏馆（Canvas河床）
│   ├── calendar/             # 河水日历（打卡）
│   ├── share/                # 分享卡片生成
│   └── profile/              # 个人中心
├── store/                    # Zustand状态管理
└── utils/
    ├── request.ts            # API请求封装
    └── crypto.ts             # 端到端加密工具
```

## 开发

```bash
# 安装依赖
npm install

# H5开发模式
npm run dev:h5

# H5构建
npm run build:h5

# 微信小程序开发模式（未来）
npm run dev:weapp
```

## 配色方案

| 色名 | 色值 | 用途 |
|------|------|------|
| 宣纸白 | #F7F4ED | 主背景 |
| 黛青 | #3A4A5C | 主题色 |
| 朱砂 | #C84B31 | 强调色 |
| 松石绿 | #5B8C7A | 成就色 |
| 赭石 | #8B6F4E | 石头色 |
| 玄墨 | #2C2C2C | 主文字 |

## 加密方案

用户日记采用端到端加密：
1. 用户设置4位PIN码
2. 通过PBKDF2（10万次迭代+随机盐）派生AES-256密钥
3. 使用AES-256-GCM加密日记内容
4. 服务器只存储密文，无法解密
