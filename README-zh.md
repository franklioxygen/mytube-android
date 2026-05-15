# MyTube Android 客户端

[MyTube](https://github.com/franklioxygen/mytube) 的 Android 客户端 —— 自托管的视频库，支持 YouTube、Bilibili、Twitch、MissAV 以及其他 [yt-dlp 支持的站点](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)。在手机或平板上浏览收藏集、管理下载、追踪订阅。

基于 React Native 构建,需连接您自托管的 MyTube 后端。

[English](README.md)

---

## 主要功能

- **浏览与播放**：访问您的 MyTube 媒体库,支持评分、播放计数与续播位置。
- **搜索与筛选**:按来源、作者、标签、收藏集筛选视频。
- **收藏集管理**:创建、添加、移除与删除收藏集。
- **订阅追踪**:查看已订阅的 YouTube/Bilibili/Twitch 频道正在自动下载的内容。
- **下载状态**:查看待处理、进行中与历史下载任务。
- **流畅的播放器**:支持字幕、循环、全屏与变速播放。
- **登录保护**:支持 MyTube 的管理员/访客密码以及 Passkey。
- **平板适配**:针对大屏设备优化,带有侧边菜单布局。

---

## 系统要求

安装前需准备:

1. **一台 Android 设备**,运行 Android 7.0 (Nougat, API 24) 或更高版本。
2. **一个可访问的 MyTube 后端**。请参考 [MyTube 安装指南](https://github.com/franklioxygen/mytube/blob/master/README-zh.md) 部署后端(推荐使用 Docker)。
3. **后端的访问地址 URL** —— 可以是 HTTPS 公网地址(例如通过 [Cloudflare Tunnel](https://github.com/franklioxygen/mytube/blob/master/README-zh.md),MyTube 内置该功能),或局域网地址如 `http://192.168.1.50:5551`(仅在家庭网络中使用)。

> **建议:** 如果使用 MyTube 内置的 Cloudflare Tunnel,可以免费获得一个形如 `https://mytube.example.com` 的 HTTPS 地址,在任何网络环境下均可访问。这是离开家庭 Wi-Fi 后使用本 App 最简单的方案。

---

## 安装

1. 从 [Releases 页面](https://github.com/franklioxygen/mytube-android/releases) 下载最新 APK。
2. 在 Android 设备上打开该文件并点击**安装**。可能需要在系统设置中允许浏览器或文件管理器从未知来源安装应用。
3. 在应用列表中打开 **MyTube**。

> 目前未发布到 Google Play。仅通过侧载已签名的 APK 进行分发。

---

## 首次配置 —— 连接到 MyTube 后端

首次启动时会看到 **后端 URL** 配置页面,这是将应用指向您的 MyTube 服务器的入口。

1. 输入您的 MyTube 后端 URL。
   - **HTTPS 公网地址**(推荐):`https://mytube.example.com`
   - **局域网地址**:`http://192.168.1.50:5551`(替换为您服务器的 LAN IP 与端口)
   - **不要**在末尾添加 `/api` —— 应用会自动追加。
2. 点击**测试连接**。出现绿色对勾表示服务器可达。
3. 点击**保存**。若 MyTube 启用了登录保护,会跳转到登录页面;否则直接进入媒体库。
4. 使用 MyTube 设置中配置的管理员或访客密码登录,或使用已注册的 Passkey。

URL 保存在设备本地,之后不会再看到此页面,除非清除应用数据。

---

## 文档

- [安装指南](documents/setup.md) —— 安装 App 与连接 MyTube 的完整步骤(英文)。
- [从源码构建](documents/build-from-source.md) —— 面向开发者与贡献者(英文)。
- [常见问题](documents/troubleshooting.md) —— 已知问题与解决方案(英文)。

---

## 从源码构建

如果您希望自行构建 APK 或参与贡献:

```sh
git clone https://github.com/franklioxygen/mytube-android.git
cd mytube-android
npm install
npm run android   # 启动 Metro 并在已连接的设备/模拟器上安装
```

完整的环境准备(Node、JDK 21、Android SDK)、每台机器的本地配置(为 Android Studio 启动场景设置 `nodeBinary` Gradle 属性),以及发布版 APK 的打包方式,请参考 [documents/build-from-source.md](documents/build-from-source.md)。

---

## 相关项目

- **[MyTube](https://github.com/franklioxygen/mytube)** —— 本 App 所连接的后端 + Web 前端。自托管、支持 Docker、开源。
- **[MyTube Chrome 扩展](https://github.com/franklioxygen/mytube/tree/master/chrome-extension)** —— 在任意浏览器标签页中将视频加入下载队列。

## 许可证

详见仓库根目录的 [LICENSE](LICENSE) 文件。
