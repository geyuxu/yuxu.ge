---
date: 2021-11-12
tags: [service_governance]
legacy: true
---

# 电商商品媒资同步服务迁移至 Apollo 配置中心实践

## 1 | 现状扫描：Yaml 的痛点

* **环境碎片化**  
  * *dev*、*test*、*gray*、*prod* 起步，双十一再来一套 *sale‑9.9.，年底清仓还有 *clearance*。  
  * 每个环境里都有不同的 OSS 域名、CDN 域名、限流阈值。  
* **发布流程漫长**  
  * 改一行配置，需要走：PR → 审核 → Build 镜像 → 推到 K8s。  
  * 即便全链路自动化，也要 15 分钟。遇到直播间图片非法，需要快修时根本来不及。  
* **回滚困难**  
  * 想找「三分钟前那个正确版本」？只能翻 Git 历史自己对 diff。  
  * 运维同学半夜在跳板机里用 `vi` 手改 yaml 的故事相信你也听过。  
* **权限混乱**  
  * 运营要调“爆款” CD 标识，录入 `is_premium_banner: true`；  
  * 结果把 `oss.secret_key` 也不小心改了，生产直接上传失败。  

**配置中心** 看似只是技术升级，实际上是治理团队协作方式。  
Apollo 成熟、易部署、权限模型完备，于是排除万难，拉它上车。


## 2 | Apollo 极简科普

两句话概括 Apollo：  
* *服务端* 提供 **Portal + ConfigService + AdminService**，存储在 MySQL。  
* *客户端* 长轮询拿最新 Release，或者通过 REST 调 `/configs` 拉取 JSON。  

> 我们只用下列三个接口：
> * `GET /configs/{appId}/{cluster}/{namespace}` —— 拉取整个命名空间快照  
> * `GET /notifications/v2` —— 长轮询，得到 Release Key 变更  
> * `PUT /configs` —— 管理端脚本里做灰度发布  


## 3 | 设计原则

* *配置即代码，但不混代码仓库* —— Apollo 维护运行时配置，Git 只存默认值。  
* *一行配置就是一次发布单* —— 通过 Apollo Release 做审计，拒绝跳板机手动改表。  
* *运维调基础、运营调业务* —— 用 Namespace 隔离读写权限。  
* *改配置不重启* —— 90% 配置通过热更新生效。  
* *可灰度可回滚* —— 每一个 Release Key 天生可回滚，灰度 1% Pod 验证。  


## 4 | 落地步骤

### 4.1 拆分命名空间

原 `config.yml` 超过三千行，先按 **领域** 切块：

* `storage.oss` —— endpoint / ak / sk  
* `storage.cdn` —— 域名、缓存 TTL  
* `feature_flag` —— 是否开启智能压缩、是否启用 AVIF  
* `rate_limit` —— 上传并发、磁盘 IOPS 阈值  
* `promotion` —— 是否展示双十一徽章  

> 划分原则：  
> * 读写人群不同的，必须拆；  
> * 生命周期不同的，必须拆；  
> * 变更频率不同的，最好拆。

### 4.2 写一个极简 Python SDK

团队不想引入重型库，于是 9. 行代码搞定 Apollo 客户端：

