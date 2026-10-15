# agents

Codex 的代理角色。每个 TOML 文件定义一个角色的名字、描述、模型、推理强度和指令；主代理用 `spawn_agent` 按名字派生它们。安装脚本把这些文件复制到 `<codex home>/agents/`。

## 角色

| 角色 | 模型 | 推理强度 | 用途 |
| --- | --- | --- | --- |
| `librarian` | `gpt-6-luna` | low | 单个问题的查询：一次网页搜索、一个页面或一段文档，返回答案和确切出处；只读 |
| `explorer` | `gpt-6.1-sol` | high | 整块调查：跨代码、文档、源码仓库、发布记录和数据集追线索，必要时下载和写脚本，报告结论和证据；对项目只读 |
| `lazycodex-worker-low` | `gpt-6-luna` | high | 小改动：单处修复、样板代码、配置或文案、只涉及一个文件的照例修改 |
| `lazycodex-worker-medium` | `gpt-6.1-sol` | high | 已有架构内范围清楚的工作 |
| `lazycodex-worker-high` | `gpt-6.1-sol` | max | 复杂或跨模块、需要更多设计判断的工作 |
| `lazycodex-qa-executor` | `gpt-6-luna` | high | 手动 QA：跑真实场景，记录带证据的结果 |
| `lazycodex-code-reviewer` | `gpt-6.1-sol` | medium | 代码质量审查：审 diff、测试和风险；只读 |
| `lazycodex-gate-reviewer` | `gpt-6.1-sol` | low | 最终把关：复核执行、代码审查和 QA 的产物；只读 |
| `lazycodex-clone-fidelity-reviewer` | `gpt-6.1-sol` | high | 仿站和设计系统移植的还原度审查：检查是不是基于设计 token 的实现，而不是贴截图或写死的假页面；只读 |
| `metis` | `gpt-6.1-sol` | max | 规划前的分析：找出草案或请求里的矛盾、歧义、缺失的约束和执行风险；只读 |
| `plan` | `gpt-6.1-sol` | max | 在调研之后仍有设计上的不确定时，写出一份可执行的计划到 `.omo/plans/<slug>.md`；不做实现 |
| `momus` | `gpt-6.1-sol` | high | 计划审查：核对引用存在、任务可以开始、QA 场景具体，给出 OKAY、ITERATE 或 REJECT；只读 |

什么时候派哪个角色，写在[主代理规则](../rules/README.md)和各个工作流技能里。

## 换模型

表里的模型名是我们自己用的。换成你的账户能用的模型时，改对应文件里的 `model` 和 `model_reasoning_effort`，然后重新安装。

## 安装行为

- 同名的角色文件会被覆盖；
- 如果 `config.toml` 自己登记了某个角色（`[agents.<name>]` 指向别处），这个角色会被跳过，安装脚本会说明跳过了哪个；
- 安装脚本在 `<codex home>/agents/` 里记下这次装了哪些角色；下次安装时，仓库里已经删掉的角色会被清理，除非 `config.toml` 仍以自己的方式登记着它。
