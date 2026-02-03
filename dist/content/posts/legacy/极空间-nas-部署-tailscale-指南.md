---
date: 2024-01-01
tags: [快速笔记]
legacy: true
---

# 极空间 NAS 部署 Tailscale 指南

## 1. 准备工作
* 登录 [Tailscale 网页控制台](https://login.tailscale.com/admin/settings/keys)。
* 生成 **Auth Key**：
    * 勾选 **Reusable** (可复用)
    * 勾选 **Ephemeral** (非临时/长期有效)
    * 勾选 **Pre-approved**
* 复制以 `tskey-auth-` 开头的密钥备用。

## 2. 极空间 Docker 部署 (图形界面法)
**步骤一：下载镜像**
* 极空间 Docker -> 镜像 -> 仓库 -> 搜索 `tailscale` -> 下载 `tailscale/tailscale`。

**步骤二：创建并配置容器 (关键)**
选中镜像点击“添加容器”，修改以下 4 项：

1.  **文件夹路径** (解决 invalid volume path 报错)：
    * 本地路径：手动新建或选择一个文件夹 (如 `/Docker/tailscale`)
    * 装载路径：手动填写 `/var/lib/tailscale`
2.  **网络**：
    * 修改为 **Host** 模式 (必须，否则无法做网关)。
3.  **环境**：
    * 添加变量名：`TS_AUTHKEY`
    * 添加变量值：粘贴你复制的 Key。
4.  **能力/权限**：
    * **必须勾选** “以特权模式运行” (或“高权限”)，否则无法启动。

## 3. 验证与进阶
* **启动容器**：查看状态是否为“运行中”。
* **验证**：手机/电脑打开 Tailscale，查看是否有新设备 (如 `zspace-nas`) 上线。
* **进阶 (可选)**：
    * **子网路由 (访问内网其他设备)**：在“环境”中添加 `TS_ROUTES=192.168.x.0/24` (替换为你路由器的网段)。
    * **密钥不过期**：在 Tailscale 网页控制台 -> Machines -> 点击设备右侧三个点 -> Disable Key Expiry。