# skills

Codex 技能。每个技能是一个目录，入口是 `SKILL.md`：开头的 frontmatter 写名字和描述，Codex 只把描述放进上下文，任务对上了才读正文。正文里提到的 `references/` 和 `scripts/` 按需再读、再运行。插件清单 `.codex-plugin/plugin.json` 把这个目录登记为技能来源。

## 技能列表

### 编程与调试

| 技能 | 用途 |
| --- | --- |
| [`programming`](programming/SKILL.md) | 实现、保持行为不变的重构、按要求清理代码，以及本地提交：什么时候可以提交、怎么分组、提交信息怎么写；附 Python、Rust、TypeScript、Go 的写法参考 |
| [`debugging`](debugging/SKILL.md) | 调查原因不明的崩溃、错误结果、卡死、泄漏和偶发故障；按运行时（Node、Python、Go、Rust、原生二进制）和工具（DAP、Frida、Ghidra、pwndbg 等）分别给出参考 |
| [`ast-grep`](ast-grep/SKILL.md) | 按语法结构搜索和改写代码，支持 25 种语言；纯文本搜索仍用 `rg` |

### 前端与浏览器

| 技能 | 用途 |
| --- | --- |
| [`frontend`](frontend/SKILL.md) | 设计和实现网页与界面：布局、样式、图片和动效；新页面、改版、按截图或线上网站还原 |
| [`ultimate-browsing`](ultimate-browsing/SKILL.md) | 浏览器交互、渲染后的页面证据、需要登录的会话，以及页面打不开时的备用访问手段 |
| [`visual-qa`](visual-qa/SKILL.md) | 成品界面（网页、全屏终端界面、分页文档）的独立视觉验收：截图证据、两位审查者和结论 |

### 数据与检索

| 技能 | 用途 |
| --- | --- |
| [`data-scientist`](data-scientist/SKILL.md) | 用 DuckDB、Polars 等处理和分析 CSV、Parquet、JSON 数据，以及作图 |
| [`ulw-research`](ulw-research/SKILL.md) | 用户明确要求时做穷尽式调研，对高风险结论设检查点，产出带引用的报告 |
| [`coding-agent-sessions`](coding-agent-sessions/SKILL.md) | 查找、阅读和还原 Codex、Claude、OpenCode 等编程代理的本地会话记录 |

### 规划与执行工作流

| 技能 | 用途 |
| --- | --- |
| [`project-plan`](project-plan/SKILL.md) | 和用户一起摸清不明确的新项目或方向调整：调研、做小范围的隔离实验，维护项目背景和暂定计划 |
| [`ulw-plan`](ulw-plan/SKILL.md) | 用户选定时使用的严格规划：先调研，再出确认摘要和计划骨架，需要时让 Metis 做缺口分析 |
| [`ulw-execute`](ulw-execute/SKILL.md) | 用户选定时，按选中的计划执行，用 Boulder 记录状态、证据和验证 |
| [`ultrawork`](ultrawork/SKILL.md) | 带明确验收标准和证据的执行方式；用户要求，或主代理初步调查后认为需要时使用 |
| [`review-work`](review-work/SKILL.md) | 实现完成后的把关：先亲自做手动 QA，再派一位把关审查者 |
| [`init-deep`](init-deep/SKILL.md) | 为项目生成分层的 `AGENTS.md`，记录结构、命令和约定 |

### 多代理协作

| 技能 | 用途 |
| --- | --- |
| [`teammode`](teammode/SKILL.md) | 创建、协调、查看或解散一个有共享状态的命名 Codex 团队 |
| [`claude-code`](claude-code/SKILL.md) | 调用本机的 Claude Code 获取第二意见或审查，会话可观察、可续用 |

主代理什么时候用哪个工作流，写在[主代理规则](../rules/README.md)里。

## 目录约定

| 路径 | 内容 |
| --- | --- |
| `SKILL.md` | 入口：frontmatter（`name`、`description`）和正文 |
| `agents/openai.yaml` | 在 Codex 界面里显示的名字，统一带 `(OmO)` 前缀 |
| `references/` | 正文按需引用的参考资料 |
| `scripts/` | 技能附带的脚本 |
| `AGENTS.md` | 给代理看的目录和代码说明（部分技能有） |
| `ATTRIBUTION.md`、`SOURCE`、`LICENSE*` | 从别处引入的技能的来源和许可 |

## 引入的技能

以下技能来自其他项目，保留各自的许可：`frontend`（Apache 2.0，见 `ATTRIBUTION.md`）、`ast-grep`（见 `LICENSE` 和 `SOURCE`）、`ultimate-browsing` 和 `ulw-research`（见各自的 `ATTRIBUTION.md`）。

## 修改

`description` 决定 Codex 什么时候想到用这个技能，改动时写清楚适用和不适用的情况。技能脚本的测试在 [`test/`](../test/README.md) 下。改完重新安装，新会话才会读到新版本。
