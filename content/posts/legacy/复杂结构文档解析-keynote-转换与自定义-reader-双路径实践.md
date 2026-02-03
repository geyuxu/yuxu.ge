---
date: 2024-10-06
tags: [ai]
legacy: true
---

# 复杂结构文档解析：Keynote 转换与自定义 Reader 双路径实践

路径 A 的思路是开发一个自定义“读取器”（Reader），使其能够直接从 Keynote 文件中提取结构化的内容，而不需要中间转换为其他格式。由于 Keynote .key 文件采用苹果的专有压缩二进制格式，内部实际是一个包含多个资源的压缩包（ZIP），其中既有图像、视频等资源文件，也有使用 Snappy 压缩的 Protobuf .iwa 二进制数据，存储了文档的元数据、文本和所有其他定义 。这意味着一般的文本解析库（例如直接读取为文本）对 .key 文件不起作用，我们需要利用专门的工具或库才能解包并读取其中的内容。

一种可行方案是使用开源项目 keynote-parser（一个针对 Keynote 文件的打包/解包 Python 模块）。该工具可以将 Keynote 文件解压并解码成可读的文本形式（例如 YAML 文件）供我们提取信息 。具体而言，keynote-parser 支持将 .key 文件拆解为独立文件夹，其中包括解析后的 YAML 文件，我们可以从中提取幻灯片的文本、备注，以及表格单元格等内容。下面是一个简单的示例流程：
```sh
# 安装 keynote-parser 工具
pip install keynote-parser

# 将 Keynote 文件解包为文件夹结构（生成 ./MySlides/ 目录）
keynote-parser unpack MySlides.key
```
执行上述命令后，会生成一个名为 MySlides/ 的文件夹，其中包含解析出的 YAML 文件和资源。例如，每张幻灯片可能对应一个 Slide-XXXX.yaml，其中记录了该幻灯片上的对象属性和文本内容。我们可以编写脚本读取这些 YAML，抽取我们需要的文本和结构信息。例如，对于表格，我们可以在 YAML 中定位表格单元格的文本；对于流程图和形状，我们可以提取形状中的文字（尽管形状之间的连线关系在纯文本中可能无法直接反映）。

使用自定义 Reader 时，我们可以选择将提取到的内容组装成结构化文本（例如以 Markdown 或特定标记表示表格），或者直接生成用于索引的文本块。在 LangChain 或 LlamaIndex 等框架中，可以通过继承它们的基类来创建自定义文档加载器。例如，在 LangChain 中可以继承 BaseLoader 来创建一个 KeynoteLoader 类，在其 load() 方法中实现上述解析逻辑。伪代码示例如下：
```py
from langchain.docstore.document import Document
from langchain.document_loaders import BaseLoader
import subprocess, os

class KeynoteLoader(BaseLoader):
    def __init__(self, file_path: str):
        self.file_path = file_path

    def load(self) -> list[Document]:
        # 使用 keynote-parser 将 .key 解包
        output_dir = os.path.splitext(self.file_path)[0]  # 去掉扩展名作为文件夹名
        subprocess.run(["keynote-parser", "unpack", self.file_path, "-o", output_dir])
        text_chunks = []
        # 遍历解包后的目录，读取所有 YAML 文件中的文本内容
        for root, dirs, files in os.walk(output_dir):
            for fname in files:
                if fname.endswith(".yaml"):
                    text_chunks.append(extract_text_from_yaml(os.path.join(root, fname)))
        # 将提取的文本合并为一个字符串，或根据需要拆分
        full_text = "\n".join(text_chunks)
        # 封装为 Document 对象返回
        return [Document(page_content=full_text, metadata={"source": self.file_path})]
```
上述代码中，extract_text_from_yaml 是需自行实现的函数，用于解析 YAML 内容并提取其中的文本（例如提取所有字段中的字符串，不包括样式等无关信息）。通过这种方式，我们的自定义加载器可以直接处理 .key 文件。在后续建立索引时，我们就能够获取 Keynote 幻灯片中的文字说明、表格数据等原生文本内容，而无需转换为中间格式。

