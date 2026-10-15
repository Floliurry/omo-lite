# hooks

Codex 插件钩子。`hooks.json` 声明每个钩子在什么事件上运行，脚本都是普通的 Node 脚本，没有依赖。插件清单 `.codex-plugin/plugin.json` 指向 `hooks.json`，脚本路径用 `${PLUGIN_ROOT}` 定位。

## 钩子

| 脚本 | 事件 | 作用 |
| --- | --- | --- |
| `resident-rule.mjs` | `SessionStart`、`UserPromptSubmit`、`PostCompact` | 注入[主代理规则](../rules/README.md)，并填入当前会话的模型名；压缩之后只注入一行指向规则文件的提示 |
| `patch-check.mjs` | `apply_patch` 前后，以及 `Bash` 之前 | 如果补丁的某段能匹配多处就拒绝，并给出匹配的行号，因为 `apply_patch` 会默默改掉第一处；接受 JSON 形式的编辑（`{"edit", "old", "new"}`，可选 `"line"` 指明旧文本从哪一行开始）并转成补丁；成功后列出改动的行 |
| `read-reset.mjs` | `PostCompact` | 清掉本线程“读过哪些范围”的记录。压缩后再读同一段，[`omo read`](../tools/README.md) 会照常输出内容，而不是只给一行“没有变化”的提示；它自己不会往上下文里放回任何内容 |
| `explorer-handoff.mjs` | `spawn_agent` 之后 | 派出 explorer 后提醒主代理：explorer 范围内的判断归它；不同意就把理由发给它，不要自己重读来源再选一遍 |
| `subagent-context.mjs` | `SubagentStart` | 给子代理一个辅助脚本，用来加载任务里 `Context:` 下列出的文件 |
| `ultrawork-trigger.mjs` | `UserPromptSubmit` | 把 `/ulw …`、`ulw: …`、`$ultrawork` 这类请求引到 ultrawork 技能；是否真的使用仍由主代理决定 |
| `thread-title.mjs` | `create_thread` 之后 | 提醒团队模式的负责人给新线程起标题 |
| `ulw-execute-continuation.mjs` | `Stop`、`SubagentStop` | 选中的 ulw-execute 计划还有未完成的任务或最后的检查时，阻止停止并提醒当前计划状态 |

`patch-check.mjs` 也挂在 `Bash` 上，是因为 Codex 还接受以 shell 命令形式发来的补丁（`apply_patch <<'EOF' ... EOF`）。这种情况下钩子看到的工具名是 `Bash`，除此以外的 shell 命令都会立即放行。Codex 不会对这种补丁运行 `PostToolUse` 钩子，所以只有补丁前的检查生效。

## 其他文件

| 文件 | 内容 |
| --- | --- |
| `hooks.json` | 事件、匹配规则、超时和状态栏提示 |
| `ulw-execute-continuation.md` | `ulw-execute-continuation.mjs` 注入的续跑提示 |
| `lib/boulder-reader.mjs` | 读取 ulw-execute 的 Boulder 状态，判断当前会话是否有选中的计划 |
| `lib/plan-checklist.mjs` | 解析计划文件里 `## TODOs` 和 `## Final Verification Wave` 两节的勾选状态 |

## 信任

Codex 只运行 `config.toml` 里记录了当前定义哈希的插件钩子，IDE 也从不询问，所以没被信任的钩子会被悄悄跳过。安装脚本会列出尚未信任的钩子；由用户在终端的 `codex` 会话里用 `/hooks` 审阅并信任。改动 `hooks.json` 里的定义后需要重新信任。

## 测试

每个钩子在 [`test/`](../test/README.md) 下都有对应的测试，脚本导出的函数可以直接调用，不必经过 Codex。
