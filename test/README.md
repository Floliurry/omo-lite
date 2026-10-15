# test

钩子、安装脚本、`omo` 命令和技能脚本的测试。这个目录不会被安装。

## 运行

```sh
node --test test/                          # 所有 *.test.mjs
python3 -m unittest discover -s test/ultimate-browsing   # 浏览器引擎
bash test/ast-grep/smoke.sh                # ast-grep 辅助脚本（Windows 用 smoke.ps1）
```

`node --test test/` 会把目录解析到 `index.js`，由它按文件名顺序加载同目录下的每个 `*.test.mjs`。也可以运行 `node --test test/*.test.mjs`，这样每个文件在单独的进程里跑。单独跑一个文件就直接把它传给 `node --test`。

## 内容

| 文件 | 测的是 |
| --- | --- |
| `install.test.mjs` | [`install.mjs`](../install.mjs)：复制插件、改写 `config.toml`、角色和 `omo` 命令的安装与跳过 |
| `omo-tools.test.mjs` | [`tools/omo.mjs`](../tools/README.md) 的四个子命令，以及压缩后清除读取记录 |
| `resident-rule.test.mjs`、`patch-check.test.mjs`、`explorer-handoff.test.mjs`、`subagent-context.test.mjs`、`thread-title.test.mjs` | 对应的[钩子](../hooks/README.md) |
| `ultrawork-*.test.mjs` | `ultrawork-trigger.mjs` 钩子和 ultrawork 技能的触发规则 |
| `ulw-*.test.mjs`、`boulder-reader.test.mjs`、`scaffold-plan.test.mjs` | ulw-plan 和 ulw-execute：计划骨架、Boulder 状态读取、续跑钩子 |
| `teammode-*.test.mjs` | teammode 技能的脚本：线程、通信、工作树和安全检查 |
| `ultimate-browsing/` | ultimate-browsing 引擎的 Python 测试，`fixtures/` 里是离线页面样本 |
| `ast-grep/` | ast-grep 技能辅助脚本的冒烟测试 |

辅助文件：`expect.mjs`（断言工具）、`teammode-safety-fixture.mjs`、`ultrawork-test-helpers.mjs`，以及 `fixtures/` 下的计划样本。

## 约定

测试直接导入被测脚本导出的函数，或者用子进程运行脚本，不依赖 Codex 本身，也不需要 `npm install`。安装脚本的测试在临时目录里建一个 codex home，不会改动真实的 `~/.codex`。
