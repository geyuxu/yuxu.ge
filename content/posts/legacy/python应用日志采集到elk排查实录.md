---
date: 2022-03-25
tags: [devops]
legacy: true
---

# Python应用日志采集到ELK排查实录

* 「文件有 – ES 无」= 中间 Filebeat / Logstash 链路有问题  
* 先看 Filebeat 是否 **“看见”** 文件  
* 再看 Logstash 是否 **“接到”** 事件  
* 最后看 Elasticsearch 是否 **“收录”** 索引

# 排查过程

## 1. 验证 Filebeat `inputs`

```yaml
filebeat.inputs:
  - type: log
    paths:
      - /var/log/my_service/*.log
    fields:
      project: my_service
```

* 实际服务器日志目录是 `/var/log/my_service-neo/`  
* 采集规则却写死为 `my_service` → **路径失配**

## 2. 临时软链压测

```bash
ln -s /var/log/my_service-neo /var/log/my_service
```

* 软链一创建，Kibana 中立刻出现日志 → 路径就是元凶  
* 证明 Filebeat、Logstash、ES 本身都没毛病

## 3. 溯源“后缀 -neo”

* Python 服务的工程名在 `settings.py` 里手动改过  
  ```python
  SERVICE_NAME = "my_service-neo"
  ```
* 部署流水线和 Filebeat 规则却还是历史名 `my_service`

> **工程名改动** 如果没同步到所有配置，就一定埋雷。

# 根因分析

* 单节点可写日志 → Python `logging` 配置 OK  
* Filebeat 不认路径 → 采集规则老化  
* 上游自动化脚本、K8s ConfigMap 同样硬编码了旧路径

# 解决方案

* **方案 A：回滚工程名**  
  * 简单粗暴，但需要全量回退 Tag、镜像仓库名，不推荐
* **方案 B：升级采集规则** ✅  
  * 把 Filebeat、Logstash、自定义监控统统改为新工程名  
  * 全链路保持单一真名

下文以方案 B 为例。

## Python 端结构化日志

```python
import logging
import logging.config
import json_log_formatter

formatter = json_log_formatter.JSONFormatter()

LOG_CONFIG = {
    "version": 1,
    "formatters": {
        "json": {
            "class": "json_log_formatter.JSONFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s"
        }
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": "/var/log/my_service-neo/app.log",
            "when": "midnight",
            "backupCount": 7,
            "formatter": "json"
        }
    },
    "root": {
        "handlers": ["file"],
        "level": "INFO"
    }
}

logging.config.dictConfig(LOG_CONFIG)
logger = logging.getLogger(__name__)

logger.info({"event": "service_start", "version": "1.2.3"})
```

* 使用 `json_log_formatter` 把日志变成纯 JSON，Filebeat 解析无痛  
* `filename` 含新工程名 `my_service-neo`

## Filebeat 动态拾取

```yaml
filebeat.autodiscover:
  providers:
    - type: kubernetes
      hints.enabled: true
      templates:
        - condition:
            equals:
              kubernetes.labels.app: my_service-neo
          config:
            - type: log
              paths:
                - /var/log/my_service-neo/*.log
              json.keys_under_root: true
              json.add_error_key: true
```

* 只要 Pod 有 `app=my_service-neo` 标签，日志就能被采集  
* 彻底去掉硬编码

## 日志落 ES

* Logstash 保持 `json` codec，按日期走 ILM  
* Elasticsearch 索引命名：`my_service-neo-%{+yyyy.MM.dd}`  
* Kibana Saved Search 更新索引模式即可

# 经验总结

* **工程名/路径改动要全链路跟**  
* **日志用 JSON**，字段少但结构稳  
* **Filebeat 用 Autodiscover**，避免人肉维护 YAML  
* **监控采集量**：Filebeat `event.published_time` 有助观察丢包  
* **变更前加预案**：灰度验证 + 手动链路压测是最快的保险