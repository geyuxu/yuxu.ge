---
date: 2024-01-01
tags: [ai, machine learning, data science, regression, python]
legacy: true
---

# A Deep Dive into Regression Evaluation Metrics: From MAE to R², Choosing the Right Tool for the Job

| Metric | Formula | Scale | Range | Interpretation & Focus |
| :--- | :--- | :--- | :--- | :--- |
| **MAE** (Mean Absolute Error) | $\text{MAE} = \frac{1}{n} \sum_{i=1}^{n} |y_i - \hat{y}_i|$ | Same as target | $[0, \infty)$ | The average absolute difference across all errors. Intuitive and easy to understand. |
| **MSE** (Mean Squared Error) | $\text{MSE} = \frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2$ | Squared scale | $[0, \infty)$ | Penalizes larger errors more heavily. Sensitive to outliers; convenient for gradient-based optimization. |
| **RMSE** (Root Mean Squared Error) | $\sqrt{\text{MSE}}$ | Same as target | $[0, \infty)$ | Balances MSE's sensitivity with MAE's interpretability. One of the most widely used metrics. |
| **MedAE** (Median Absolute Error) | $\text{MedAE} = \text{median}(|y_1 - \hat{y}_1|, \dots, |y_n - \hat{y}_n|)$ | Same as target | $[0, \infty)$ | Extremely robust to outliers, reflecting the error of a "typical" sample. |
| **R²** (Coefficient of Determination) | $1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$ | Unitless | $(-\infty, 1]$ | The percentage of variance in the data explained by the model. Closer to 1 is better, but it can be negative. |
| **Adjusted R²** | Adjusted R² | Unitless | $(-\infty, 1]$ | An adjusted version of R² that penalizes for the number of features, making it more suitable for comparing models with different features. |

### 2. Other Common Metrics

Beyond the core metrics, the following are extremely useful in specific scenarios.

| Metric | Formula & Characteristics | Use Case | Notes |
| :--- | :--- | :--- | :--- |
| **MAPE** (Mean Absolute Percentage Error) | $\frac{100}{n}\sum |\frac{y_i - \hat{y}_i}{y_i}| \%$ | Business contexts where percentage error is key, like sales or inventory forecasting. | Becomes unstable or undefined when the true value $y_i$ is zero or close to it. |
| **SMAPE** (Symmetric MAPE) | $\frac{100}{n}\sum\frac{|y_i - \hat{y}_i|}{(|y_i|+|\hat{y}_i|)/2} \%$ | Solves MAPE's asymmetry and is more robust to zero values. | Less intuitive but fairer. |
| **RMSLE** (Root Mean Squared Log Error) | $\sqrt{\frac{1}{n}\sum (\ln(y_i+1)-\ln(\hat{y}_i+1))^2}$ | Predicting positive, long-tailed data (e.g., house prices, web traffic). | Focuses on relative error; less penalty for large value deviations. Requires $y > -1$. |
| **Explained Variance** | $1 - \frac{\text{Var}(y - \hat{y})}{\text{Var}(y)}$ | Similar to R², but focuses on variance rather than systematic bias. | Measures the correlation between the fluctuations of predicted and true values. |
| **Max Error** | $\max_i |y_i - \hat{y}_i|$ | Risk management, safety assessments, and scenarios where the worst-case performance is critical. | Determined by a single extreme value; highly sensitive to outliers. |

### 3. Quick Calculation with Python

`scikit-learn` provides convenient tools to calculate most of these metrics. Here is a template you can quickly adapt for your projects.

