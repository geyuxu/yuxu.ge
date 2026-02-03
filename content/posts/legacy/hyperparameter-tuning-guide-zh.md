---
date: 2024-01-01
tags: [ai, machine learning, hyperparameter tuning, python, pytorch, optuna, scikit-learn]
legacy: true
---

# 机器学习超参数调优：从理论到实践的全面指南

## 2. 调优手段综述与代码实践

选择合适的调优策略是平衡探索（覆盖更广的搜索空间）和利用（在有希望的区域进行更精细的搜索）的艺术。下面我们逐一深挖各种主流方法，并提供可直接运行的代码骨架。

### 2.1 网格搜索 (Grid Search)

**核心思路**：对所有提供的超参数组合进行暴力枚举（笛卡尔积），是维度少时最稳妥的方法。

```python
# pip install scikit-learn
from sklearn.model_selection import GridSearchCV
from sklearn.svm import SVC

# 假设 X_train, y_train 已加载
# from sklearn.datasets import make_classification
# X_train, y_train = make_classification(n_samples=1000, n_features=20, n_informative=10, random_state=42)

param_grid = {
    "C":     [0.1, 1, 10],
    "gamma": [1, 0.1, 0.01],
    "kernel": ["rbf"]
}
grid = GridSearchCV(
    estimator=SVC(),
    param_grid=param_grid,
    cv=5,               # 五折交叉验证
    scoring="accuracy",
    n_jobs=-1           # CPU 并行
)
# grid.fit(X_train, y_train)
# print(f"Best Params: {grid.best_params_}")
# print(f"Best Score: {grid.best_score_:.4f}")
```
**技巧**：先用粗粒度网格扫描一个较大的范围，锁定表现最好的区域后，再构建一个更精细的局部网格进行搜索。

### 2.2 随机搜索 (Random Search)

**核心思路**：与网格搜索不同，随机搜索在指定的分布中随机采样固定数量的参数组合。当超参数数量较多时，它通常比网格搜索更高效。

```python
# pip install scikit-learn scipy
from sklearn.model_selection import RandomizedSearchCV
from sklearn.ensemble import GradientBoostingClassifier
from scipy.stats import loguniform, randint

# 假设 X_train, y_train 已加载
param_dist = {
    "learning_rate": loguniform(1e-4, 1e-1),
    "n_estimators":  randint(100, 1000),
    "max_depth":     randint(2, 6)
}
rs = RandomizedSearchCV(
    GradientBoostingClassifier(),
    param_distributions=param_dist,
    n_iter=60,          # 采样 60 组
    cv=5,
    random_state=42,
    n_jobs=-1
)
# rs.fit(X_train, y_train)
# print(f"Best Params: {rs.best_params_}")
# print(f"Best Score: {rs.best_score_:.4f}")
```
**思考点**：对于学习率、正则化强度这类对数量级敏感的超参数，使用对数均匀分布（`loguniform`）进行采样会比线性均匀分布更有效。

### 2.3 贝叶斯优化 (Bayesian Optimization)

**核心思路**：这是一种更智能的搜索策略。它使用一个概率模型（代理模型）来建模“超参数-性能”函数，并利用历史评估结果来选择下一个最有希望的评估点。这使得它能用更少的迭代次数逼近最优解。`Optuna` 是一个流行的实现库。

```python
# pip install optuna torch torchvision
import torch
import torch.nn as nn
import optuna
from torchvision.datasets import MNIST
from torch.utils.data import DataLoader
from torchvision import transforms

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

def objective(trial):
    # 1. 采样超参数
    lr = trial.suggest_loguniform("lr", 1e-4, 1e-1)
    dropout = trial.suggest_uniform("dropout", 0.1, 0.5)
    hidden = trial.suggest_categorical("hidden", [64, 128, 256])

    # 2. 构造模型
    model = nn.Sequential(
        nn.Flatten(),
        nn.Linear(28*28, hidden), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(hidden, 10)
    ).to(DEVICE)

    # 3. 训练
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    train_loader = DataLoader(
        MNIST(".", train=True, download=True, transform=transforms.ToTensor()),
        batch_size=128, shuffle=True
    )
    model.train()
    for epoch in range(2):  # 每个 trial 只跑 2 epoch 以快速迭代
        for x, y in train_loader:
            x, y = x.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            optimizer.step()

    # 4. 验证
    correct = 0
    val_loader = DataLoader(
        MNIST(".", train=False, transform=transforms.ToTensor()),
        batch_size=512
    )
    model.eval()
    with torch.no_grad():
        for x, y in val_loader:
            preds = model(x.to(DEVICE)).argmax(1).cpu()
            correct += (preds == y).sum().item()
    
    accuracy = correct / len(val_loader.dataset)
    return accuracy # Optuna 默认最大化目标

# study = optuna.create_study(direction="maximize")
# study.optimize(objective, n_trials=40, timeout=600) # 40次尝试或10分钟
# print(f"Best score: {study.best_value:.4f}")
# print(f"Best hyperparameters: {study.best_params}")
```
**加强版**：可以结合 `optuna.pruners` 来提前终止没有希望的试验（trial），从而显著节省计算资源。

### 2.4 基于提前终止的算法 (Successive Halving / Hyperband)

**核心思路**：这些算法旨在通过动态资源分配来加速搜索。它们首先为许多配置分配少量资源（如训练几个 epoch），然后根据初始表现淘汰掉表现差的配置，只为“幸存者”分配更多资源。