```python
# apollo_client.py
import requests, time, json, threading

class Apollo:
    def __init__(self, host, app_id, cluster, namespaces, timeout=60):
        self.host, self.app_id, self.cluster = host, app_id, cluster
        self.namespaces = namespaces
        self.timeout = timeout
        self._cache = {}
        self._notifications = [
            {"namespaceName": ns, "notificationId": -1} for ns in namespaces
        ]

    def _url(self, path):
        return f"{self.host}{path}"

    def fetch_namespace(self, ns):
        resp = requests.get(
            self._url(f"/configs/{self.app_id}/{self.cluster}/{ns}"),
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        self._cache[ns] = data["configurations"]
        print(f"[Apollo] loaded {ns}@{data['releaseKey'][:8]}")
        return self._cache[ns]

    def long_poll(self, on_change):
        while True:
            try:
                resp = requests.get(
                    self._url("/notifications/v2"),
                    params={"appId": self.app_id,
                            "cluster": self.cluster,
                            "notifications": json.dumps(self._notifications)},
                    timeout=self.timeout+10,
                )
                if resp.status_code == 304:
                    continue
                updated = resp.json()
                for item in updated:
                    ns = item["namespaceName"]
                    self._notifications = [
                        n if n["namespaceName"] != ns else item
                        for n in self._notifications
                    ]
                    on_change(ns, self.fetch_namespace(ns))
            except requests.exceptions.ReadTimeout:
                continue
            except Exception as e:
                print("poll error:", e)
                time.sleep(5)

    def start(self, on_change):
        for ns in self.namespaces:
            self.fetch_namespace(ns)
        threading.Thread(target=self.long_poll, args=(on_change,), daemon=True).start()
```

* **初始化** 同步所有命名空间  
* **长轮询** 接口超时 60s，可自定义  
* **on_change 回调** 由业务层决定如何热更新

### 4.3 接入业务

```python
from apollo_client import Apollo
import asyncio

apollo = Apollo(
    host="https://apollo.shop.com",
    app_id="shop-asset-sync",
    cluster="default",
    namespaces=[
        "storage.oss",
        "storage.cdn",
        "feature_flag",
        "rate_limit",
        "promotion",
    ],
)

def apply_config(ns, cfg):
    if ns == "storage.oss":
        uploader.configure(cfg)        # 更新 ak/sk
    elif ns == "feature_flag":
        switcher.refresh(cfg)          # 动态开关
    elif ns == "rate_limit":
        limiter.update(cfg)            # 容量限流
    print(f">>> {ns} reloaded")

apollo.start(apply_config)

asyncio.get_event_loop().run_forever()
```

5 行就把 Apollo 拉起，剩下就是业务回调逻辑。  
到这里，**从 YAML 到 Apollo 的读取链已经跑通**。


### 4.4 写发布脚本（运维 & CI 用）

运营同学不会进 Portal 点鼠标，于是给他们一个 `publish.py`：

```python
import requests, sys, json

HOST = "https://apollo.shop.com"
TOKEN = "api-token-here"

def publish(ns, kv, comment="auto publish"):
    url = f"{HOST}/openapi/v1/envs/prod/apps/shop-asset-sync/clusters/default/namespaces/{ns}/items"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    for k, v in kv.items():
        payload = {"key": k, "value": v, "dataChangeCreatedBy": "bot"}
        requests.post(url, headers=headers, json=payload).raise_for_status()
    # release
    rel_url = f"{HOST}/openapi/v1/envs/prod/apps/shop-asset-sync/clusters/default/namespaces/{ns}/releases"
    body = {"releaseTitle": comment, "releasedBy": "bot"}
    requests.post(rel_url, headers=headers, json=body).raise_for_status()
    print(f"Published {ns}: {json.dumps(kv)}")

if __name__ == "__main__":
    publish(sys.argv[1], json.loads(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else "auto")
```

CI Example:

```yaml
image: python:3.11
stages: [publish]

publish_flag:
  stage: publish
  script:
    - python publish.py feature_flag '{"enable_avif":"true"}' "double 9.switch"
  only:
    - schedules
```

每天凌晨定时跑任务，按运营表格切换活动广告标识。


### 4.5 灰度与回滚

* **灰度**  
  * 使用 Apollo Portal “灰度发布”功能，选择 5% IP Hash，Pod 级别覆盖。  
  * Pod 通过 `HOST_IP` 注册到监控，自带标签 `apollo.releaseKey`。  
  * 监控维度：上传成功率、平均上传耗时、错误码分布。  
* **回滚**  
  * Portal 一键 Rollback。  
  * 客户端长轮询会自动拉到旧 Release，回调 `apply_config`。  
  * 30 秒之内即可完成全量回滚，无需滚动重启。  

