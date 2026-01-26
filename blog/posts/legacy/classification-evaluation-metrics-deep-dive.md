---
date: 2024-01-01
tags: [ai, machine learning, classification, metrics, python]
legacy: true
---

# 分类模型评估指标权威指南：从混淆矩阵到AUC与F1分数

| | 预测为正 (Predicted Positive) | 预测为负 (Predicted Negative) |
| :--- | :--- | :--- |
| **真实为正 (Actual Positive)** | TP (True Positive) | FN (False Negative) |
| **真实为负 (Actual Negative)** | FP (False Positive) | TN (True Negative) |

-   **TP (真正例)**: 真实为正，预测也为正。
-   **FN (假负例)**: 真实为正，但预测为负（第 I 类错误）。
-   **FP (假正例)**: 真实为负，但预测为正（第 II 类错误）。
-   **TN (真负例)**: 真实为负，预测也为负。

几乎所有后续的分类指标，都是基于这四个基础统计量计算得出的。

### 2. 点值型核心指标 (Threshold-Dependent)

这类指标的计算依赖于一个确定的分类阈值（通常默认为 0.5）。

| 指标 | 公式 | 直觉解读 | 适用场景 | 注意事项 |
| :--- | :--- | :--- | :--- | :--- |
| **Accuracy (准确率)** | $\frac{TP+TN}{TP+FP+FN+TN}$ | “总对率”，预测正确的样本占总样本的比例。 | 类别均衡且两类错误成本相近的场景。 | 在极度不均衡数据中极易失真。 |
| **Precision (精确率/查准率)** | $\frac{TP}{TP+FP}$ | 在所有被预测为正的样本中，有多大比例是真的正例。 | 垃圾邮件过滤、医学诊断（确诊阶段），即“宁可放过，不可杀错”。 | 忽视了 FN；受阈值影响大。 |
| **Recall (召回率/查全率)** | $\frac{TP}{TP+FN}$ | 在所有真实为正的样本中，有多大比例被模型成功“召回”。 | 疾病筛查、金融欺诈检测，即“宁可错杀，不可放过”。 | 忽视了 FP；单看 Recall 无法评估误报成本。 |
| **Specificity (特异性)** | $\frac{TN}{TN+FP}$ | 在所有真实为负的样本中，有多大比例被模型正确识别。 | 信贷风控（避免错误拒绝优质客户）。 | 与 Recall (TPR) 共同构成 ROC 曲线。 |
| **F1-Score** | $2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$ | Precision 和 Recall 的调和平均数。 | 当 P 和 R 同等重要时，作为综合性指标。 | 对每个类别计算可得 Macro-F1。 |
| **Fβ-Score** | $(1+\beta^2) \frac{\text{P} \cdot \text{R}}{\beta^2 P + R}$ | F1 的泛化形式，通过 β 调节 P/R 的权重。 | 当 Recall 比 Precision 更重要时（如 β=2），或反之（如 β=0.5）。 | β 的选择需要基于业务场景的先验知识。 |
| **Balanced Accuracy** | $\frac{\text{Recall} + \text{Specificity}}{2}$ | 宏观 Recall，对不均衡数据友好。 | 欺诈检测、罕见病识别。 | 仍然依赖于固定的分类阈值。 |
| **MCC (马修斯相关系数)** | $\frac{TP \cdot TN - FP \cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}$ | 一个介于 -1 到 1 之间的相关系数。 | 极度不均衡的二分类任务。 | 全面利用四格信息，被认为是更均衡的指标。 |

### 3. 阈值曲线类指标 (Threshold-Independent)

这类指标通过改变分类阈值来评估模型在所有可能阈值下的整体性能。

| 指标 | 构造方式 | 何时优先使用 |
| :--- | :--- | :--- |
| **ROC 曲线 & AUC** | 以 (FPR, TPR) 即 (1-Specificity, Recall) 为坐标，随阈值从 1 到 0 变化绘制曲线。AUC 是曲线下面积。 | 类别相对均衡；需要评估模型整体的排序能力；分类阈值待定或成本未知时。 |
| **PR 曲线 & AUPRC** | 以 (Recall, Precision) 为坐标绘制曲线。AUPRC (或 AP) 是曲线下面积。 | 正样本非常稀少（如广告点击率预测）；更关注假正例（FP）带来的影响时。 |

**核心建议**：在处理不均衡数据时，**PR 曲线及其 AUPRC** 比 ROC-AUC 更能真实地反映模型的性能，因为 ROC-AUC 在海量负样本（TN）存在时，其值可能虚高，给人以模型性能很好的错觉。

### 4. 概率质量指标

这类指标直接评估模型输出概率的质量，而非最终的分类标签。

| 指标 | 含义 | 适用场景 |
| :--- | :--- | :--- |
| **Log Loss (对数损失)** | 也称交叉熵损失。对预测概率与真实标签的差异进行对数惩罚，越小越好。 | 模型训练和调优时的核心损失函数。 |
| **Brier Score (布里尔分数)** | 预测概率与真实结果（0或1）之间均方误差，越小越好。 | 天气预报、体育比赛预测等需要评估概率准确性的场景。 |
| **ECE / MCE** | 期望/最大校准误差。衡量预测概率与真实频率的一致性。 | 当需要模型的置信度高度可信时，如在 AutoML 或风险决策系统中。 |

### 5. 多分类与不均衡的加权方式

在多分类任务中，我们需要将每个类别的指标汇集成一个总分。

