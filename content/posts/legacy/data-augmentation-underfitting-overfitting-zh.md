---
date: 2024-01-01
tags: [ai, 图像分类, 数据增强, 过拟合, 欠拟合, pytorch]
legacy: true
---

# 图像分类：数据稀缺、样本增强与欠拟合/过拟合

| 维度 | 欠拟合 | 过拟合 |
| :--- | :--- | :--- |
| **定义** | 模型未捕获数据内在规律，表现为高偏差 (High Bias)。 | 模型将训练数据中的噪声也当作规律来学习，表现为高方差 (High Variance)。 |
| **训练曲线** | 训练集和验证集的损失（Loss）都比较高，且很早就收敛不再下降。 | 训练集损失持续降低，但验证集损失在下降到某个点后开始回升，形成一个明显的“剪刀差”。 |
| **直观比喻** | 试图用一条直线去拟合一条复杂的“S”形曲线。 | 试图用一条曲线精确地穿过每一个训练数据点，形成一个“马蜂窝”状的复杂路径。 |
| **触发条件** | 数据本身的复杂度远超模型的表达能力。 | 模型的容量（复杂度）远超训练数据所包含的信息量。 |
| **诊断方法** | 学习曲线平行上移；无论如何调参，模型的偏差（bias）都无法有效降低。 | 训练集与验证集的准确率差距（Training/Validation Gap）通常大于5-10个百分点；模型对错误预测的置信度（confidence）异常高。 |
| **缓解方案** | ① 增大模型容量（更深或更宽的网络）或增加特征。 <br> ② 延长训练时间或优化学习率等超参数。 <br> ③ 减少正则化强度。 | ① **数据增强**或扩充数据集。 <br> ② 使用正则化（L1/L2、Dropout、早停）。 <br> ③ 简化模型结构。 <br> ④ 模型集成（Ensemble）或知识蒸馏（Distillation）。 |

### 3. 数据稀缺下的样本增强

在所有解决过拟合的策略中，数据增强是最直接、最有效的方法之一。它通过对现有训练数据进行一系列随机变换，创造出更多样的、模型“未曾见过”的样本，从而在不增加标注成本的情况下，扩充了数据的信息量。

#### 3.1 几何变换

这类变换模拟了物体在真实世界中可能出现的姿态、大小和位置变化。常用操作包括：随机旋转 (±15° to ±30°)、随机缩放 (0.8× to 1.2×) 和随机平移 (≤10% of image dimensions)。更复杂的变换如弹性扭曲 (Elastic Distortion) 和透视变换 (Perspective Transformation) 也能提供更强的泛化能力。

#### 3.2 像素级扰动

这类变换旨在提高模型对图像质量变化的鲁棒性。例如，向图像中加入高斯噪声 (Gaussian Noise, e.g., σ=0.01-0.05 × 255) 或椒盐噪声 (Salt-and-Pepper Noise, e.g., ratio=0.3-0.5%)，以及应用高斯模糊 (GaussianBlur, kernel size=3 or 5) 或运动模糊 (MotionBlur)。

#### 3.3 颜色空间变换

颜色空间的变换可以增强模型对光照、对比度和色彩变化的适应性。`ColorJitter` 是一个常用工具，它可以随机调整图像的亮度 (brightness)、对比度 (contrast) 和饱和度 (saturation)（例如，在 0.8-1.2 倍之间）。将图像转为灰度图再复制回三个通道，也是一种强制模型关注形状而非颜色的有效技巧。

#### 3.4 合成/混合方法

近年来，将多张图片信息混合的增强方法变得非常流行，它们能创造出在真实世界中不存在但对模型正则化非常有益的样本。

| 方法 | 核心思路 | 推荐触发概率 (p) | 备注 |
| :--- | :--- | :--- | :--- |
| **Cutout/GridMask** | 在图像上随机挖去一个或多个矩形区域进行遮挡。 | `p=0.3` | 在目标检测/分割任务中，需要注意避免遮挡到关键目标。 |
| **Mixup** | 将两张图片的输入和标签按一个从Beta分布中采样的比例 (λ) 进行线性插值。 | `1.0` (作为一个独立的epoch) | α=0.2 是一个常用的超参数。 |
| **CutMix** | 从一张图片中随机剪下一个区域，粘贴到另一张图片上，并根据区域面积比例调整标签权重。 | `p=0.5` | α=1.0 是一个常用的超参数。 |

#### 3.5 自动增强