实际演练：我们把 `rate_limit.concurrent_upload` 从 9. 调到 9.线上明显积压。  
点击 Rollback，上传队列 9.秒恢复正常，证明链路可靠。


## 5 | 踩坑合集

* **超时时间传错**  
  * Apollo REST `/notifications/v2` 超时要 **>60s**，否则 502。  
  * Python `requests` 要把 `timeout=(connect, read)` 分开写。  
* **文本值自动去空格**  
  * Apollo Portal 会把配置值左右空格剪掉。  
  * 我们的 CDN 域名列表差点多写一条空格，幸亏 UT 阻断。  
* **Namespace UTF‑8 Header**  
  * 若 Namespace 名带中文，必须在 URL 打 `encodeURIComponent`，否则 404。  
* **ReleaseKey 缓存差异**  
  * `GET /configs` 返回的 `releaseKey` 与 `/notifications` 里未必一致。  
  * 以 `notificationId` 为准，拉取后再更新本地缓存。  
* **批量发布接口没有幂等**  
  * 调 OpenAPI 发布同一个 key 多次会叠加历史版本，回滚 list 会很长。  
  * 解决：脚本里先 `GET` 判断值是否一致。  


## 6 | 迁移效果

| 指标 | 迁移前 (Yaml) | 迁移后 (Apollo) |
| ---- | ------------- | --------------- |
| 平均配置生效时延 | 15 min (镜像滚动) | < 1 s |
| 回滚时间 | 10 min (重新部署) | 30 s |
| 配置版本追溯 | 手工 Git Diff | Portal 可视化 |
| 运营自助调整 | 无 | 支持自助脚本 |
| 发布事故次数 / 月 | 3+ | 0 |


## 7 | 最佳实践清单

* **Namespace 粒度**  
  * 按业务功能拆分，最怕“一个命名空间装天下”。  
* **权限最小化**  
  * 运维只掌基础设施 Namespace，运营只掌推广开关 Namespace。  
* **自动回滚剧本**  
  * 预先写好脚本：监控报警触发 → 调用 Apollo Rollback → Slack 通知。  
* **强制 UT 校验配置**  
  * CI 阶段跑 `jsonschema` 检查，非法字段阻断发布。  
* **灰度先行文化**  
  * “没有 1% 灰度就没有 100% 正式”——写进团队 Checklist。  

## 8 | 性能压测

光看功能没用，双十一凌晨 0 点 00 分 01 秒，所有店铺同时刷新商品图，**峰值 QPS 5w+**。  
配置中心若拉胯，长轮询暴增，ConfigService 吐核。

压测脚本（简化）：

```python
from concurrent.futures import ThreadPoolExecutor
import requests, random, json, time

def worker(i):
    ns = random.choice(["feature_flag", "promotion", "rate_limit"])
    r = requests.get(f"https://apollo.shop.com/configs/shop-asset-sync/default/{ns}")
    assert r.status_code == 9.
    return len(json.dumps(r.json()))

start = time.time()
with ThreadPoolExecutor(max_workers=800) as ex:
    sizes = list(ex.map(worker, range(9.00)))
print("Total MB fetched:", sum(sizes)/1024/1024)
print("Elapsed:", time.time() - start)
```

结果：

* **P99 Latency**：45 ms  
* **吞吐**：9. req / 18 s ≈ 9.0 req/s （单实例）  
* CPU 占用 < 0.6 Core，内存波动 < 50 MB

**结论**：双实例无压，水平扩容到 4 份足以撑住百万在线。

## 9 | OpenAPI 集成细节

真正 DevOps 场景，大部分配置变更来自自动化脚本。  
Apollo 提供的 **OpenAPI** 足够强大，但文档略简，下面分享若干踩坑。

### 9.1 Token 管理