优点：路径 A 避免了转换可能带来的信息损失，理论上可以提取出更多结构信息。例如，表格可以保持行列对应关系，幻灯片的备注（notes）也能被抓取到（前提是 .key 文件中有存储）。对于流程图，虽然自动识别图形连接关系比较困难，但至少每个图形中的文字说明是可提取的。通过自定义解析，我们还可以加入特殊处理逻辑，比如对表格文字加上标记（如用 Markdown 表格语法表示）以保留结构，方便日后在生成回答时呈现。

挑战：实现路径 A 需要投入一定的工程工作：keynote-parser 虽然帮我们解码了文件格式，但我们仍需理解其输出的结构才能正确提取所需内容。另外，该方案依赖于特定版本的 Keynote 文件格式定义，如果将来出现新的 Keynote 版本，解析器可能需要更新适配。不过，截至当前（2025年）Keynote 的格式演变并不频繁，已有的解析工具足以支持最新版本 。总的来说，路径 A 适合对解析质量要求很高且具备开发能力的团队，能够最大程度定制对复杂内容的处理。

## 路径 B：Keynote 转 PDF 再利用解析工具

路径 B 是更通用且直接的方法：先将 Keynote 文件批量转换为 PDF，然后使用成熟的文档解析工具提取 PDF 中的信息。许多文档解析库和服务对 PDF 的支持都非常完善，包括版面解析、文字提取、表格识别等。而 Keynote 应用本身提供了导出为 PDF 的功能，我们可以借助AppleScript 脚本或 Keynote 自带命令行工具来自动化这个批量转换过程。

### Keynote 自动导出 PDF

在 macOS 环境下，AppleScript 提供了对 Keynote 的脚本控制接口。通过编写AppleScript，我们可以让 Keynote 在后台打开每个 .key 文件并执行“导出为 PDF”操作。例如，下面是一段简单的 AppleScript 脚本示例，将某个 Keynote 文档导出为 PDF：
```applescript
-- 假设 Keynote 已安装在本机
set keynoteFile to POSIX file "/路径/至/文件/MySlides.key" as alias
set exportPath to POSIX file "/路径/至/导出/MySlides.pdf" as text

tell application "Keynote"
    open keynoteFile
    -- 将当前打开的文档导出为 PDF
    export document 1 to file exportPath as PDF
    close document 1
end tell
```
这段脚本调用了 Keynote 的export命令，将第一个文档导出为 PDF 文件 。我们可以通过 macOS 的终端 osascript 命令批量执行类似的脚本，对一个目录下的所有 .key 文件进行转换。例如：
```sh
# 假设 current_dir 下有多个 .key 文件
for f in *.key; do
  echo "Converting $f to PDF..."
  osascript -e "tell application \"Keynote\" to export document 1 of (open POSIX file \"$(pwd)/$f\" as alias) to POSIX file \"$(pwd)/${f%.key}.pdf\" as PDF"
done
```
上面的 shell 脚本使用了一行 AppleScript 命令来打开并导出每个 Keynote文件（注意：`$(pwd)`获取当前目录完整路径，`${f%.key}.pdf`将扩展名替换为 .pdf）。这种方法无需手动操作，可高效地将批量 Keynote 转换成 PDF格式。在转换时，有几个实用的技巧：
* 包括备注和隐藏幻灯片： 如果演示文稿包含演讲者备注或者被跳过的幻灯片，导出PDF时可以考虑勾选包含这些内容（AppleScript export命令也支持一些属性，比如是否包含跳过的幻灯片、导出备注等  ）。确保需要的所有信息都进入PDF。
* 图像质量设置： Keynote 导出 PDF 时可以选择图像质量（如标准/更好/最佳）。如果文件中有精细的流程图图片，需要高质量以便后续OCR或识别，可以在 AppleScript 中指定 PDF image quality 属性为 "best" 。
* 批处理环境：上述方法需要在安装有 Keynote 的 macOS 环境运行。如果没有Mac环境，可以考虑使用iCloud Keynote Web版手动导出，或借助 Mac 云主机来执行 AppleScript。另一方面，也可以尝试利用 Quick Look 预览来提取PDF（如果 .key 文件在保存时勾选了“在文件中包含预览”，那么 .key 文件包内的 QuickLook/Preview.pdf 就是一份PDF预览，可直接解压获取  ）。