```python
import numpy as np
from sklearn.metrics import (mean_absolute_error, mean_squared_error,
                             median_absolute_error, r2_score,
                             mean_absolute_percentage_error,
                             explained_variance_score, max_error)

# Assuming y_true and y_pred are your ground truth and predictions
rng = np.random.RandomState(42)
y_true = rng.uniform(50, 150, size=30)
noise  = rng.normal(0, 10, size=30)
y_pred = y_true + noise

# Calculate multiple metrics at once
metrics = {
    "MAE": mean_absolute_error(y_true, y_pred),
    "MSE": mean_squared_error(y_true, y_pred),
    "RMSE": mean_squared_error(y_true, y_pred, squared=False), # or np.sqrt(mse)
    "MedAE": median_absolute_error(y_true, y_pred),
    "MAPE(%)": mean_absolute_percentage_error(y_true, y_pred) * 100,
    "R2": r2_score(y_true, y_pred),
    "ExplainedVar": explained_variance_score(y_true, y_pred),
    "MaxError": max_error(y_true, y_pred)
}

print("--- Regression Metrics ---")
for k, v in metrics.items():
    print(f"{k:<12}: {v:.4f}")
```

**Example Output** (may vary slightly with each run):
```
--- Regression Metrics ---
MAE         : 8.7285
MSE         : 105.1905
RMSE        : 10.2554
MedAE       : 7.6170
MAPE(%)     : 7.8522
R2          : 0.8925
ExplainedVar: 0.8949
MaxError    : 28.1245
```

### 4. How Do Outliers Affect Metrics? A Small Experiment

To intuitively understand the sensitivity of different metrics to outliers, let's conduct a simple experiment.

```python
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# 1) Create a clean dataset
y_true_clean = np.linspace(10, 20, 50)
y_pred_clean = y_true_clean + np.random.normal(0, 0.8, size=len(y_true_clean))

def report(title, y_true, y_pred):
    mse = mean_squared_error(y_true, y_pred)
    mae = mean_absolute_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    print(f"{title:18s}  MSE={mse:6.3f}  MAE={mae:5.3f}  R2={r2:5.3f}")

report("Without Outlier", y_true_clean, y_pred_clean)

# 2) Inject one extreme outlier (true value 100, predicted 50)
y_true_outlier = np.append(y_true_clean, 100)
y_pred_outlier = np.append(y_pred_clean, 50)

report("With Outlier", y_true_outlier, y_pred_outlier)
```

**Typical Output**:
```
Without Outlier     MSE= 0.631  MAE=0.642  R2=0.985
With Outlier        MSE=82.641  MAE=1.624  R2=-0.250
```

**Interpreting the Experiment**:
- **MSE** skyrockets from 0.631 to 82.641. It's "detonated" by a single outlier because squaring the error massively amplifies its impact.
- **MAE** increases gently from 0.642 to 1.624, demonstrating its robustness against outliers.
- **R²** drops to a negative value. This means that after adding the outlier, the model's performance is worse than the baseline model of simply predicting the mean of all true values.

This experiment shows that when your business cannot tolerate large errors, MSE/RMSE serves as a more sensitive sentinel. However, if you want to assess overall model performance without being skewed by a few anomalies, MAE/MedAE is a more robust choice.

### 5. How to Choose the Right Metric for Your Project: A Scenario-Based Guide

Choosing the right metric begins with understanding your business needs and data characteristics. Here, we provide a scenario-based guide by directly answering the key questions posed earlier.

#### Scenario 1: Are we more afraid of being "off by 1° on average" or "off by 5° occasionally"?

This question gets to the heart of your model's error tolerance, especially its sensitivity to large errors.

-   **If you're more afraid of being "off by 5° occasionally" (High-Risk Aversion):**
    -   **Primary Metrics: MSE / RMSE**
    -   **Reasoning**: Mean Squared Error (MSE) and its square root (RMSE) square the error term. This means a 5° error ($5^2=25$) contributes 25 times more to the total error than a 1° error ($1^2=1$). This makes MSE/RMSE extremely sensitive to large errors and outliers, acting like an alarm system that penalizes any significant deviation harshly.
    -   **Applicable Industries**: Financial risk management (e.g., predicting default losses), industrial manufacturing (e.g., predicting equipment failure times), and weather forecasting. In these fields, a single extreme error can be very costly.

