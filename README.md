# omo-lite

中文 | [English](README.en.md)

一个精简的 Codex 插件，从 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 的 Codex 移植版改出来。它给 Codex 提供重写过的基础指令、一条给主代理的规则、一组代理角色、若干技能和钩子，以及一个用来读文件的 `omo` 命令。仓库里的每个文件就是 Codex 加载的源文件，没有构建步骤，也没有生成出来的副本。

## 快速开始

需要 PATH 上有 Node.js。目前只在 Linux 和 WSL 上验证过。

```sh
git clone https://github.com/Floliurry/omo-lite.git
cd omo-lite
node install.mjs --dry-run   # 列出所有改动，什么都不改
node install.mjs             # 确认无误后再真正安装
```

装完之后：

1. 在终端里打开 `codex`，用 `/hooks` 审阅并信任安装脚本列出的钩子。没被信任的钩子会被悄悄跳过，IDE 也不会询问。
2. 重启 Codex，比如重新加载 VS Code 窗口。正在运行的会话会继续用它开始时的指令。
3. `agents/*.toml` 里的模型名是我们自己用的，换成你的账户能用的模型后重新安装。

安装会改哪些东西、怎么撤销，见下文的[安装说明](#安装说明)。

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| [`instructions/`](instructions/README.md) | 替换 Codex 自带指令的基础指令；主代理和子代理的多代理说明；上游指令快照和比对脚本 |
| [`rules/`](rules/README.md) | 由钩子注入给主代理的规则 |
| [`agents/`](agents/README.md) | 代理角色：查询、调研、执行、审查和规划 |
| [`skills/`](skills/README.md) | 只在部分任务里用得上的技能 |
| [`hooks/`](hooks/README.md) | `hooks.json` 和各个钩子脚本 |
| [`tools/`](tools/README.md) | `omo` 命令：输出有上限的读文件、搜索和运行命令 |
| [`test/`](test/README.md) | 测试；这里的内容不会被安装 |
| `.codex-plugin/plugin.json` | 插件清单，指向技能目录、钩子和 MCP 配置 |
| `.mcp.json` | 远程检索服务（grep.app、Context7） |
| `install.mjs` | 安装脚本 |

## 为什么做这个仓库

我们在自己的项目里天天用 oh-my-openagent 的 Codex 移植版，一直在纠正同样几类行为。有两件事让纠正变得很慢。

一是移植版带着一条很重的维护链：共享包和生成包两层、一套引导和自动更新的安装器，还有一批只负责保持各份副本同步的测试。改一行技能也要从头走一遍。这个插件去掉了这条链，改动就是改 Codex 读的那个文件，然后重装。

二是很多要纠正的行为，其实来自 Codex 自带的指令，而不是插件。它要求每 60 秒发一次进度，结果主代理不等子代理，自己把同一个搜索又做了一遍。它要求在请示前先把操作做到“具体、可审查”，结果一个两字节的补丁也配上了带备份和回滚的分步安装器。它还有三处分别要求说明风险和局限，回复因此写成了审计报告。所以这个插件用我们自己写的基础指令整体替换了自带的那份，并把上游原文留在旁边，用来跟踪上游的改动。

另外，Codex 没有读文件的工具。命令的输出原样进入上下文，超过大约 10,000 个 token 才会被截断，而且只留开头和结尾。`omo` 命令用来读文件、搜索和运行命令，输出有上限，并且会告诉你怎么拿到剩下的部分。

## 安装说明

大多数人会让 Codex 帮忙装插件，所以这一节是写给实际动手的人或代理看的。安装会修改 `<codex home>/config.toml`（没设 `CODEX_HOME` 时就是 `~/.codex`），而本机所有 Codex 会话都读这个文件，所以每处改动都要先给用户看过再改。

`install.mjs` 会做这些改动：

- 把插件复制到 `<codex home>/plugins/cache/<marketplace>/omo/<version>/`，并在旁边写一条 marketplace 记录（默认名 `sisyphuslabs`，可以用 `--marketplace` 指定）；
- 先把 `config.toml` 备份为 `config.toml.bak-omo-lite`，然后在里面启用 `plugins`、`plugin_hooks` 和 `multi_agent` 三个功能、这个插件和它的 Context7 服务，把 `model_instructions_file` 指向安装好的基础指令，并在 `[features.multi_agent_v2]` 下设置多代理说明；
- 把 `agents/*.toml` 复制到 `<codex home>/agents/`；
- 把 `omo` 命令写到 `~/.local/bin`（可以用 `--bin-dir` 改）。

如果 `config.toml` 已经把 `model_instructions_file` 或某个角色指向了别的文件，或者已有一个不是它写的 `omo` 命令，它会保留原样，并说明跳过了什么。

代理代为安装时：

1. 先运行 `node install.mjs --dry-run`，把它列出的改动清单给用户看。
2. 用户同意后，运行 `node install.mjs`。改动交给安装脚本去做，不要手工编辑 `config.toml`。
3. 把安装脚本列出的“尚未信任”的钩子告诉用户。只有 `config.toml` 里记录了钩子当前定义的哈希，Codex 才会运行这个插件钩子。由用户在终端里的 `codex` 会话中，通过 `/hooks` 审阅并信任它们；代理不要自己计算或写入这些哈希。
4. 提醒用户重启 Codex。

要撤销，就用 `config.toml.bak-omo-lite` 恢复 `config.toml`，再删掉插件的缓存目录。

Windows 没有验证过：钩子需要 PATH 上有 `node`，`omo` 命令是 POSIX shell 脚本，不会被安装。

## 开发

```sh
node --test test/                          # 钩子、安装脚本、omo 命令、工作流脚本
python3 -m unittest discover -s test/ultimate-browsing   # 浏览器引擎
bash test/ast-grep/smoke.sh                # ast-grep 辅助脚本
node instructions/check-upstream.mjs       # 列出上游自我们的快照之后改过的章节
```

Codex 自带指令在上游有改动时，`check-upstream.mjs`（安装脚本也会运行它）会列出改过的章节。读完这些章节，把适用的部分吸收进 `codex-base.md`，再替换快照，详见 [`instructions/`](instructions/README.md)。提交信息遵循[编程技能里的提交规范](skills/programming/references/commit-policy.md#commit-messages)。

## 许可

本仓库派生自 oh-my-openagent，按其 Sustainable Use License 1.0 分发，见 [LICENSE.md](LICENSE.md)。引入的技能保留各自的许可：`skills/frontend`（Apache 2.0）、`skills/ast-grep`（见其 `LICENSE`），以及 `skills/ultimate-browsing` 和 `skills/ulw-research`（见各自的 `ATTRIBUTION.md`）。