当我们成功获得 PDF 文件后，接下来的解析工作就与解析普通 PDF 无异了。

### 解析 PDF 内容

目前有许多工具可以高效解析 PDF 文档的内容，常见选择包括：
* Unstructured：一个开源的Python库，支持将PDF解析为文本及元素列表。它能识别段落、标题、表格等元素，输出结构化的文本块。例如使用 unstructured.partition.pdf 模块可以解析出文档的每个部分。
* LangChain 文档加载器：LangChain内置了一些针对PDF的加载器（例如 PyPDFLoader 或 UnstructuredPDFLoader），可以方便地将PDF读取为文本和元数据，直接生成用于向量索引的Document对象列表。
* DashScope Parse：阿里云提供的文档解析服务，通过其 LlamaIndex 接口（DashScopeParse）可以解析PDF、Word文档等并输出结构化的结果  。这类服务往往基于深度学习模型，能够提取表格、段落甚至表单等复杂结构，比简单的文本提取更智能。不过需要API调用及一定费用。

举例来说，如果选择使用 Unstructured，可以按以下方式获取PDF文本：
```py
from unstructured.partition.pdf import partition_pdf

pdf_file = "MySlides.pdf"
elements = partition_pdf(filename=pdf_file)
# elements 是文档元素列表，可包含 Title, NarrativeText, Table 等不同类型
text_segments = [elem.text for elem in elements if hasattr(elem, "text")]
full_text = "\n".join(text_segments)
print(full_text[:500])  # 打印前500字符预览
```
上述代码利用 partition_pdf 将 PDF 文件拆解成元素列表，然后提取其中的文本部分拼接起来。对于表格元素，unstructured 通常会将其转换成Markdown格式的表格文本，保证结构尽可能保留。我们也可以根据元素类型做进一步处理，比如给每个幻灯片的内容加上标题标识，或将每张幻灯片作为单独的Document来保留分段索引。

如果使用 LangChain 的加载器，则更加简洁：
```py
from langchain.document_loaders import PyPDFLoader

loader = PyPDFLoader("MySlides.pdf")
docs = loader.load()  # 将PDF按页面等切分成多个Document
print(docs[0].page_content[:200])  # 打印第一个Document的一部分文本
```
LangChain 的加载器会将 PDF 拆成一个或多个 Document（通常按页拆分，或由用户指定拆分策略），方便直接用于后续的嵌入向量构建和索引。在我们的场景下，如果希望每张幻灯片作为单独一段，可以在导出 PDF 时选择每张幻灯片为一页，然后每页即对应一个 Document。

解析效果：Keynote 转 PDF 再解析的效果取决于 PDF 中内容的表达方式。大多数情况下，幻灯片上的文字在PDF中仍是文本（可选中复制），因此解析工具能抓取到所有文本。对于流程图，连线和图形本身不会直接转换成有语义的文本，但图形中的文字标签会以文本形式存在。例如，一个包含流程节点的幻灯片，其PDF中每个节点标题、描述文字都能提取出来，只是缺少“箭头指向”等关系信息。表格通常在PDF中也以单元格文字形式存在，解析工具可能输出为连续的文本行（或者某些高级解析服务会返回表格结构）。总的来说，路径 B 能快速获取文字内容，但对结构的表达相对朴素（不保留太多版式信息）。幸运的是，在RAG应用中，我们更关注文字本身的检索，结构次之，因此这种方法已经能满足大部分检索需求。

工程实现提示：如果需要对解析出的结果做后续处理（如存入向量数据库），可以考虑在解析阶段就添加元数据。例如添加每个文本块对应的幻灯片编号、标题，或者对表格里的内容添加标签（如来自第X页表格）。这样在检索结果中可以追溯出处或渲染格式。在使用 LlamaIndex 等框架时，可以直接将解析得到的文本传入索引构建；如果使用向量数据库+LangChain，则将 Document 列表存入向量库并为每个Document附加metadata（比如 {"source": "slides1.pdf", "page": 2} 等）。