手动设计增强策略组合费时费力，因此自动增强应运而生。**RandAugment** 是一种简单高效的方法，它从一个预设的变换池中随机挑选 N 种变换，并以一个统一的强度 M 应用。对于小数据集，它通常能带来显著收益（如 N=2, M=9）。更复杂的 **AutoAugment** 使用强化学习来搜索最佳策略组合，但计算成本高昂。

### 4. 实践落地步骤 (PyTorch 示例)

下面我们展示如何在 PyTorch 中构建一个包含多种增强策略的 `transform` 流水线，并实现一个可插拔的 Mixup 功能。

#### 4.1 变换流水线

```python
import torchvision.transforms as T
import torch
import numpy as np

# 自定义一个椒盐噪声类
class SaltPepperNoise:
    def __init__(self, ratio=0.003):
        self.ratio = ratio
    def __call__(self, img):
        # ... (实现细节省略)
        return img

train_tf = T.Compose([
    T.RandomResizedCrop(224, scale=(0.8, 1.0)),
    T.RandomHorizontalFlip(p=0.5),
    T.RandomRotation(20),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
    T.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
    # SaltPepperNoise(0.003), # 自定义变换
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225])
])
```
这个流水线整合了多种几何和颜色变换。注意，`Normalize` 步骤通常放在最后，且其均值和标准差应基于预训练模型所使用的数据集（如 ImageNet）来设定。

#### 4.2 可插拔的 Mixup/CutMix

```python
def mixup_data(x, y, alpha=0.2, use_cuda=True):
    '''Returns mixed inputs, pairs of targets, and lambda'''
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1

    batch_size = x.size()[0]
    if use_cuda:
        index = torch.randperm(batch_size).cuda()
    else:
        index = torch.randperm(batch_size)

    mixed_x = lam * x + (1 - lam) * x[index, :]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam

def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)
```
在训练循环中，你可以从 DataLoader 中取出 `inputs` 和 `targets`，调用 `mixup_data` 生成混合数据，然后用 `mixup_criterion` 计算混合后的损失。

#### 4.3 学习曲线监控

在整个训练过程中，必须持续监控训练集和验证集的准确率与损失曲线。一个关键的实践是**早停 (Early Stopping)**：当验证集损失连续 N 个周期（epoch）不再下降反而上升时，就应停止训练，并保存之前验证性能最好的模型权重。这能有效防止模型在训练后期陷入过拟合。

### 5. 综合调优流程

一个系统性的调优流程可以帮助你最大化数据增强的效果：
1.  **建立基线**: 首先在没有任何数据增强的情况下训练模型，记录其准确率和损失作为基准。
2.  **阶段一**: 加入基础的几何和颜色变换，学习率可以保持不变或适当调大。
3.  **阶段二**: 引入 Mixup 或 CutMix，通常需要配合标签平滑 (Label Smoothing) 来获得更好效果。
4.  **阶段三**: 如果计算资源允许，尝试使用 RandAugment 或 AutoAugment 来自动搜索最佳的增强策略组合。
5.  **阶段四**: 最后，根据增强后的数据分布，微调模型的容量（如网络深度）和正则化参数（如 Dropout 率、权重衰减 weight decay）。

### 6. 常见坑 & 实用 Tips

- **过度增强**: 过强的增强可能会使训练集分布与真实测试集分布产生严重漂移，反而损害性能。建议从一个较小的应用概率（如 `p=0.3`）开始试水。
- **标签同步**: 在目标检测或语义分割任务中，对图像进行几何变换时，必须对边界框 (bounding box) 或掩码 (mask) 执行完全相同的变换。
- **验证集纯净度**: 验证集应尽可能保持“干净”，以真实反映模型在原始数据分布上的性能。通常只对其进行必要的缩放 (Resize) 和中心裁剪 (Center Crop)，不做“重口味”的增强。
- **小批量 Mixup**: 在批量大小 (batch size) 很小的情况下使用 Mixup，可能会过度稀释原始信号。此时应考虑适当增大批量或调整学习率。

### 7. 结语与延伸

面对数据稀缺的挑战，我们的核心目标是通过数据增强来**扩充数据的多样性**，而不仅仅是增加数量。欠拟合与过拟合的斗争，本质上是在模型的**容量**与数据的**信息量**之间寻找一个精妙的平衡点。

本文所介绍的策略是解决这一问题的经典起点。在此基础上，你还可以进一步探索更前沿的方向，例如：利用无标签数据进行自监督预训练 (Self-supervised Pre-training)、使用生成模型（如 Diffusion Models）或 3D 渲染来合成新数据、以及应用半监督学习 (Semi-supervised Learning) 等技术。