```python
# pip install scikit-learn
from sklearn.experimental import enable_halving_search_cv
from sklearn.model_selection import HalvingGridSearchCV
from sklearn.ensemble import RandomForestClassifier

# 假设 X_train, y_train 已加载
param_grid = {"max_depth": [5, 10, 15, None],
              "min_samples_leaf": [1, 2, 4]}
sh = HalvingGridSearchCV(
    RandomForestClassifier(n_estimators=200),
    param_grid,
    cv=5,
    factor=3,            # 每轮保留 1/factor 的候选配置
    resource="n_samples", # scikit-learn 中资源是样本数
    scoring="accuracy",
    n_jobs=-1
)
# sh.fit(X_train, y_train)
# print(f"Best Params: {sh.best_params_}")
```
对于深度学习，`KerasTuner` 的 `Hyperband` 或 `Optuna` 的 `SuccessiveHalvingPruner` 是更自然的选择，它们可以将 `epoch` 作为资源维度。

### 2.5 进化策略 (Population-Based Training, PBT)

**核心思路**：这是一种更高级的混合策略，常见于大规模分布式训练。它并行训练一组模型（一个“种群”），并周期性地用表现好的模型的权重来替换表现差的模型，同时对超参数进行轻微的随机扰动（“变异”）。

```python
# pip install "ray[tune]" torch
from ray import tune
from ray.tune.schedulers import PopulationBasedTraining

def train_model(config):
    # 此处省略模型、数据加载和训练循环的定义
    # 训练循环中需要通过 tune.report() 报告验证集指标
    # e.g., tune.report(mean_accuracy=acc)
    pass

pbt = PopulationBasedTraining(
    time_attr="training_iteration",
    metric="mean_accuracy",
    mode="max",
    perturbation_interval=5, # 每5个迭代周期进行一次扰动
    hyperparam_mutations={
        "lr": lambda: tune.loguniform(1e-4, 1e-1).sample(),
        "dropout": [0.2, 0.3, 0.4, 0.5]
    }
)

# analysis = tune.run(
#     train_model,
#     resources_per_trial={"cpu": 2, "gpu": 1},
#     config={"lr": 1e-3, "dropout": 0.4},
#     num_samples=10, # 种群大小
#     scheduler=pbt
# )
# print("Best config: ", analysis.get_best_config(metric="mean_accuracy", mode="max"))
```
PBT 的强大之处在于它不仅能优化超参数，还能在线学习到有效的学习率调度策略。

## 3. 常见超参数及其影响

理解不同超参数如何影响模型行为是做出明智调整决策的关键。

| 类别 | 超参数 | 值太小 | 值过大 |
| :--- | :--- | :--- | :--- |
| **优化** | 学习率 (lr) | 收敛慢，容易陷入局部最小值 | 损失函数振荡或发散，无法收敛 |
| | 批大小 (batch_size) | 梯度更新噪声大，收敛不稳定 | 内存消耗大，泛化能力可能下降 |
| **模型容量** | 层数 / 神经元数 | 欠拟合，无法学习复杂模式 | 过拟合，记忆训练数据，泛化差 |
| | 卷积核尺寸 | 感受野不足，无法捕捉大尺度特征 | 参数量剧增，计算昂贵，易过拟合 |
| **正则化** | Dropout 比例 | 正则化效果不足，容易过拟合 | 模型有效容量下降过多，导致欠拟合 |
| | L1/L2 正则强度 (λ) | 模型复杂度惩罚不足 | 模型过于简单，导致欠拟合 |

## 4. 实用调参技巧

1.  **确定大方向**：数据量充足？优先增加模型容量。数据量有限？优先调整正则化或应用数据增强。
2.  **分组调参**：不要一次性调整所有参数。可以先调整优化相关参数（如学习率、批大小），再调整模型结构参数，最后调整正则化参数。
3.  **使用对数尺度**：对于学习率和正则化强度等超参数，在对数尺度上（如 `1e-5` 到 `1e-1`）进行搜索远比线性尺度高效。
4.  **可视化与早停**：使用 TensorBoard 或 WandB 等工具监控训练/验证曲线。一旦发现验证损失停止下降或开始上升，就应考虑提前终止训练或增强正则化。
5.  **借鉴已有成果**：从相关论文或开源代码库的默认配置开始，这通常是一个很好的基线。先在相同数量级内进行微调。
6.  **资源优先**：首先确定硬件（尤其是显存）能承受的最大批大小和模型尺寸，然后再在这个约束下精调其他参数。

## 5. 总结与决策树

如何选择合适的调优方法？

1.  **维度 ≤ 3，数据量小，CPU训练？** → 直接用 `GridSearchCV`。
2.  **想快速得到一个80分的结果？** → `RandomizedSearchCV` 结合对数分布采样是你的朋友。
3.  **使用GPU训练，计算预算有限？** → `Optuna` (TPE) 结合剪枝 (`Pruner`) 或 `Hyperband` 是最高效的选择。
4.  **拥有大规模分布式集群？** → `Ray Tune` 的 PBT 能发挥最大威力。
5.  **进行学术研究或需要极致精调？** → 可以探索梯度式超参优化，但要准备好应对其复杂性。

通过将这些理论知识和代码实践相结合，你将能够更系统、更高效地进行超参数调优，从而显著提升你的模型性能。