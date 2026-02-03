---
date: 2025-05-06
tags: [ai]
legacy: true
---

# Windows 11 下两种 CUDA 开发环境配置（wsl & 本地工具链）

安装最新驱动后，我们需要设置 WSL2 及 Linux 子系统环境。 在 Windows 11 中，WSL2 的启用和 Ubuntu 发行版的安装非常简便：

1. **启用 WSL功能：** 以管理员身份打开 PowerShell，执行命令启用所需组件：
```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```
然后重启电脑。Windows 11 也支持更快捷的方法：直接在 PowerShell 中运行 wsl --install 即可自动启用并安装默认的 Ubuntu 子系统。

2. **升级 WSL 内核：** 确保 WSL2 内核是最新版本。一般 Windows 11 会随系统更新推送最新的 WSL内核，也可以手动执行：
```powershell
wsl --update
```
核心需不低于 5.10.43.3 才支持 GPU 功能。可通过命令 wsl cat /proc/version 在 PowerShell 检查内核版本。

3. **安装 Ubuntu 发行版：**

```power
# 查看可用的wsl发行版
wsl --list --online

# 安装ubuntu
'wsl.exe --install ubuntu
```

安装完成后执行`wsl`命令进入ubuntu，对系统及进行基本配置。


完成以上步骤后，Windows 11 上的 WSL2 + Ubuntu 基础环境就准备就绪。


## 配置本地工具链与 CUDA 开发环境

在 Windows 环境下，我们可以选择两种方式来配置 CUDA 开发环境：本地工具链 和 WSL工具链。这两种方式都可以在 VSCode 中进行开发。接下来将介绍这两种配置方法。

### 本地工具链配置
本地工具链是指直接在 Windows 主机上安装并配置所有开发工具，包括 Visual Studio 和 CUDA 工具包。以下是详细步骤：

**安装 Visual Studio 和 C++ Desktop 组件：** 首先安装 Visual Studio 2022（推荐使用最新版本），并在安装过程中选择 Desktop development with C++ 工作负载，确保安装了 MSVC 编译器 和 Windows SDK 等组件。该工作负载会自动为你安装所需的 C++ 开发工具。

**注意** ：必须安装c++桌面程序组件，否则没有本地c++工具链

**配置环境变量：** 为了让 CUDA 编译器（nvcc）和 MSVC 编译器能够正常工作，需要将 Visual Studio 的 MSVC 工具路径添加到系统的环境变量 PATH 中。可以通过以下路径进行配置（请根据自己安装的vs版本进行调整）：

```bash
C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64
```
你可以手动进入系统环境变量设置，或者通过 PowerShell 执行以下命令来添加：

```powershell
setx PATH "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Tools\MSVC\14.43.34808\bin\Hostx64\x64;$env:PATH"
```
**安装 CUDA Toolkit：**下载并安装 CUDA 12.9 的本地版本（[cuda官方下载](https://developer.nvidia.com/cuda-downloads)），确保安装路径为默认路径（通常为 C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.9）。安装时，确保勾选 NVIDIA 驱动程序 和 CUDA Toolkit。安装完成后，CUDA 的 bin 目录会自动被添加到环境变量 PATH 中。

**验证安装**：

* 在本地编写hello.cu

  ```c
  #include<stdio.h>
  __global__ void cuda_hello(){
      printf("Hello world from GPU\n");
  }
  
  int main(){
      cuda_hello<<<4,8>>>();
      cudaDeviceSynchronize();
      return 0;
  }
  ```

* powershell中运行`nvcc .\hello.cu -o hello`进行编译

  ![image-20250506233805553](/blog/images/legacy/image-20250506233805553.png)

* 执行hello.exe程序

  ![image-20250506233944058](/blog/images/legacy/image-20250506233944058.png)

### WSL工具链配置
如果你希望在 WSL2 中运行和调试 CUDA 程序，可以选择使用 WSL 工具链。下面是如何在 WSL2 的 Ubuntu 中配置 CUDA 开发环境：

1. **安装 CUDA 工具包：** 首先，在 WSL2 Ubuntu 中安装 [CUDA 工具包](https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0&target_type=deb_network)。可以通过以下命令安装：

```bash
wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb
sudo dpkg -i cuda-keyring_1.1-1_all.deb
sudo apt-get update
sudo apt-get -y install cuda-toolkit-12-9
```
2. **验证 CUDA 安装：** 安装完成后，运行 nvcc --version 检查 CUDA 是否安装成功。如果返回 CUDA 编译器的版本信息，说明 CUDA 已正确安装。

   ![image-20250506234103468](/blog/images/legacy/image-20250506234103468.png)

   同本地验证，在ubuntu下创建hello.cu文件，执行编译命令`nvcc ./hello.cu -o hello`

   ![image-20250506234342283](/blog/images/legacy/image-20250506234342283.png)

   ![image-20250506234751954](/blog/images/legacy/image-20250506234751954.png)

3. **安装 VSCode 和插件：** 在 Windows 上安装 Visual Studio Code 并安装 Remote - WSL 插件，这样可以在 VSCode 中通过 WSL 直接编辑和运行 WSL 内的代码。通过 Remote-WSL: New Window 命令打开 WSL2 中的文件夹并开始编辑代码。

## 结语
通过以上步骤，我们成功配置了 Windows 11 上的 CUDA 开发环境，并可以通过 VSCode 使用本地工具链或 WSL 工具链进行开发。本文暂时只做到使用vscode进行编辑，没有对调式进行配置，以后会有专文讲解几种主流IDE的cuda开发调试环境配置。无论你选择在 Windows 环境中使用本地工具链，还是在 WSL2 中使用远程工具链，都能够方便高效地进行 CUDA 开发，充分发挥你的 NVIDIA 显卡的计算能力。