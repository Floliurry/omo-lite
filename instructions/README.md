# instructions

替换 Codex 自带指令的文本，以及跟踪上游改动用的快照和脚本。安装脚本把这里的文件接到 `config.toml` 上，不需要手工配置。

## 文件

| 文件 | 内容 | 怎么生效 |
| --- | --- | --- |
| `codex-base.md` | 基础指令：什么时候动手、什么时候先问，怎么给用户写回复、怎么写文件，怎么读、改和写代码，怎么用技能和插件 | 安装后由 `model_instructions_file` 指向，整体替换 Codex 自带的那份；子代理不论用什么模型都会继承它 |
| `multi-agent-root.md` | 给主代理的多代理说明：协作工具怎么调用、消息格式、怎么等待子代理 | 写进 `[features.multi_agent_v2]` 的 `root_agent_usage_hint_text` |
| `multi-agent-subagent.md` | 给子代理的多代理说明：最终回复和消息会交给上级，什么时候才派生自己的子代理 | 写进 `[features.multi_agent_v2]` 的 `subagent_usage_hint_text` |
| `upstream-<model>.md` | 改写 `codex-base.md` 时参照的 Codex 自带指令原文，文件名里是对应的模型 | 不会被加载，只用来比对 |
| `check-upstream.mjs` | 比对上面的快照和 Codex 当前缓存的同一模型指令，列出改过的章节 | 手动运行，安装脚本也会运行 |

Codex 自带的多代理说明里，一段说没被要求就不要派生子代理，角色说明又说每个代理能力都一样。上面两份说明替换掉它们，安装脚本还把 `multi_agent_mode_hint_text` 设为空串，去掉那一段。这两份说明是以字符串写进 `config.toml` 的，所以改完要重新安装。

## 跟进上游改动

```sh
node instructions/check-upstream.mjs [--codex-home <dir>]
```

脚本从 `<codex home>/models_cache.json` 里取出快照对应模型的指令模板，跟 `upstream-<model>.md` 比较：

- 相同：说明上游没改，什么都不用做；
- 不同：把当前版本写到临时目录，并列出内容不同或只在一边出现的章节标题；
- 缓存里找不到这个模型：无法比较，脚本只报告这一点。

有改动时，读完列出的章节，把适用的部分吸收进 `codex-base.md`，再用临时目录里的新版本替换快照。换模型时，也要把快照换成新模型的指令原文，并改掉文件名里的模型。

