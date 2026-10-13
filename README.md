# omo-lite

中文 | [English](README.en.md)

一个精简的 Codex 插件，从 [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 的 Codex 移植版改出来。它给 Codex 提供重写过的基础指令、一条给主代理的规则、一组代理角色、若干技能和钩子，以及一个用来读文件的 `omo` 命令。仓库里的每个文件就是 Codex 加载的源文件，没有构建步骤，也没有生成出来的副本。

## 为什么做这个仓库

我们在自己的项目里天天用 oh-my-openagent 的 Codex 移植版，一直在纠正同样几类行为。有两件事让纠正变得很慢。

一是移植版带着一条很重的维护链：共享包和生成包两层、一套引导和自动更新的安装器，还有一批只负责保持各份副本同步的测试。改一行技能也要从头走一遍。这个插件去掉了这条链，改动就是改 Codex 读的那个文件，然后重装。

二是很多要纠正的行为，其实来自 Codex 自带的指令，而不是插件。它要求每 60 秒发一次进度，结果主代理不等子代理，自己把同一个搜索又做了一遍。它要求在请示前先把操作做到“具体、可审查”，结果一个两字节的补丁也配上了带备份和回滚的分步安装器。它还有三处分别要求说明风险和局限，回复因此写成了审计报告。所以这个插件用我们自己写的基础指令整体替换了自带的那份，并把上游原文留在旁边，用来跟踪上游的改动。

另外，Codex 没有读文件的工具。命令的输出原样进入上下文，超过大约 10,000 个 token 才会被截断，而且只留开头和结尾。`omo` 命令用来读文件、搜索和运行命令，输出有上限，并且会告诉你怎么拿到剩下的部分。

## 各部分怎么工作

- **基础指令**（`instructions/codex-base.md`）通过 `model_instructions_file` 替换 Codex 自带的指令。内容包括什么时候动手、什么时候先问，怎么给用户写回复、怎么写文件，以及怎么读、改和写代码。子代理不论用什么模型都会继承它。
- **主代理规则**（`rules/lead.md`）由钩子注入给主代理。内容包括动手前先找方向、哪些工作交出去哪些自己做，以及什么时候用工作流。
- **代理角色**（`agents/*.toml`）为各类子代理设定模型、推理强度和指令：只读的调研代理（explorer、librarian）、三档大小的执行代理、审查代理和规划代理。里面的模型名是我们自己用的，请换成你的账户能用的模型。
- **技能**（`skills/`）放只在部分任务里才用得上的内容：编程和提交规范、调试、前端、浏览器、数据处理、规划和执行工作流、团队模式和会话检索。
- **钩子**（`hooks/`）都是普通的 Node 脚本：

  | 钩子 | 触发时机 | 作用 |
  | --- | --- | --- |
  | `resident-rule.mjs` | 会话开始、提交提示、上下文压缩 | 注入主代理规则，并填入当前会话的模型名；压缩之后只注入一行指向规则文件的提示 |
  | `patch-check.mjs` | `apply_patch` 前后 | 如果补丁的某段能匹配多处就拒绝，因为 `apply_patch` 会默默改掉第一处；接受 JSON 形式的编辑（`{"edit", "old", "new"}`，可选 `"line"` 指明旧文本从哪一行开始）并转成补丁；成功后列出改动的行 |
  | `read-reset.mjs` | 上下文压缩 | 清掉本线程“读过哪些范围”的记录。压缩后再读同一段，`omo read` 会照常输出内容，而不是只给一行“没有变化”的提示；它自己不会往上下文里放回任何内容 |
  | `subagent-context.mjs` | 子代理启动 | 给子代理一个辅助脚本，用来加载任务里 `Context:` 下列出的文件 |
  | `ultrawork-trigger.mjs` | 提交提示 | 把 `/ulw …` 或 `ulw: …` 这类请求引到 ultrawork 技能 |
  | `thread-title.mjs` | 新建线程 | 提醒团队模式的负责人给新线程起标题 |
  | `ulw-execute-continuation.mjs` | 停止 | 让选中的 ulw-execute 计划一直执行到最后的检查通过 |

- **`omo` 命令**（`tools/omo.mjs`）：

  | 命令 | 输出 |
  | --- | --- |
  | `omo read FILE [START-END]` | 带行号的文件内容，每次一页，约 8,000 个 token；同一线程里再读一段没改过的范围，只输出一行提示 |
  | `omo grep PATTERN [PATH...]` | 按文件分组的匹配行，最多 100 行 |
  | `omo glob PATTERN [DIR...]` | 匹配的路径，最多 100 个 |
  | `omo run [--grep REGEX] COMMAND` | 把完整输出存到文件，然后输出退出码、匹配的行和最后 40 行 |

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `.codex-plugin/plugin.json` | 插件清单 |
| `.mcp.json` | 远程检索服务（grep.app、Context7） |
| `instructions/` | 基础指令；主代理和子代理的多代理说明；改写时参照的上游指令原文；`check-upstream.mjs`，列出上游此后改过的章节 |
| `rules/lead.md` | 主代理规则 |
| `agents/` | 代理角色的 TOML 文件 |
| `skills/` | 技能；从别处引入的技能各自带有 `ATTRIBUTION.md` 或 `SOURCE` |
| `hooks/` | `hooks.json` 和各个钩子脚本 |
| `tools/omo.mjs` | `omo` 命令 |
| `install.mjs` | 我们自己用的安装脚本（见下文） |
| `test/` | 测试；这里的内容不会被安装 |

## 安装

大多数人会让 Codex 帮忙装插件，所以这一节是写给实际动手的人或代理看的。安装会修改 `<codex home>/config.toml`（没设 `CODEX_HOME` 时就是 `~/.codex`），而本机所有 Codex 会话都读这个文件，所以每处改动都要先给用户看过再改。需要 PATH 上有 Node.js。

`install.mjs` 会做这些改动：

- 把插件复制到 `<codex home>/plugins/cache/<marketplace>/omo/<version>/`，并在旁边写一条 marketplace 记录（默认名 `sisyphuslabs`，可以用 `--marketplace` 指定）；
- 先把 `config.toml` 备份为 `config.toml.bak-omo-lite`，然后在里面启用 `plugins`、`plugin_hooks` 和 `multi_agent` 三个功能、这个插件和它的 Context7 服务，把 `model_instructions_file` 指向安装好的基础指令，并在 `[features.multi_agent_v2]` 下设置多代理说明；
- 把 `agents/*.toml` 复制到 `<codex home>/agents/`；
- 把 `omo` 命令写到 `~/.local/bin`（可以用 `--bin-dir` 改）。

如果 `config.toml` 已经把 `model_instructions_file` 或某个角色指向了别的文件，或者已有一个不是它写的 `omo` 命令，它会保留原样，并说明跳过了什么。

安装步骤：

1. 克隆仓库，在仓库里运行 `node install.mjs --dry-run`。它会列出所有改动，但什么都不改；把这份清单给用户看。
2. 用户同意后，运行 `node install.mjs`。改动交给安装脚本去做，不要手工编辑 `config.toml`。
3. 把安装脚本列出的“尚未信任”的钩子告诉用户。只有 `config.toml` 里记录了钩子当前定义的哈希，Codex 才会运行这个插件钩子；IDE 也从不询问，所以没被信任的钩子会被悄悄跳过。由用户在终端里的 `codex` 会话中，通过 `/hooks` 审阅并信任它们；代理不要自己计算或写入这些哈希。
4. 重启 Codex，比如重新加载 VS Code 窗口。正在运行的会话会继续用它开始时的指令。

要撤销，就用 `config.toml.bak-omo-lite` 恢复 `config.toml`，再删掉插件的缓存目录。

目前只在 Linux 和 WSL 上验证过。Windows 没有验证过：钩子需要 PATH 上有 `node`，`omo` 命令是 POSIX shell 脚本，不会被安装。

## 开发

```sh
node --test test/                          # 钩子、安装脚本、omo 命令、工作流脚本
python3 -m unittest discover -s test/ultimate-browsing   # 浏览器引擎
bash test/ast-grep/smoke.sh                # ast-grep 辅助脚本
node instructions/check-upstream.mjs       # 列出上游自我们的快照之后改过的章节
```

Codex 自带指令在上游有改动时，`check-upstream.mjs`（安装脚本也会运行它）会列出改过的章节。读完这些章节，把适用的部分吸收进 `codex-base.md`，再替换快照。提交信息遵循[编程技能里的提交规范](skills/programming/references/commit-policy.md#commit-messages)。

## 许可

本仓库派生自 oh-my-openagent，按其 Sustainable Use License 1.0 分发，见 [LICENSE.md](LICENSE.md)。引入的技能保留各自的许可：`skills/frontend`（Apache 2.0）、`skills/ast-grep`（见其 `LICENSE`），以及 `skills/ultimate-browsing` 和 `skills/ulw-research`（见各自的 `ATTRIBUTION.md`）。
