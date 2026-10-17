# 壹梵定制：AcePanel 部署

本文面向 AcePanel + Nginx + Node.js 24 + MySQL 8.0+。项目由 Node 服务提供页面和 API，AcePanel 网站目录只用于反向代理，不能按 PHP 或纯静态站点部署。

## 1. 服务器、域名和运行环境

1. 在受支持的 Linux 服务器上按 AcePanel 官方方式安装面板。不要在同一服务器混装 aaPanel 或其他面板。
2. 安装 Nginx、MySQL 8.0 或更高版本和 Node.js 24。项目不支持 MariaDB、MySQL 5.7 或 SQLite。
3. 将正式域名解析到服务器，确定唯一正式地址，例如 `https://www.example.com`。云安全组和面板防火墙只开放 80、443；SSH 和面板入口限制管理来源，3001、3306 只允许本机或受信网络。
4. 在 AcePanel 的 Node.js/运行环境管理中选择 Node 24，并在面板终端确认：

```bash
node --version
npm --version
```

如果面板为不同 Node 版本提供别名或完整路径，项目配置、终端命令和进程启动器必须使用同一个 Node 24 可执行文件。

## 2. 创建 MySQL 空库

在 **数据库**中创建独立的 MySQL 空数据库：

| 项目 | 要求 |
| --- | --- |
| 数据库名 | 只用字母、数字、下划线，例如 `yifan_prod` |
| 字符集 | `utf8mb4` |
| 用户 | 单独的应用账号，例如 `yifan_app` |
| 来源 | 同机部署只允许本机来源 |
| 密码 | 随机强密码并单独备份 |

安装向导不能创建数据库，只能使用预先创建的空库。专用账号需要 `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP` 权限，不要使用 root：

```sql
CREATE DATABASE yifan_prod
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'yifan_app'@'127.0.0.1'
  IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON yifan_prod.* TO 'yifan_app'@'127.0.0.1';
```

面板已经创建数据库和账号时不要重复执行 SQL。若账号主机是 `localhost`，安装页主机值按实际连接方式填写；不要用全网 `%` 授权解决来源不匹配。

## 3. 上传项目和配置 `.env`

在 AcePanel 文件管理器建立项目目录，例如 `/opt/acepanel/projects/yifan-official`，上传并解压完整源码。项目根目录应直接包含 `package.json`、`server/`、`src/`、`shared/`、`public/` 和 `i18n/`。不要把该目录设置为 Nginx 静态根目录。

复制 `.env.example` 为 `.env`：

```dotenv
NODE_ENV=production
PORT=3001
APP_ORIGIN=https://www.example.com
YIFAN_DATA_DIR=/opt/acepanel/projects/yifan-official/data
TRUST_PROXY=1
SETTINGS_ENCRYPTION_KEY=
```

`APP_ORIGIN` 必须与访客使用的 HTTPS 根地址完全一致，不能有末尾 `/`、路径或查询参数。Nginx 在本机反代时使用 `TRUST_PROXY=1`；异机代理填写可信 IP/CIDR。留空加密密钥会在 `data/settings.key` 生成随机文件，必须和 `data/installation.json` 配套备份，安装后不要删除或替换。

将项目和 `data/` 的所有者设置为 AcePanel Node 项目的实际运行用户，`.env` 只允许应用用户读取，`data/` 只允许应用用户读写，不要使用 `777`。

## 4. 安装依赖和构建

在面板终端或 SSH 终端以运行用户进入项目根目录。若面板要求使用指定 Node 路径，替换下面的 `node` 和 `npm`：

```bash
cd /opt/acepanel/projects/yifan-official
node --version
npm ci --include=dev
npm run check
npm run build
chmod 600 .env
mkdir -p data
chmod 700 data
```

构建成功后检查 `dist/client` 和 `dist/server`，分别对应生产 SSR 页面和静态资源。开发依赖需要保留到构建完成。

## 5. 创建并守护 Node 应用

在 AcePanel 的 **Node.js 项目/应用管理**创建一个项目（菜单名称随版本可能不同）：

