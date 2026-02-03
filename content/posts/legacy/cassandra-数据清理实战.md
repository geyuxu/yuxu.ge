---
date: 2022-02-24
tags: [search]
legacy: true
---

# Cassandra 数据清理实战

针对上述问题，我们设计了一套数据清理方案，主要步骤如下：
1.	导出全部商品ID：从Cassandra中导出商品数据表的所有商品ID，形成全量ID列表文件。
2.	获取有效商品ID列表：从业务系统获取当前仍有效（在售/有效）商品的ID列表，作为比对的权威数据源。
3.	筛选无效商品ID：将全量ID列表与有效ID列表进行比对，找出其中无效的商品ID（即在Cassandra中存在但已失效的ID）。
4.	批量删除无效数据：通过编写脚本，批量删除Cassandra中这些无效商品ID对应的数据记录。
5.	验证清理效果：清理完成后，重新检查数据量或抽检特定商品ID，确保无效数据已被删除干净。

以上流程可以概括为：数据导出 -> 有效ID获取 -> 无效ID筛选 -> 批量删除 -> 结果验证。下面将对各步骤进行具体介绍，并给出相应的操作示例和Python脚本实现。

## 数据导出：导出Cassandra商品ID

清理的第一步是获取当前Cassandra中存储的所有商品ID列表。假设商品数据表名为 products，我们只需导出该表的主键ID列即可。

我们可以使用Cassandra自带的cqlsh提供的COPY命令导出数据。为了应对数千万行的数据量，导出前可以适当提高超时时间。例如，在命令行执行：
```sh
$ cqlsh --request-timeout=600000 <cassandra_host>
cqlsh> USE product_keyspace;
cqlsh:product_keyspace> COPY products(id) TO '/tmp/products_ids.csv' WITH HEADER = false;
```
上述命令将 products 表的id列全部导出到服务器临时目录下的CSV文件中（不包含表头）。由于数据量巨大，实际导出数千万行ID耗时约十余分钟。导出完成后，我们通过scp将文件拷贝到本地处理，例如：
```sh
$ scp user@<cassandra_server>:/tmp/products_ids.csv ./products_ids.csv
```
这样，我们在本地得到一个包含所有商品ID的文件products_ids.csv.

## 获取有效商品ID列表

第二步是获取当前有效商品ID列表，作为判定无效数据的依据。通常，这个列表可以来自于电商业务的商品中心或相关服务。例如，我们可以通过调用公司内部的商品服务接口获取所有在线商品的ID列表。假设有一个内部API可返回JSON格式的商品ID数组，我们使用curl调用并将结果保存到文件：

```sh
$ curl "http://internal.api.company/active_products" -H "Content-Type: application/json" -d '{"pageSize":10000,"currentPage":1}' -o active_products.json
```

接口返回的JSON结果可能需要进行简单处理，例如提取出其中的商品ID字段并保存为文本文件valid_ids.txt，每行一个ID。经过以上处理，我们得到valid_ids.txt，内含当前所有有效商品的ID。

## 筛选无效商品ID

有了Cassandra导出的全量ID列表和业务侧提供的有效ID列表，我们就可以对比找出无效的商品ID。无效ID即出现在Cassandra中但不在有效列表中的那些ID。

我们使用Python脚本进行筛选：先将有效商品ID加载到内存集合，随后逐行扫描全量ID文件，若某ID不在有效集合中，则将其视为无效并输出到待删除列表。示例脚本如下：
```py
# load valid ids into a set for fast lookup
valid_ids = set()
with open('valid_ids.txt', 'r') as f:
    for line in f:
        vid = line.strip()
        if vid:
            valid_ids.add(vid)

# iterate over all exported IDs and filter
count = 0
with open('products_ids.csv', 'r') as f_all, open('garbage_ids.txt', 'w') as f_out:
    for line in f_all:
        pid = line.strip()
        if not pid:
            continue
        if pid not in valid_ids:
            f_out.write(pid + "\n")
            count += 1

f_out.close()
print("无效商品ID数量:", count)
```

