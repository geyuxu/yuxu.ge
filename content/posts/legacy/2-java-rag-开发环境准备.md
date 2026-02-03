---
date: 2025-04-30
tags: [ai]
legacy: true
---

# Java RAG 开发环境准备

* 环境验证： 打开终端，运行命令 docker --version 检查 Docker 是否安装成功，会输出版本信息。然后运行官方测试容器：
```sh
docker run hello-world
```
正常情况下该命令会从 Docker Hub 拉取一个测试镜像并运行，输出类似 “Hello from Docker! This message shows that your installation appears to be working correctly.” 的提示 。如果看到该消息则表示 Docker 安装运行正常。

## 2. 使用 Docker Compose 搭建 Elasticsearch + Qdrant 环境

有了 Docker 基础环境，接下来使用 Docker Compose 一键启动 Elasticsearch 和 Qdrant 两个服务容器，提供文本检索和向量检索功能。我们将编写一个简单的 docker-compose.yml 配置文件来同时运行这两个服务。
* 创建 Compose 文件： 在项目目录下新建文件 docker-compose.yml，填入以下内容：
```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.9.0  # 指定Elasticsearch镜像版本
    container_name: elasticsearch
    environment:
      - discovery.type=single-node           # 单节点模式，无需集群配置
      - xpack.security.enabled=false         # 禁用安全认证，方便本地测试
      - bootstrap.memory_lock=false
      - ES_JAVA_OPTS=-Xms1g -Xmx1g           # 限制ES JVM内存
    ulimits:
      memlock:
        soft: -1
        hard: -1
    ports:
      - 9200:9200                            # 映射Elasticsearch端口
  qdrant:
    image: qdrant/qdrant:latest              # 使用最新版本的Qdrant镜像
    container_name: qdrant
    ports:
      - 6333:6333                            # REST API端口（HTTP）
      - 6334:6334                            # gRPC端口（用于Spring AI连接）
```

* 启动服务： 在终端执行 docker compose up -d（或 docker-compose up -d）启动容器。第一次运行会自动下载所需镜像，请耐心等待完成。运行后可用 docker ps 查看容器状态，两项服务应均为 Up 状态。
* 验证 Elasticsearch： 打开浏览器访问 http://localhost:9200 ，如果Elasticsearch启动正常，应返回集群的基本信息（默认 {"cluster_name":"docker-cluster",...} 的JSON）。由于我们已禁用安全性，无需认证即可访问。
* 验证 Qdrant： Qdrant 默认通过端口 6333 提供HTTP服务 。在浏览器访问 http://localhost:6333 可查看欢迎信息，确认 Qdrant 正在运行（Qdrant 默认使用6333端口，访问该地址应显示欢迎页面 ）。如果需要进一步验证，可使用命令：
```sh
curl http://localhost:6333/health
```
正常情况下会返回 Qdrant 的健康检查状态信息 JSON。至此，向量数据库 Qdrant 和全文检索引擎 Elasticsearch 的环境已就绪。

## 3. 安装 Java JDK（推荐版本）和 Maven

搭建 Java 开发环境需要安装 JDK 和构建工具 Maven。
* Java JDK 安装： 建议使用Java 17或更高版本的LTS版本（如 Java 21）作为开发JDK。可从 Oracle 官网下载对应的 JDK 安装包并安装，或使用 Homebrew 安装 OpenJDK：
```sh
brew install openjdk@17
```
安装完成后，将 JDK 的 bin 目录加入环境变量，例如将下面一行添加到 ~/.zshrc：
```sh
export PATH="/usr/local/opt/openjdk@17/bin:$PATH"
```
然后运行 java -version 验证安装，应该输出对应版本的 Java 信息。

* Maven 安装： Maven 用于构建和依赖管理。可以从 Apache Maven 官网下载二进制发行包手动安装，或者继续使用 Homebrew 安装：
```sh
brew install maven
```
验证 Maven 是否安装成功，运行 mvn -v 将输出 Maven 版本及 Java 环境等信息。如果能看到版本号说明 Maven 配置成功。

注意： 安装完成后，确保 java 和 mvn 命令在终端路径中可用。如果出现找不到命令，可能需要检查 PATH 配置是否正确。以上环境就绪后，即可进行 Spring Boot 项目创建。

## 4. 创建最小 Spring Boot 项目（包含 Web 和 Qdrant 向量库依赖）

