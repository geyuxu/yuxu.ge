---
date: 2024-01-01
tags: [ai, image classification, data augmentation, overfitting, underfitting, pytorch]
legacy: true
---

# Image Classification: Data Scarcity, Augmentation, and Underfitting/Overfitting

| Dimension | Under-fitting | Over-fitting |
| :--- | :--- | :--- |
| **Definition** | The model fails to capture the underlying patterns in the data, exhibiting high bias. | The model learns the noise in the training data as if it were a pattern, exhibiting high variance. |
| **Learning Curve** | Both training and validation loss are high and converge early. | Training loss decreases continuously, while validation loss starts to increase after a certain point. |
| **Analogy** | Trying to fit a complex "S"-shaped curve with a straight line. | Trying to draw a complex path that passes through every single training point. |
| **Trigger** | The model's capacity is much lower than the complexity of the data. | The model's capacity is much higher than the amount of information in the data. |
| **Diagnosis** | Learning curves are parallel and high; bias cannot be reduced. | The gap between training and validation accuracy is large (>5-10%); predictions are often wrong but with high confidence. |
| **Solutions** | ① Increase model capacity or add features. <br> ② Train longer or tune hyperparameters. <br> ③ Reduce regularization. | ① **Data augmentation** or collect more data. <br> ② Use regularization (L1/L2, Dropout, Early Stopping). <br> ③ Simplify the model. <br> ④ Use model ensembling or distillation. |

### 3. Data Augmentation under Data Scarcity

Among all strategies for mitigating over-fitting, data augmentation is one of the most direct and effective methods. It expands the information content of the dataset without additional labeling costs by applying a series of random transformations to the existing training data, creating more diverse samples that the model has "never seen" before.

#### 3.1 Geometric Transformations

These transformations simulate variations in an object's pose, scale, and position that might occur in the real world. Common operations include: random rotation (±15° to ±30°), random scaling (0.8× to 1.2×), and random translation (≤10% of image dimensions). More complex transformations like Elastic Distortion and Perspective Transformation can provide even stronger generalization capabilities.

#### 3.2 Pixel-level Perturbations

These transformations aim to improve the model's robustness to changes in image quality. For instance, adding Gaussian Noise (e.g., σ=0.01-0.05 × 255) or Salt-and-Pepper Noise (e.g., ratio=0.3-0.5%) to the image, and applying GaussianBlur (kernel size=3 or 5) or MotionBlur.

#### 3.3 Color Space Transformations

Transformations in the color space enhance the model's adaptability to variations in lighting, contrast, and color. `ColorJitter` is a common tool that randomly adjusts an image's brightness, contrast, and saturation (e.g., between 0.8 and 1.2 times the original). Converting an image to grayscale and then duplicating it across three channels is another effective technique to force the model to focus on shape rather than color.

#### 3.4 Synthetic/Mixing Methods

In recent years, augmentation methods that mix information from multiple images have become very popular. They create samples that do not exist in the real world but are highly beneficial for model regularization.

| Method | Core Idea | Recommended Probability (p) | Notes |
| :--- | :--- | :--- | :--- |
| **Cutout/GridMask** | Randomly erases one or more rectangular patches from an image. | `p=0.3` | Be careful not to occlude key objects in detection/segmentation tasks. |
| **Mixup** | Linearly interpolates two images and their labels using a ratio λ sampled from a Beta distribution. | `1.0` (as a separate epoch) | α=0.2 is a common hyperparameter. |
| **CutMix** | Cuts a patch from one image and pastes it onto another, with label weights adjusted by the patch area. | `p=0.5` | α=1.0 is a common hyperparameter. |

#### 3.5 Auto-Augmentation

Manually designing augmentation policy combinations is time-consuming. Thus, auto-augmentation methods were developed. **RandAugment** is a simple yet effective method that randomly selects N transformations from a predefined pool and applies them with a uniform magnitude M. It often yields significant gains on small datasets (e.g., with N=2, M=9). The more complex **AutoAugment** uses reinforcement learning to search for the optimal policy combination but is computationally expensive.