| 字段 | 值 |
| --- | --- |
| 工作目录 | `/opt/acepanel/projects/yifan-official` |
| 启动命令 | `npm start`，或面板选定 Node 的 `node server/index.mjs` |
| Node 版本 | Node.js 24 |
| 监听端口 | `3001` |
| 运行用户 | 与文件所有者相同 |
| 实例数 | `1`，fork/普通模式 |

如果 AcePanel 以 systemd 或进程管理器守护 Node，启用开机启动、崩溃重启和日志轮转。工作目录不能填写 `server/`；不要再创建第二个实例占用 3001。启动日志应出现 `YI FAN website ready`。

本机检查进程：

```bash
curl -fsS http://127.0.0.1:3001/api/health
```

首次安装前 `installed:false` 是正常结果。连接拒绝、502 或服务反复重启时先查看应用日志、Node 版本、工作目录、环境变量和端口占用。

## 6. Nginx 反向代理和 HTTPS

在 AcePanel 网站/代理管理中绑定正式域名，目标设置为 `http://127.0.0.1:3001`。如果面板提供 Node 应用域名映射，使用映射即可；不要同时配置一个代理站点和一个映射。

伪静态留空，移除 `index.php`、`try_files ... /index.html`、PHP 回退和把所有 404 改成首页的规则。页面、多语言 URL、`/api/` 和构建资源必须保持原路径代理。将下面片段放入实际生效的站点 Nginx 配置，已有同名 `location` 应修改原规则：

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

申请或导入 SSL 证书并开启 HTTP → HTTPS 跳转。`/api/events` 是客服 SSE，必须关闭缓冲、压缩和缓存并保留长连接；登录、后台、安装、支付回调等动态请求也不能缓存。Nginx 的 `X-Forwarded-For` 必须覆盖为真实客户端地址，不能直接信任访客传入的转发头。保存后先做配置检测再重载 Nginx。

## 7. 首次安装和安装后状态

1. 在 AcePanel 文件管理器读取实际 `YIFAN_DATA_DIR` 下的 `install.key`，不要通过 URL 暴露。
2. 打开 `https://www.example.com/install`，输入密钥。
3. 填写第 2 节的 MySQL 连接信息并点击核实。程序会实际检查 MySQL 8.0+、`utf8mb4`、空库以及建表、外键、索引、读写和删除权限。
4. 设置站点地址和首位管理员。站点地址必须与当前浏览器域名和 `APP_ORIGIN` 一致，管理员密码至少 12 位。
5. 完成后登录 `/admin`，配置真实服务、预约档期、联系方式和支付渠道。

再次打开 `/install` 时，页面必须只显示“网站已完成安装”和安装入口已锁定的说明，不再显示安装密钥、数据库或管理员表单。`GET /api/install/status` 应返回 `installed: true`，安装 POST 接口应拒绝并返回 409。数据库故障不会重新开放安装入口；不要删除 `data/installation.json` 重装生产站点。

## 8. 上线验收、备份和升级

```bash
curl -fsS https://www.example.com/api/health
curl -fsS https://www.example.com/api/install/status
```

在浏览器直接打开并刷新 `/install`、`/services`、`/community` 和帖子详情，检查 Vite 资源为 200、`/api/` 返回 JSON，`/api/events` 返回 `text/event-stream` 并持续心跳。外网不能访问 3001、3306、`.env`、`data/installation.json`、`server/` 或备份文件。

备份 MySQL、`.env`、`data/installation.json`、`data/settings.key`（或固定 `SETTINGS_ENCRYPTION_KEY`）及自有素材，备份放到公开目录之外并定期恢复演练。更新前停止 Node 应用并备份，保留 `.env`、`data/` 和密钥，使用 Node 24 执行 `npm ci --include=dev`、`npm run check`、`npm run build` 后启动原实例。涉及表结构的版本先在副本验证，升级不需要也不应重新运行 `/install`。

遇到 502/503 先看 AcePanel 项目日志和本机健康接口；页面资源 404 或 API 返回 HTML 时检查是否残留静态伪静态；数据库权限错误检查账号来源和 `REFERENCES` 权限；重启解密失败检查密钥与安装配置是否配套；客服消息延迟检查 SSE 的 `proxy_buffering off`、缓存和单实例设置。

