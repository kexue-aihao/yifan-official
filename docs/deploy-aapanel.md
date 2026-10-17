# 壹梵定制：aaPanel 部署

本文面向 aaPanel + Nginx + Node.js 24 + MySQL 8.0+。项目是 Node 服务，aaPanel 网站根目录不要直接指向源码目录，也不要按 PHP、WordPress 或纯静态 SPA 配置伪静态。

## 1. 准备面板、域名和端口

1. 在受支持的 Linux 服务器上安装 aaPanel，并安装 Nginx、MySQL 8.0 或更高版本和 Node.js 24。项目不支持 MariaDB、MySQL 5.7 或 SQLite。
2. 将正式域名的 A/AAAA 记录指向服务器。选择一个正式访问地址，例如 `https://www.example.com`，裸域可另行跳转到该地址。
3. 云安全组和面板防火墙只放行 80、443；SSH 和面板入口限制为管理来源。3001、3306 不应对公网开放。
4. 在 **Website → Node Project** 使用 Node.js 版本管理器安装并选中 Node 24。面板终端和项目进程必须使用同一版本。

```bash
node --version
npm --version
```

输出的 Node 主版本应为 24。若终端找不到 `node`，先在版本管理器设置命令行版本，再重新打开终端。

## 2. 创建空 MySQL 数据库

在 **Databases → MySQL → Add DB** 创建独立的空库。建议填写：

| 项目 | 要求 |
| --- | --- |
| 数据库名 | 只用字母、数字、下划线，例如 `yifan_prod` |
| 字符集 | `utf8mb4`，不要使用 `utf8` |
| 用户 | 单独的应用账号，例如 `yifan_app` |
| 主机权限 | 同机部署选择本机，不要选择所有来源 |
| 密码 | 随机强密码，单独保存 |

安装页只填写这个专用账号，不要使用 MySQL root。账号需要访问该库并拥有 `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP` 权限。面板建库和以下 SQL 二选一：

```sql
CREATE DATABASE yifan_prod
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'yifan_app'@'127.0.0.1'
  IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON yifan_prod.* TO 'yifan_app'@'127.0.0.1';
```

如果面板创建的用户主机是 `localhost`，安装页数据库主机也应按面板实际连接方式填写；不要通过改成 `%` 来绕过授权问题。数据库必须保持为空，业务表由 `/install` 创建。

## 3. 上传源码和配置环境

在 **Files** 创建项目目录，例如 `/www/projects/yifan-official`，上传完整源码并解压。项目根目录应直接包含 `package.json`、`server/`、`src/`、`shared/`、`public/` 和 `i18n/`。不要把 `.env`、`data/` 或源码目录设置为公开静态根目录。

复制 `.env.example` 为项目根 `.env`，按正式域名修改：

```dotenv
NODE_ENV=production
PORT=3001
APP_ORIGIN=https://www.example.com
YIFAN_DATA_DIR=/www/projects/yifan-official/data
TRUST_PROXY=1
SETTINGS_ENCRYPTION_KEY=
```

`APP_ORIGIN` 必须是完整的 HTTPS 根地址，不能有末尾 `/`、路径或查询参数。`TRUST_PROXY=1` 只适用于 Nginx 从 `127.0.0.1` 或 `::1` 代理到 Node；异机代理应填写 Node 实际看到的可信代理 IP/CIDR。留空 `SETTINGS_ENCRYPTION_KEY` 时，应用会在 `data/settings.key` 生成密钥；安装后必须与 `data/installation.json` 一起备份，不能随意更换。

将源码、依赖和 `data/` 的所有者统一为实际运行用户（常见为 `www:www`），不要使用 `777`。`.env` 应只允许应用用户读取，`data/` 应只允许应用用户读写。

## 4. 安装依赖和构建

在 aaPanel 终端以应用运行用户进入项目根目录：

```bash
cd /www/projects/yifan-official
npm ci --include=dev
npm run check
npm run build
chmod 600 .env
mkdir -p data
chmod 700 data
```

构建成功后应存在 `dist/client` 和 `dist/server`。即使运行环境为 production，构建仍需要 TypeScript、Vite 等开发依赖，因此不能先使用 `npm ci --omit=dev`。

## 5. 创建 Node 项目并守护进程

在 **Website → Node Project → Add project**（不同版本可能显示 Node.js Project）填写：