### 4. Implementation in PyTorch

Here, we demonstrate how to build a `transform` pipeline in PyTorch that includes various augmentation strategies and implement a plug-and-play Mixup function.

#### 4.1 Transform Pipeline

```python
import torchvision.transforms as T
import torch
import numpy as np

# Custom Salt-and-Pepper noise class
class SaltPepperNoise:
    def __init__(self, ratio=0.003):
        self.ratio = ratio
    def __call__(self, img):
        # ... (implementation omitted)
        return img

train_tf = T.Compose([
    T.RandomResizedCrop(224, scale=(0.8, 1.0)),
    T.RandomHorizontalFlip(p=0.5),
    T.RandomRotation(20),
    T.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
    T.GaussianBlur(kernel_size=5, sigma=(0.1, 2.0)),
    # SaltPepperNoise(0.003), # Custom transform
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225])
])
```
This pipeline integrates various geometric and color transformations. Note that the `Normalize` step is typically placed at the end, and its mean and standard deviation should be set based on the dataset used for the pre-trained model (e.g., ImageNet).

#### 4.2 Plug-and-Play Mixup/CutMix

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
In your training loop, you can fetch `inputs` and `targets` from the DataLoader, call `mixup_data` to generate mixed data, and then compute the mixed loss using `mixup_criterion`.

#### 4.3 Learning Curve Monitoring

Throughout the training process, it is crucial to continuously monitor the accuracy and loss curves for both the training and validation sets. A key practice is **Early Stopping**: when the validation loss stops decreasing and starts to rise for N consecutive epochs, training should be halted, and the model weights with the best previous validation performance should be saved. This effectively prevents the model from over-fitting in the later stages of training.

### 5. Integrated Tuning Workflow

A systematic tuning process can help you maximize the effectiveness of data augmentation:
1.  **Establish Baseline**: First, train the model without any data augmentation and record its accuracy and loss as a baseline.
2.  **Phase 1**: Add basic geometric and color transformations; the learning rate can be kept the same or slightly increased.
3.  **Phase 2**: Introduce Mixup or CutMix, often in conjunction with Label Smoothing for better results.
4.  **Phase 3**: If computational resources permit, try using RandAugment or AutoAugment to automatically search for the optimal augmentation policy.
5.  **Phase 4**: Finally, fine-tune the model's capacity (e.g., network depth) and regularization parameters (e.g., Dropout rate, weight decay) based on the augmented data distribution.

### 6. Common Pitfalls & Practical Tips

- **Over-augmentation**: Excessive augmentation can cause a significant distribution shift between the training set and the actual test set, thereby hurting performance. It's advisable to start with a small application probability (e.g., `p=0.3`).
- **Label Synchronization**: In object detection or semantic segmentation tasks, when applying geometric transformations to an image, the exact same transformations must be applied to the bounding boxes or masks.
- **Validation Set Purity**: The validation set should be kept as "clean" as possible to accurately reflect the model's performance on the original data distribution. Typically, only necessary resizing and center cropping are applied, without heavy augmentation.
- **Mixup with Small Batches**: Using Mixup with a very small batch size can excessively dilute the original signal. In such cases, consider increasing the batch size or adjusting the learning rate.

### 7. Conclusion & Further Exploration

When faced with the challenge of data scarcity, our core objective is to **expand the diversity** of the data through augmentation, not just to increase its quantity. The struggle against under-fitting and over-fitting is essentially about finding a delicate balance between the model's **capacity** and the data's **information content**.

The strategies introduced in this article are a classic starting point for solving this problem. Building on this foundation, you can further explore more advanced directions, such as: using unlabeled data for Self-supervised Pre-training, synthesizing new data with generative models (like Diffusion Models) or 3D rendering, and applying Semi-supervised Learning techniques.