-   **Micro 平均 (Micro Average)**：将所有类别的 TP, FP, FN, TN 汇总后，再计算单一指标。它给予每个**样本**相同的权重，适合评估模型的整体性能。
-   **Macro 平均 (Macro Average)**：先为每个类别计算指标，然后取算术平均。它给予每个**类别**相同的权重，能更好地反映模型在稀有类别上的表现。
-   **Weighted 平均 (Weighted Average)**：在 Macro 平均的基础上，按每个类别的样本数量进行加权。是前两者的一种折中。

**建议**：先绘制类别分布图。如果数据长尾分布严重，应同时报告 **Macro-F1** 和 **Micro-F1**，以全面了解模型在多数类和少数类上的表现。

### 6. 常见误区与排雷

1.  **高 Accuracy ≠ 好模型**：在 99:1 的数据上，一个把所有样本都预测为负类的“傻瓜模型”也能达到 99% 的准确率。
2.  **混淆 Precision 和 Recall**：请记住，Recall (召回率) 关心的是 FN (漏报)，而 Precision (精确率) 关心的是 FP (误报)。
3.  **F1 不是万金油**：如果业务场景更在乎召回（如癌症筛查），应使用 F2-Score；如果更在乎精确（如法务文档检索），则使用 F0.5-Score。
4.  **跨数据集比较 AUC**：不同测试集的正负样本比例和难度不同，会导致 ROC/PR 曲线形态变化，因此 AUC 值不应直接跨数据集进行横向比较。
5.  **混淆分类能力与概率校准**：一个模型的 ROC-AUC 可能很高（排序能力强），但其输出的概率可能严重失准。在生产环境中，需要同时关注 LogLoss 或 ECE。

### 7. Python 快速实战模板

下面是一个使用 `scikit-learn` 在一个（不均衡的）多分类数据集上计算多种指标的模板。

```python
import numpy as np
from sklearn.metrics import (accuracy_score, precision_recall_fscore_support,
                             roc_auc_score, average_precision_score,
                             log_loss, brier_score_loss, confusion_matrix, matthews_corrcoef)
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

# 1. 生成一个不均衡的多分类数据集
X, y = make_classification(n_samples=3000, n_classes=3,
                           weights=[0.7, 0.25, 0.05], # 类别权重不均衡
                           n_informative=5, n_redundant=2,
                           flip_y=0.03, random_state=42)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, stratify=y, random_state=42)

# 2. 训练一个简单的逻辑回归模型
model = LogisticRegression(max_iter=1000, multi_class="ovr", random_state=42)
model.fit(X_train, y_train)
y_proba = model.predict_proba(X_test)
y_pred = model.predict(X_test)

# 3. 计算各类指标
print("--- Classification Metrics ---")

# 点值指标 (加权平均)
acc = accuracy_score(y_test, y_pred)
prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')
mcc = matthews_corrcoef(y_test, y_pred)

print(f"Accuracy (Weighted) : {acc:.4f}")
print(f"Precision (Weighted): {prec:.4f}")
print(f"Recall (Weighted)   : {rec:.4f}")
print(f"F1-Score (Weighted) : {f1:.4f}")
print(f"Matthews Corr Coef  : {mcc:.4f}\n")

# 宏平均指标 (更能反映小类性能)
macro_prec, macro_rec, macro_f1, _ = precision_recall_fscore_support(y_test, y_pred, average='macro')
print(f"Precision (Macro)   : {macro_prec:.4f}")
print(f"Recall (Macro)      : {macro_rec:.4f}")
print(f"F1-Score (Macro)    : {macro_f1:.4f}\n")


# 概率质量指标
logloss = log_loss(y_test, y_proba)
# Brier Score 需要对每个类分别计算后平均
brier = np.mean([brier_score_loss((y_test == k), y_proba[:, k]) for k in np.unique(y_test)])

print(f"LogLoss             : {logloss:.4f}")
print(f"Brier Score (Avg)   : {brier:.4f}")
```

**输出示例**:
```
--- Classification Metrics ---
Accuracy (Weighted) : 0.8944
Precision (Weighted): 0.8861
Recall (Weighted)   : 0.8944
F1-Score (Weighted) : 0.8862
Matthews Corr Coef  : 0.7183

Precision (Macro)   : 0.7989
Recall (Macro)      : 0.7311
F1-Score (Macro)    : 0.7552

LogLoss             : 0.2819
Brier Score (Avg)   : 0.0542
```
观察到 Macro-F1 (0.755) 明显低于 Weighted-F1 (0.886)，这揭示了模型在稀有类别上的性能较差，这是仅看总体准确率时容易忽略的。

### 8. 选指标的小流程

1.  **明确业务目标**：定义 FP 和 FN 的业务成本。哪个错误更“贵”？
2.  **选择点值指标**：如果成本已知，可以优化分类阈值并重点关注 Precision, Recall, 或 Fβ-Score。如果未知或同等重要，F1-Score 是一个好的起点。
3.  **评估概率质量**：在模型上线前，务必检查其概率输出是否校准。使用 LogLoss 作为训练损失，并用 ECE 或 Brier Score 进行验证。
4.  **监控整体性能**：在模型迭代或 A/B 测试中，使用 AUPRC (不均衡数据) 或 ROC-AUC (均衡数据) 来评估模型的整体排序能力。
5.  **处理不均衡问题**：如果 Macro-F1 远低于 Micro-F1，分析混淆矩阵，找出模型在哪些小类上表现不佳。考虑使用重采样技术、代价敏感学习或 Focal Loss 等方法来提升模型在少数类上的性能。