使用 IntelliJ IDEA 来创建一个最小化的 Spring Boot 项目，以包含我们所需的 Web 和 Qdrant Vector Store 支持。
* 初始化项目： 打开 IntelliJ IDEA，选择 “Create New Project” -> Spring Initializr。填写项目的基本信息（如 Group 填写com.example，Artifact 填写rag-demo 等）。选择合适的 Spring Boot 版本（建议 3.1+ 或最新版本），项目类型为 Maven 项目。
* 添加依赖： 在 Initializr 向导中，搜索添加 “Spring Web”（spring-boot-starter-web）依赖，以包含基础的 Web 功能（内嵌Tomcat用于提供 REST 接口）。另外，由于 Spring Initializr 可能尚未收录 Spring AI 的依赖，我们可以先生成项目后再手动添加 Qdrant 的依赖配置。
* 生成并导入项目： 点击 Finish 完成项目创建，IDEA 会自动导入 Maven 项目。项目创建完毕后，在项目的 pom.xml 中添加 Spring AI Qdrant 向量库的 Starter 依赖。例如，在 <dependencies> 节点中加入： 
```xml
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-vector-store-qdrant</artifactId>
    <version>1.0.0-M7</version>  <!-- 使用当前最新的版本号 -->
</dependency>
```
提示： Spring AI 可能提供了 BOM (Bill of Materials) 进行版本管理，如果有需要也可以引入 Spring AI 的 BOM 来简化依赖版本的管理。但上述直接指定依赖坐标方式更简单直接。

* 配置 Qdrant 连接参数： 打开项目的 src/main/resources/application.yml（或 application.properties）文件，添加 Qdrant 连接的基本配置，使 Spring AI 能够自动配置 Qdrant VectorStore。示例配置如下：
```yaml
spring:
  ai:
    vectorstore:
      qdrant:
        host: localhost        # Qdrant 服务主机地址（默认localhost）
        port: 6334             # Qdrant gRPC端口 [oai_citation:4‡docs.spring.io](https://docs.spring.io/spring-ai/reference/api/vectordbs/qdrant.html#:~:text=)
        collection-name: demo_vectors   # 指定向量集合名称
        initialize-schema: true        # 自动初始化集合schema（如果尚未创建集合）
```
以上配置项告知 Spring AI ：Qdrant 服务跑在本机 6334 端口（Qdrant 默认 gRPC 端口为6334 ），使用名称为 “demo_vectors” 的集合存储向量，并在首次连接时自动创建集合（使用默认cosine相似度等）。由于默认开发环境下 Qdrant 没有启用API秘钥认证，这里无需配置 api-key 字段 。

* （可选）配置 Embedding 模型： Spring AI 的向量库使用需要一个 EmbeddingModel 来将文本转换为向量。如果后续需要插入文本并进行相似度搜索，必须配置一个Embedding模型。简单起见，可使用 OpenAI 的文本嵌入模型（如 text-embedding-ada-002）作为Embedding服务。为此，需要再添加 OpenAI 集成依赖，并在配置中提供 OpenAI API Key：
```xml
<!-- 在 pom.xml 中添加 OpenAI 集成 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-openai</artifactId>
    <version>1.0.0-M7</version>
</dependency>
```
然后在 application.yml 中加入：
```yaml
spring:
  ai:
    model:
      openai:
        api-key: sk-xxx...    # OpenAI API密钥
        embedding-model: text-embedding-ada-002  # 指定使用的嵌入模型名称
```
配置好上述内容，Spring AI 会自动创建一个 OpenAI EmbeddingModel Bean，用于将文本转为向量，供 Qdrant VectorStore 存储和搜索使用。
如果没有可用的 OpenAI Key，也可以跳过Embedding模型配置，改为自行实现一个简单的 EmbeddingModel bean（例如返回固定向量用于测试），或暂时直接调用 Qdrant 接口存储自定义向量。不过通常Embedding模型配置好后，通过 Spring AI 的 VectorStore 接口操作会更方便。

完成以上步骤，项目的基础结构与配置就已经准备妥当。接下来编写代码测试向量存储与检索功能。

## 5. 编写测试 Controller 调用 Qdrant 进行向量存储与检索

