---
date: 2025-04-03
tags: [ai]
legacy: true
---

# 使用 PaddlePaddle 2.x 复现 DeepLabV3+（1）：从构建到训练

- ✅ 模块化重构 DeepLabV3+，包含 SeparableConv、ASPP、XceptionBlock
- ✅ 兼容动态图与标准 Layer 接口
- ✅ 编写训练脚本，可扩展至真实数据集

---

## 2. 模型构建：面向对象实现 DeepLabV3+

我们从头构建了一个名为 `DeepLabV3Plus` 的模型类，遵循 `paddle.nn.Layer` 设计接口。

**核心模块包括：**

- `SeparableConv2D`: 模拟深度可分离卷积（depthwise + pointwise）
- `XceptionBlock`: 3 层堆叠的可分离卷积单元，可选残差连接
- `ASPP`: 多尺度特征融合结构，膨胀卷积率为 6、12、18
- `Decoder`: 结合浅层与深层特征，提升边界感知能力

最终模型为典型的 encoder-decoder 结构，可直接输出等大小的分割图。

**代码结构示例：**

```python
class DeepLabV3Plus(nn.Layer):
    def __init__(self, num_classes):
        super().__init__()
        self.entry = ...
        self.block1 = XceptionBlock(...)
        ...
        self.aspp = ASPP(...)
        self.decoder = ...
        self.final = ...

    def forward(self, x):
        ... # 完整结构见文末源码
```

---

## 3. 训练脚本：高效训练 + 模型保存

训练脚本使用 `paddle.io.DataLoader` 与标准 `nn.Layer` 接口完成：

**特点：**

- 动态创建模型实例与优化器
- 支持 ignore_index 的自定义交叉熵损失函数
- 自动保存模型参数（`.pdparams`）

**示例结构：**

```python
model = DeepLabV3Plus(num_classes=21)
optimizer = paddle.optimizer.Adam(...)
criterion = CrossEntropyLossWithMask(ignore_index=255)

for epoch in range(num_epochs):
    for imgs, labels in dataloader:
        preds = model(imgs)
        loss = criterion(preds, labels)
        loss.backward()
        optimizer.step()
        optimizer.clear_grad()
```

目前使用的是伪造数据集 `DummySegDataset`，可很方便地替换为 VOC、ADE20K 等真实数据集。

---

*未完待续：本文后续将补充验证阶段、评价指标与部署流程。*