| 字段 | 值 |
| --- | --- |
| 项目路径/工作目录 | `/www/projects/yifan-official` |
| 启动命令 | `npm start` |
| Node 版本 | Node.js 24 |
| 监听端口 | `3001` |
| 运行用户 | 与文件所有者相同 |
| 实例数 | `1`，fork/普通模式 |

启动后在项目日志中确认 `YI FAN website ready`，并启用面板的开机启动和异常重启。不要同时用普通 Node 项目和 PM2 项目占用 3001。若选择 aaPanel PM2 模式，入口可以是 `server/index.mjs`，工作目录仍必须是项目根目录，实例数保持 1。

服务器本机先检查：

```bash
curl -fsS http://127.0.0.1:3001/api/health
```

首次安装前返回中的 `installed` 应为 `false`。连接拒绝或 502 时先看 Node 项目日志和端口占用。

## 6. 配置网站、反向代理和 HTTPS

在 Node 项目的域名管理中绑定正式域名并映射到 3001；如果当前 aaPanel 版本没有映射功能，则创建 **Proxy Project** 指向 `http://127.0.0.1:3001`。两种方式只选一种。

伪静态留空，删除遗留的 `index.php`、`try_files ... /index.html` 或将 404 改写到首页的规则。项目页面、Vite 资源、`/api/` 和多语言路径都必须原样代理到 Node。

在站点 SSL 中申请或导入证书、开启强制 HTTPS，并在实际生效的 Nginx 代理配置中使用以下指令。若面板自动生成同名 `location`，请修改原规则而不是重复添加：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Connection "";
    proxy_cache off;
    proxy_connect_timeout 10s;
    proxy_read_timeout 90s;
    proxy_send_timeout 90s;
}

location = /api/events {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_connect_timeout 10s;
    proxy_read_timeout 90s;
    proxy_send_timeout 90s;
}
```

`/api/events` 是客服 SSE 长连接，必须关闭代理缓冲、缓存和压缩。动态页面、登录、后台、安装接口和支付回调不要配置 CDN 或 Nginx 缓存。面板保存后先执行配置检测，再重载 Nginx。3001 只允许本机代理访问。

## 7. 首次 `/install` 安装

1. 在 aaPanel 文件管理器中读取实际 `YIFAN_DATA_DIR` 下的 `install.key`，不要将该文件放到网站目录或发送给访客。
2. 打开 `https://www.example.com/install`，输入安装密钥。
3. 输入第 2 节创建的 MySQL 主机、端口、库名、用户名和密码。程序会检查 MySQL 8.0+、`utf8mb4`、空库及建表、索引、读写、删除和外键权限。
4. 通过核实后设置站点地址、首位管理员称呼、邮箱和至少 12 位管理员密码。站点地址必须与当前 HTTPS 域名及 `APP_ORIGIN` 一致。
5. 完成安装后登录 `/admin`，设置真实服务、档期、联系资料和支付渠道。

安装完成后再次访问 `/install`，页面应只显示“网站已完成安装”和安装入口已锁定的说明，不再显示安装密钥、数据库或管理员配置表单。`GET /api/install/status` 应返回 `installed: true`；再次提交安装接口应返回 409。不要删除 `data/installation.json` 来重装生产站点。

## 8. 验收、备份和更新

上线前检查：

```bash
curl -fsS https://www.example.com/api/health
curl -fsS https://www.example.com/api/install/status
```

直接打开并刷新 `/install`、`/services`、`/community` 和一条帖子详情，确认不是 Nginx 404、首页回退或资源 MIME 错误；浏览器 Network 中 `/api/events` 应为 `text/event-stream` 并持续收到心跳。外网应无法访问 3001、3306、`.env`、`data/installation.json` 和源码文件。

定期备份 MySQL、`.env`、`data/installation.json`、`data/settings.key`（或固定的 `SETTINGS_ENCRYPTION_KEY`）和自有素材，备份放在公开目录之外并演练恢复。更新时先停 Node 项目并备份，保留 `.env`、`data/` 和密钥，在同一项目目录执行 `npm ci --include=dev`、`npm run check`、`npm run build`，再启动原项目实例。涉及数据库结构的版本须先在副本验证，不能重新运行 `/install`。

常见排查顺序：502/503 看 Node 日志、端口和本机健康接口；资源 404 或 API 返回 HTML 看是否有静态伪静态规则；数据库权限错误看账号主机和 `REFERENCES` 等权限；重启后无法解密看 `settings.key` 与安装配置是否配套；SSE 延迟看 `proxy_buffering off`、缓存和是否误启多实例。

