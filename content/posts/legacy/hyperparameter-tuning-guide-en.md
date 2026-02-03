---
date: 2024-01-01
tags: [ai, machine learning, hyperparameter tuning, python, pytorch, optuna, scikit-learn]
legacy: true
---

# A Comprehensive Guide to Hyperparameter Tuning in Machine Learning: From Theory to Practice

## 2. Tuning Methods: Overview and Code Examples

Choosing the right tuning strategy is an art of balancing exploration (covering a wider search space) and exploitation (finer search in promising areas). Let's delve into the mainstream methods one by one, complete with runnable code snippets.

### 2.1 Grid Search

**Core Idea**: A brute-force enumeration of all possible combinations (Cartesian product) of the provided hyperparameter values. It's the most reliable method when the number of dimensions is small.

```python
# pip install scikit-learn
from sklearn.model_selection import GridSearchCV
from sklearn.svm import SVC

# Assume X_train, y_train are loaded
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
    cv=5,               # 5-fold cross-validation
    scoring="accuracy",
    n_jobs=-1           # Use all available CPU cores
)
# grid.fit(X_train, y_train)
# print(f"Best Params: {grid.best_params_}")
# print(f"Best Score: {grid.best_score_:.4f}")
```
**Tip**: Start with a coarse grid to scan a wide range, then define a finer, more localized grid around the best-performing region.

### 2.2 Random Search

**Core Idea**: Unlike Grid Search, Random Search samples a fixed number of parameter combinations from specified distributions. It is generally more efficient than Grid Search, especially when dealing with a large number of hyperparameters.

```python
# pip install scikit-learn scipy
from sklearn.model_selection import RandomizedSearchCV
from sklearn.ensemble import GradientBoostingClassifier
from scipy.stats import loguniform, randint

# Assume X_train, y_train are loaded
param_dist = {
    "learning_rate": loguniform(1e-4, 1e-1),
    "n_estimators":  randint(100, 1000),
    "max_depth":     randint(2, 6)
}
rs = RandomizedSearchCV(
    GradientBoostingClassifier(),
    param_distributions=param_dist,
    n_iter=60,          # Sample 60 combinations
    cv=5,
    random_state=42,
    n_jobs=-1
)
# rs.fit(X_train, y_train)
# print(f"Best Params: {rs.best_params_}")
# print(f"Best Score: {rs.best_score_:.4f}")
```
**Key Insight**: For hyperparameters sensitive to their order of magnitude, like learning rate and regularization strength, sampling from a log-uniform distribution (`loguniform`) is more effective than a linear uniform distribution.

### 2.3 Bayesian Optimization

**Core Idea**: This is a more intelligent search strategy. It uses a probabilistic model (a surrogate) to model the hyperparameter-to-performance function and leverages historical evaluation results to select the next most promising point to evaluate. This allows it to approach the optimal solution in fewer iterations. `Optuna` is a popular library for this.

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
    # 1. Sample hyperparameters
    lr = trial.suggest_loguniform("lr", 1e-4, 1e-1)
    dropout = trial.suggest_uniform("dropout", 0.1, 0.5)
    hidden = trial.suggest_categorical("hidden", [64, 128, 256])

    # 2. Build the model
    model = nn.Sequential(
        nn.Flatten(),
        nn.Linear(28*28, hidden), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(hidden, 10)
    ).to(DEVICE)

    # 3. Train
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()
    train_loader = DataLoader(
        MNIST(".", train=True, download=True, transform=transforms.ToTensor()),
        batch_size=128, shuffle=True
    )
    model.train()
    for epoch in range(2):  # Run only 2 epochs per trial for fast iteration
        for x, y in train_loader:
            x, y = x.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            loss = loss_fn(model(x), y)
            loss.backward()
            optimizer.step()

    # 4. Validate
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
    return accuracy # Optuna maximizes the objective by default

# study = optuna.create_study(direction="maximize")
# study.optimize(objective, n_trials=40, timeout=600) # 40 trials or 10 minutes
# print(f"Best score: {study.best_value:.4f}")
# print(f"Best hyperparameters: {study.best_params}")
```
**Pro Tip**: Combine this with `optuna.pruners` to terminate unpromising trials early, significantly saving computational resources.

### 2.4 Early-Stopping Based Algorithms (Successive Halving / Hyperband)

**Core Idea**: These algorithms aim to speed up the search through dynamic resource allocation. They start by allocating a small amount of resources (e.g., a few training epochs) to many configurations, then eliminate the poor performers and allocate more resources only to the "survivors."

```python
# pip install scikit-learn
from sklearn.experimental import enable_halving_search_cv
from sklearn.model_selection import HalvingGridSearchCV
from sklearn.ensemble import RandomForestClassifier

# Assume X_train, y_train are loaded
param_grid = {"max_depth": [5, 10, 15, None],
              "min_samples_leaf": [1, 2, 4]}
