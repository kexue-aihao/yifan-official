# 壹梵定制 YI FAN

Next.js App Router / React 19 / TypeScript / Motion 前端，Express 5 / Node.js 24 / MySQL 8.0+ 后端。支持婚纱摄影、生日布置、服装写真、婚纱租赁、化妆造型及男女生 Cosplay，包含登录后预约、Epay 订金、实时客服、180 天会话留存、社区及管理后台。

通过 next-intl 提供简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语、巴西葡萄牙语、俄语和阿拉伯语。页头及安装向导可切换语言，支持浏览器语言识别与一年期语言 Cookie。中文默认网址保持 `/services`，其他语言使用 `/en/services`、`/ar/services` 等路径；API 始终使用 `/api`。支持 ICU 复数、Intl 数字/人民币/上海时区日期以及阿拉伯语 RTL。自定义业务内容保持原文。维护说明见本地 `docs/local/i18n.md`。

顾客预约显示工作人员是否已查看及首次查看时间，客服消息显示已发送或工作人员已读。管理员打开预约详情、在前台窗口看到对应消息后才记录回执，单独加载列表不计已读；状态通过 SSE 同步。已安装网站启动时自动新增回执表，保留历史数据，历史记录默认未读，无需重新安装。

## 首次安装

1. 准备 Node.js 24 和 MySQL 8.0+。**在部署前创建独立的空数据库**及专用账号；数据库字符集必须为 utf8mb4。应用不会创建数据库。
2. `npm install`，复制 `.env.example` 为 `.env`，设置访问地址 `APP_ORIGIN`。
3. 开发运行 `npm run dev`，访问 http://localhost:5173/install。生产运行方式见下文。
4. 从服务器 `data/install.key` 读取首次安装密钥，在安装页输入。
5. 输入 MySQL 主机、端口、已创建的库名、用户名和密码。可启用验证服务器证书的 TLS。服务器实际连接核实库名、版本、字符集及创建/索引/读写/删除权限；校验通过才能进入下一步。
6. 设置站点地址与管理员账号，完成安装。服务器再次校验后创建业务表、初始化服务、保存加密连接配置，并锁定安装入口。
7. 管理员登录后访问 `/admin`，配置实际套餐、档期、联系信息及 Epay 商户。

数据库准备示例（在 MySQL 管理工具执行，替换用户名、来源主机及密码）：

```sql
CREATE DATABASE yifan CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'yifan'@'localhost' IDENTIFIED BY '请替换为独立数据库密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
ON yifan.* TO 'yifan'@'localhost';
```

容器或远程部署需将账号来源改为应用服务器实际来源。不要在安装页填 MySQL 管理账号。已有数据的库会被拒绝，不会被覆盖。

## 生产运行

设置 `NODE_ENV=production`、`APP_ORIGIN=https://你的域名`（无末尾斜杠）、`PORT=3001`、`YIFAN_DATA_DIR=./data`。在受信的单层 HTTPS 反向代理后设置 `TRUST_PROXY=1`。

```powershell
npm run build
npm start
```

Node 同时提供 Next.js 页面与 API。将正式域名 HTTPS 转发到 3001，再打开 `https://你的域名/install`。SSE 路由 `/api/events` 需关闭代理缓冲、保留长连接。

`data/installation.json` 保存加密 MySQL 连接配置，`data/settings.key` 为自动生成的加密密钥。也可在首次启动前设置固定的 64 位十六进制 `SETTINGS_ENCRYPTION_KEY`。**将配置文件、密钥与 MySQL 数据配套备份，安装后不可随意更换密钥。** 数据目录必须可写且不能作为静态目录对外提供。数据库短暂故障不会重新开放安装。

Dockerfile 使用 Next.js 构建产物，运行时挂载 `/app/data` 并连接事先创建的外部 MySQL。当前环境没有 Docker，未执行镜像部署验证。

初始管理员在安装页创建。后续可运行 `npm run admin:create` 添加独立管理员；不会将已存在的普通账号提权。

## 验证

```powershell
npm run check
npm run build
npm test
npm run test:ui
```

测试使用真实 MySQL，默认连接独立的 `127.0.0.1:3317`；可通过 `MYSQL_TEST_HOST/PORT/USER/PASSWORD` 配置。测试账号需要创建/删除测试数据库和测试用户的权限，只应使用独立测试实例。每次创建随机 `yf_test_*` 数据库并在结束后删除，不使用运营数据库。浏览器测试使用本机 Chrome，可设置 `PLAYWRIGHT_CHANNEL=msedge`；需先构建 Next.js。截图保存在本地 `artifacts/`。

## 文档与营业配置

完整 API / OpenAPI、数据库安装与部署说明、网站设计计划、Skill 清单均位于 **docs/local/**。该目录及 artifacts/ 通过本仓库 .git/info/exclude 本地排除，按要求不提交。

图片为 Unsplash 风格示意，价格为示例；正式营业前在后台设置实际资料并替换有权使用的影像。Epay 兼容传统 submit.php / MD5 协议；回调验签和金额校验已实现，正式收款仍需实际商户联调。退款为人工处理。

私有预约/客服消息按单条创建时间保留 180 天，启动及每小时清理，查询同时过滤过期记录。备份也应配置相应生命周期；订单财务资料和公开社区内容单独管理。旧版 SQLite 文件不会被程序读取或删除；若已有正式业务数据，应另行执行数据迁移。