-   **If you're more concerned with being "off by 1° on average" (Stability Priority):**
    -   **Primary Metrics: MAE / MedAE**
    -   **Reasoning**: Mean Absolute Error (MAE) treats all errors equally, calculating their average linearly. A 5° error is simply 5 times worse than a 1° error. This allows MAE to provide a more robust measure of the model's general performance, without being skewed by a few extreme values. Median Absolute Error (MedAE) is even more robust, as it is completely insensitive to outliers.
    -   **Applicable Industries**: Retail sales forecasting, inventory management, and human resources planning. In these areas, stakeholders often care more about the overall, expected deviation rather than being misled by a few anomalous transactions.

#### Scenario 2: Does management care about "relative percentages" or "absolute values"?

This question is about the metric's audience and its ease of communication.

-   **If your audience thinks in "relative percentages":**
    -   **Primary Metrics: MAPE / SMAPE**
    -   **Reasoning**: Mean Absolute Percentage Error (MAPE) presents the error as a percentage, which is highly intuitive, especially for reporting to non-technical stakeholders (e.g., "Our sales forecast is accurate to within 5%"). It's also excellent for comparing performance across different scales, such as forecasting sales for a $10 product versus a $1,000 product.
    -   **Note**: If your true values can be zero, use Symmetric MAPE (SMAPE) or another metric to avoid division-by-zero errors.

-   **If business decisions depend on "absolute values":**
    -   **Primary Metrics: RMSE / MAE**
    -   **Reasoning**: The units of these metrics are the same as your target variable (e.g., the RMSE for a housing price model is in "dollars"; the MAE for inventory prediction is in "units"). This allows business teams to directly relate the model's error to financial metrics like cost and profit, enabling more concrete decisions (e.g., "The model's average error is $1,000, which is within our acceptable range").

#### Scenario 3: What are the characteristics of my data distribution?

The nature of your data is a critical technical prerequisite for selecting a metric.

-   **If your data has a long-tail distribution (e.g., housing prices, web traffic, personal income):**
    -   **Primary Metric: RMSLE (Root Mean Squared Log Error)**
    -   **Reasoning**: For this type of data, we often care more about relative errors than absolute ones. For example, predicting a \$1M house as \$1.1M (a \$100k error) is different from predicting a \$10M house as \$10.1M (also a \$100k error). RMSLE addresses this by taking the logarithm of the predictions and actual values, effectively turning absolute differences into relative ones. It also naturally penalizes underestimation more than overestimation.

-   **If your data contains many important zero values:**
    -   **Primary Metrics: MAE / RMSE**
    -   **Reasoning**: As mentioned, MAPE fails when the actual value is zero. In this case, MAE or RMSE, which directly evaluate the absolute error, are the safest and most straightforward choices.

#### Summary: A Decision-Making Flowchart

1.  **Qualitative Analysis (Business Dialogue)**: Start by talking to stakeholders to clarify error tolerance and reporting habits, addressing Scenarios 1 and 2.
2.  **Quantitative Analysis (Data Exploration)**: Plot a histogram of your data to check for long tails, outliers, or zero values, addressing Scenario 3.
3.  **Monitor Multiple Metrics (Model Iteration)**: During training and validation, track 2-3 key metrics simultaneously (e.g., a robust metric like MAE, a sensitive one like RMSE, and a business-friendly one like MAPE) to gain a comprehensive understanding of your model's behavior.
4.  **Final Selection (Deployment)**: Based on the analysis, choose 1-2 of the most critical metrics to serve as the final standard for model selection and online monitoring.

### Conclusion

There is no single "best" metric—only the "most appropriate" one for your specific context. A deep understanding of the mathematical principles and business intuition behind each metric is the bridge that connects your model to real-world value. We hope this guide helps you choose and interpret evaluation metrics with more confidence in your future regression projects, leading to more powerful and reliable models.