在 Spring Boot 项目中创建一个简单的 REST 控制器，用于调用 Qdrant 向量库执行插入和检索操作。我们将插入一个示例向量（通过文本生成或直接给定），然后立即尝试检索相似向量，以验证应用与 Qdrant 的集成是否正常。
* 创建控制器类： 在 src/main/java 下新建包（如 com.example.ragdemo.controller），创建一个名为 VectorTestController 的类，并添加如下内容：
```java
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.ai.embeddings.Document;
import org.springframework.ai.vectordb.VectorStore;
import org.springframework.ai.search.SearchRequest;
import java.util.List;
import java.util.Map;

@RestController
public class VectorTestController {
    @Autowired
    private VectorStore vectorStore;  // 自动注入 Qdrant 向量存储接口

    // 简单GET接口，用于插入向量并检索
    @GetMapping("/test-vector")
    public List<String> testVectorStore() {
        // 1. 构造待插入的文档列表（每个Document包含文本和可选的元数据）
        Document doc = new Document("Spring AI 在向量检索中的应用示例", 
                                    Map.of("source", "test"));
        List<Document> documents = List.of(doc);
        // 2. 将文档添加到 Qdrant 向量库（自动完成向量嵌入并存储）
        vectorStore.add(documents);  // 插入文档向量 [oai_citation:7‡docs.spring.io](https://docs.spring.io/spring-ai/reference/api/vectordbs/qdrant.html#:~:text=List,meta2)

        // 3. 使用相似度搜索检索与查询文本语义相近的文档
        SearchRequest request = SearchRequest.builder()
                                  .query("向量检索示例")  // 查询文本
                                  .topK(5)              // 返回前5个相似结果
                                  .build();
        List<Document> results = vectorStore.similaritySearch(request);  // 执行相似度检索 [oai_citation:8‡docs.spring.io](https://docs.spring.io/spring-ai/reference/api/vectordbs/qdrant.html#:~:text=%2F%2F%20Retrieve%20documents%20similar%20to,topK%285%29.build)

        // 4. 提取结果中文档的内容并返回
        List<String> resultContents = results.stream()
                                      .map(Document::getContent)
                                      .toList();
        return resultContents;
    }
}
```
在上述代码中，我们通过 @Autowired 注入了先前配置的 VectorStore（Spring AI 已根据配置自动构建了 QdrantVectorStore 实例）。然后在 /test-vector GET接口中，创建一个 Document 文档（包含文本内容和一些元数据），调用 vectorStore.add() 将其添加到 Qdrant。接着构造一个查询请求，调用 vectorStore.similaritySearch() 执行相似度向量检索，获取相似的 Document 列表，并返回其中的文本内容列表作为接口响应。这里我们使用查询词“向量检索示例”，因为它与插入的示例文本在语义上接近，理应检索出我们插入的文档。
注意： 若之前未配置 EmbeddingModel，这一步在运行时会报错（因为无法将文本转换为向量）。确保已按照前述步骤配置 OpenAI 或其他 Embedding 模型。如果不使用文本生成向量，也可以直接使用 QdrantClient接口存储自定义向量，不过此处为验证流程，使用文本->向量的流程更贴近实际 RAG 场景。

* 检查依赖导入： 确认代码顶部的 import 能够找到对应类。如果 Document, VectorStore, SearchRequest 等类无法导入，可能是 Spring AI 依赖未正确添加或版本不匹配。请检查 Maven 是否成功下载了 Spring AI 的相关库。如果使用的是 Milestone 版本，确保在 Maven 的 repositories 中添加了 Spring Milestones 或 Snapshots 仓库源，或者直接通过 Spring AI BOM 管理依赖版本。

完成控制器编写后，项目代码方面的准备就绪。最后一步是启动应用并验证整个流程。

## 6. 启动应用并验证整条链路

现在我们启动 Spring Boot 应用程序，以及已经运行的 Elasticsearch 和 Qdrant 服务，一起来验证整个RAG环境是否配置正确。
* 启动 Spring Boot 应用： 可以通过 IntelliJ IDEA 直接运行应用（运行 RagDemoApplication.main()），或在项目根目录执行 Maven 命令启动：
```sh
mvn spring-boot:run
```
应用启动时会读取配置连接 Qdrant：如果配置和依赖正确，应能看到日志显示成功连接 Qdrant（以及可能的嵌入模型加载日志）。确保控制台无异常错误。例如，看到 Started RagDemoApplication in [time] seconds 则表示服务已成功启动。

* 验证服务接口： 打开浏览器访问 http://localhost:8080/test-vector （假设 Spring Boot 默认端口未修改仍为8080）。该请求会触发我们在 VectorTestController 中的逻辑。第一次调用可能稍有延迟（因为可能需要通过Embedding模型生成向量）。如果一切正常，浏览器应返回一个JSON数组，其中包含我们插入的文档内容字符串。例如：
```json
["Spring AI 在向量检索中的应用示例"]
```
返回的数组中应含有我们插入的示例文本，表示通过查询找到了该向量文档。这表明应用成功地调用了 Qdrant 向量数据库完成存储和检索，全链路通畅。

* 检查各组件状态： 若接口未正常返回，需检查以下几方面：
  * 应用日志： 查看 Spring Boot 控制台日志，有无连接 Qdrant 的错误（如找不到主机或端口）。若有，确认 Docker Compose 中 Qdrant 容器是否在运行，端口映射是否正确，以及应用配置的 host/port 是否对应。Mac 下 localhost 映射容器通常没问题，如有疑问可将 host 改为 host.docker.internal 试试。
  * Qdrant 容器： 使用 docker compose ps 查看 Qdrant 是否健康运行，或者 docker logs qdrant 查看其日志。有无收到请求或报错。
  * Embedding 模型： 如果报涉及 EmbeddingModel 的错误，确认 OpenAI API Key 是否正确配置且未过期；或者自定义的 EmbeddingModel 实现是否注入。
  * Elasticsearch 容器： 本示例未直接使用 ES，但在实际RAG中ES通常用于存储索引文本。如果需要也可以类似方式写一个简单测试（如使用 RestHighLevelClient 索引一条文档再搜索）。这里主要确保 ES 容器正常启动即可，可通过访问其 API 简单验证。

经过以上步骤，应当成功在本地搭建了一个基本的 Java+Spring AI 项目，并完成了与向量数据库 Qdrant 的联通性测试。这个环境为后续开发 RAG 搜索服务奠定了基础——可以在此之上进一步集成大语言模型调用、完善向量检索与文本检索的结合策略，实现完整的检索增强生成应用。