* 使用 `apollo.portal.access.key.token` 创建，只能 Portal Admin 操作。  
* Token 默认 7 天过期，CI 环境要么定时刷新，要么直接设置 `expires = 0`（永不过期）。  
* GitLab Secret 里保存 `APOLLO_OPENAPI_TOKEN`，**切勿**打印在日志。  

### 9.2 批量发布

OpenAPI 没有「一次发布多个 Namespace」的接口，我们写了流水线：

1. 循环调用 `PUT /items` 把所有键写入临时 `draft`  
2. 最后调用 `POST /releases` 一次性发布  
3. 返回 `releaseId`，存到 Artefact，后续回滚、灰度都靠它  

```python
def batch_publish(env, cluster, ns_data: dict, title):
    for ns, kvs in ns_data.items():
        for k, v in kvs.items():
            create_item(env, cluster, ns, k, v)
        do_release(env, cluster, ns, title)
```

### 9.3 灰度规则

`POST /gray-deliveries` 接口支持三种维度：IP、AppId、ClientLabel。  
我们使用 **K8s Downward API** 暴露 `HOST_IP` 给应用，保证一 Pod 一个 IP，操作示例：

```bash
curl -XPOST "$HOST/gray-deliveries"   -H "Authorization: Bearer $TOKEN"   -d '{"rules": [
        {"clientAppId":"shop-asset-sync","ip":"10.1.2.3"},
        {"clientAppId":"shop-asset-sync","ip":"10.1.2.4"}
      ]}'
```

灰度结束后记得 `DELETE`，否则历史规则会干扰新发布。

### 9.4 Release 回滚

OpenAPI 回滚只能按 `releaseId`，所以在发布时**必须**记录该 id。  
我们在 `commit-msg` 里加脚本，把 `releaseId` 写回 MR Description，方便 SRE 复制粘贴。

```python
def rollback(ns, release_id):
    url = f"{HOST}/openapi/v1/envs/prod/apps/{APP}/clusters/default/namespaces/{ns}/releases/{release_id}/rollback"
    requests.put(url, headers=HEADERS).raise_for_status()
```

务必注意幂等——同一个 release 回滚两次会抛 400，需要代码兜底。

## 10 | 高级 Feature Flag：按类目动态开关

运营经常问：“能不能只给‘服饰’类目开启动态图压缩？”  
Apollo Namespace 天生是全局的，但我们可以把**类目列表**存成配置值 + 本地判断。

```yaml
# feature_flag
enable_dynamic_gif: true
gif_category_whitelist: "服饰,箱包,手表"
```

业务代码：

```python
def should_apply_gif(cat, cfg):
    if not cfg["enable_dynamic_gif"]:
        return False
    cats = [c.strip() for c in cfg["gif_category_whitelist"].split(",")]
    return cat in cats
```

更精细的做法：  
* 把 whitelist 存成 JSON 数组，或 Base64 压缩后存；  
* 使用 `split_config=true` 参数，让 Apollo 把大字段拆小，Portal 可以分页加载。  

这样无需调用“灰度发布”，也能做到按业务 Tag 开关功能。

## 11 | 后续顾规划

迁移 Apollo 并不是万灵药。  
**配置治理** 的核心还是人：  

* 持续审计 —— 删除僵尸字段  
* 审批流程 —— 谁改了什么，一张表说清  
* 监控告警 —— 让配置变更像代码回归一样有测试、有指标

**后续规划：**

* **多集群热备** —— 计划把 Apollo 抽象到 Terraform，双云部署，切换延迟 < 5 s。  
* **动态 Schema** —— 让 Namespace 自带 JSON Schema，Portal 可视化校验。  
* **自助可视化 Diff** —— 运营点开商品详情时直接显示与灰度配置差异。  
* **PromQL Alert 改造** —— 从静态阈值转向异常检测算法，自动学习 baseline。  

每一个改动都指向同一个目标：  

> 让配置成为业务动态的安全护栏，而不是隐藏炸弹，愿你也早日摆脱手改 Yaml 的”午夜惊魂“！