## 常见误区与注意事项

在尝试解析 Keynote 这类复杂文档用于索引时，有一些常见的误区值得注意：
* 误区1：调高 RAG 检索的 chunk 数量能弥补解析不全的问题。 有些开发者在检索不到正确内容时，倾向于增加返回的文档片段数量（例如从 top-5 提高到 top-10）。然而，如果解析阶段内容提取不完整或有误，盲目增加检索片段只会返回更多无关或重复的信息，并不能 magically 补全原本未提取出的内容。正确的做法是先提升解析质量（确保所有有用内容都被提取并索引），而不是依赖检索时多抓些结果来碰运气。
* 误区2：直接传入 .key 文件给解析器即可解析。 如前文所述，Keynote .key 并非文本文档，解析器若不支持该格式会直接报错或返回空结果。例如，阿里云的 DashScope Parse 明确仅支持 .doc、.docx、.pdf 等常见文档格式，不接受 Keynote 原生格式 。因此，无论使用何种解析工具，首先要确保输入是受支持的格式。对于不支持的格式，需要我们预处理转换（这正是路径 B 的意义所在）。切勿将未处理的 Keynote 文件直接喂给解析接口，这只会浪费调用次数或得到错误。
* 注意 Keynote 文件版本兼容性： 如果采取路径 A，自定义解析需要关注 Keynote 文件的版本。Keynote 格式可能随着软件升级有所变化，好在像 keynote-parser 这类工具会及时更新以支持新版本（例如其当前版本已支持 Keynote 14.4） 。务必使用最新版本的解析库，并在升级 Keynote 应用后测试解析是否仍然正常。路径 B 则相对不受此影响，因为 PDF 是稳定通用的格式。
* OCR 及图像识别： 在某些极端情况下，幻灯片上的内容可能以图像形式存在（例如扫描件或手写笔记嵌入在Keynote中）。对于这部分纯图像内容，PDF 解析也无法直接获得文字，需要集成 OCR（光学字符识别）步骤。可以使用开源 OCR 库如 Tesseract，或第三方OCR API，将PDF中的图片区域提取出文字。一般 Keynote 幻灯片不会把文本存成图片，但要防范这种特殊情况。
* 效率考虑： 批量处理大量 Keynote 文件时，要考虑转换和解析的效率。AppleScript 导出 PDF 的过程可能较耗时（需要逐个打开文件）。可以尝试使用并行的方法，例如利用多进程同时开启多个 Keynote 实例导出（不过Keynote应用可能限制并发，需谨慎）。或者先用 keynote-parser 批量解包，再并行处理文本提取。合理的批处理和缓存机制能加速整体流程。

## 结论

对于含有复杂结构（流程图、表格、备注等）的 Keynote 文档，构建高质量的索引以支持 RAG 应用，需要我们在解析阶段下功夫。本文讨论了两种实践路径：其一，通过自定义 Reader 直接解析 .key 文件内部结构，实现对原始内容的提取；其二，将 Keynote 转换为通用的 PDF 格式，再借助成熟的解析工具提炼文字信息。两种方法各有适用场景——自定义解析能够获取更丰富的结构化信息，但实现成本较高；转换PDF则胜在快速可靠、利用现有工具即可完成。

面向数据工程和AI应用开发实践，我们更倾向于组合运用这两种思路：对于特别重要或复杂的文件，可投入精力定制解析逻辑（路径 A），以确保关键内容不遗漏并保留结构；而对大批一般文件，则走转换+解析流程（路径 B），以较高的性价比完成索引构建。在这个过程中，避免常见误区，关注工具支持情况和转换细节，才能最终提升复杂文档的可解析性和检索质量。

通过上述指南，希望读者能够清晰了解如何处理 Keynote 这类复杂文档的解析任务。从导出脚本的编写到解析代码的实现，我们提供了具体的示例和经验教训。实践中根据项目需要选择合适的路径，并不断迭代优化解析效果，便能为后续的 RAG 应用打下坚实的数据基础。祝各位在工程项目中取得更高效的文档处理和知识获取能力！