上述脚本逐行读取products_ids.csv，判断ID是否在valid_ids集合中。如果不在，则将该ID写入输出文件garbage_ids.txt。脚本结束后，garbage_ids.txt即包含所有需要从Cassandra中删除的无效商品ID，每行一个，并打印出无效ID的总数量供参考。

**注：** 在处理如此大文件时，务必采用逐行读取方式以避免内存不足；本例假定有效ID数量相对较小可以放入内存。

## 删除无效数据

现在我们已经拿到了需要删除的无效ID列表，下一步就是在Cassandra中批量删除这些数据。我们可以使用Python的Cassandra驱动库来连接数据库并执行删除语句。

下面提供一个删除脚本的示例。在执行之前，请确保安装了cassandra-driver库，并根据实际环境调整集群地址、密钥空间等参数：

```py
from cassandra.cluster import Cluster

# 连接Cassandra集群
cluster = Cluster(['<cassandra_host_ip>'], port=9042)
session = cluster.connect('product_keyspace')

# 准备参数化删除语句
delete_stmt = session.prepare("DELETE FROM products WHERE id = ?")

# 逐行读取无效ID文件，执行删除
count = 0
with open('garbage_ids.txt', 'r') as f:
    for line in f:
        pid = line.strip()
        if not pid:
            continue
        session.execute(delete_stmt, [pid])
        count += 1

print("删除完成，删除总条数:", count)
```

该脚本逐条读取garbage_ids.txt并执行CQL删除语句，将对应ID的记录从products表删除。我们使用了预编译语句prepare来提升执行效率。在实际运行中，删除上百万条数据可能需要较长时间，建议在业务低峰期执行，并耐心等待完成。

**注意：** Cassandra 删除操作不会立即物理移除数据，而是打上“墓碑”标记等待后续压缩清理。一次性大量删除后应关注墓碑堆积对性能的影响，必要时进行压缩和维护。

## 验证清理结果

当删除脚本执行完毕后，我们需要验证清理是否成功。可以采用以下两种方式：
* 重新导出ID列表比对：重复执行最开始的数据导出步骤，导出清理后的products表ID列表，与清理前的列表比较行数是否减少，减去的数量应当与garbage_ids.txt中记录的无效ID数量一致。我们的实际清理结果显示数据量比清理前减少了约上百万条，验证了删除操作的有效性。
* 抽样查询验证：针对garbage_ids.txt中的若干ID，尝试在Cassandra中查询它们对应的数据（例如通过SELECT语句），确认这些ID均已查不到记录。

通过以上方法确认无误后，本次数据清理工作就算圆满完成。

## 实践总结

在本次基于Cassandra的大数据清理实践中，我们积累了一些经验和注意事项：
* 充分评估和准备：在清理前，明确无效数据的判定标准，确保获取的有效ID列表准确可靠，避免误删正常数据。大规模操作前做好数据备份或留存关键日志（例如保留待删除ID列表文件）。
* 使用批处理和脚本：针对海量数据，手工操作无法完成，借助脚本可以提高效率并降低出错风险。利用Cassandra的COPY导出功能和Python脚本相结合，是处理此类数据清理的有效方式。
* 注意性能与影响：导出和删除数千万数据对数据库和系统都会造成压力，应选择业务低峰期进行，并合理设置批次和并发。删除操作产生的大量墓碑可能影响后续读性能，需要监控集群状况，适时进行维护（如压缩等）。
* 验证和收尾：清理完成后要及时验证结果，确保目标达成。同时，将清理脚本、过程和结果整理记录，形成文档，以备后续类似操作参考。

通过上述过程，我们成功清理了Cassandra中大量无效商品数据，为搜索系统“减负”的同时保障了线上数据的准确性。