sh = HalvingGridSearchCV(
    RandomForestClassifier(n_estimators=200),
    param_grid,
    cv=5,
    factor=3,            # Keep 1/factor of candidates each round
    resource="n_samples", # In scikit-learn, the resource is the number of samples
    scoring="accuracy",
    n_jobs=-1
)
# sh.fit(X_train, y_train)
# print(f"Best Params: {sh.best_params_}")
```
For deep learning, `KerasTuner`'s `Hyperband` or `Optuna`'s `SuccessiveHalvingPruner` are more natural choices, as they can use `epoch` as the resource dimension.

### 2.5 Population-Based Training (PBT)

**Core Idea**: This is an advanced hybrid strategy, often used in large-scale distributed training. It trains a group of models (a "population") in parallel. Periodically, it replaces the weights of poor-performing models with those of high-performing models, while also applying small random perturbations ("mutations") to their hyperparameters.

```python
# pip install "ray[tune]" torch
from ray import tune
from ray.tune.schedulers import PopulationBasedTraining

def train_model(config):
    # Model, data loading, and training loop definition omitted here
    # The training loop needs to report validation metrics via tune.report()
    # e.g., tune.report(mean_accuracy=acc)
    pass

pbt = PopulationBasedTraining(
    time_attr="training_iteration",
    metric="mean_accuracy",
    mode="max",
    perturbation_interval=5, # Perturb every 5 training iterations
    hyperparam_mutations={
        "lr": lambda: tune.loguniform(1e-4, 1e-1).sample(),
        "dropout": [0.2, 0.3, 0.4, 0.5]
    }
)

# analysis = tune.run(
#     train_model,
#     resources_per_trial={"cpu": 2, "gpu": 1},
#     config={"lr": 1e-3, "dropout": 0.4},
#     num_samples=10, # Population size
#     scheduler=pbt
# )
# print("Best config: ", analysis.get_best_config(metric="mean_accuracy", mode="max"))
```
The power of PBT lies in its ability not only to optimize hyperparameters but also to learn effective learning rate schedules online.

## 3. Common Hyperparameters and Their Impact

Understanding how different hyperparameters affect model behavior is key to making informed tuning decisions.

| Category | Hyperparameter | Too Small | Too Large |
| :--- | :--- | :--- | :--- |
| **Optimization** | Learning Rate (lr) | Slow convergence, gets stuck in local minima | Loss function oscillates or diverges, fails to converge |
| | Batch Size | Noisy gradient updates, unstable convergence | High memory consumption, may lead to poorer generalization |
| **Model Capacity** | # Layers / # Neurons | Underfitting, fails to learn complex patterns | Overfitting, memorizes training data, poor generalization |
| | Convolutional Kernel Size | Insufficient receptive field, fails to capture large-scale features | Drastic increase in parameters, computationally expensive, prone to overfitting |
| **Regularization** | Dropout Ratio | Insufficient regularization, prone to overfitting | Excessive reduction in effective model capacity, leading to underfitting |
| | L1/L2 Regularization (λ) | Insufficient penalty on model complexity | Model becomes too simple, leading to underfitting |

## 4. Practical Tuning Tips

1.  **Set the Main Direction**: Have a lot of data? Prioritize increasing model capacity. Limited data? Focus on regularization or data augmentation first.
2.  **Tune in Groups**: Don't try to tune everything at once. Start with optimization-related parameters (like learning rate, batch size), then move to model architecture, and finally, tune regularization.
3.  **Use a Logarithmic Scale**: For hyperparameters like learning rate and regularization strength, searching on a log scale (e.g., from `1e-5` to `1e-1`) is far more efficient than a linear scale.
4.  **Visualize and Use Early Stopping**: Monitor training/validation curves with tools like TensorBoard or WandB. If the validation loss stops decreasing or starts to rise, consider stopping the training early or increasing regularization.
5.  **Leverage Existing Work**: Start with the default configurations from relevant papers or open-source repositories. They are often a great baseline. Fine-tune within the same order of magnitude first.
6.  **Prioritize Resources**: First, determine the maximum batch size and model size your hardware (especially GPU memory) can handle. Then, fine-tune other parameters within these constraints.

## 5. Summary and Decision Tree

How to choose the right tuning method?

1.  **Dimensions ≤ 3, small dataset, CPU training?** → Go straight for `GridSearchCV`.
2.  **Want a quick 80% solution?** → `RandomizedSearchCV` with log-uniform sampling is your friend.
3.  **Training on a GPU with a limited budget?** → `Optuna` (TPE) with pruning or `Hyperband` is the most efficient choice.
4.  **Have a large distributed cluster?** → `Ray Tune`'s PBT will unleash its full power.
5.  **Doing academic research or need extreme fine-tuning?** → You can explore hypergradient optimization, but be prepared for its complexity.

By combining this theoretical knowledge with hands-on code examples, you will be able to perform hyperparameter tuning more systematically and efficiently, leading to significant improvements in your model's performance.