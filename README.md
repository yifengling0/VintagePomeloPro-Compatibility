# Vintage Pomelo Pro Game Compatibility Database

> 旧柚 Pro 游戏兼容性数据库

一个基于 GitHub 的、可公开访问的 **VintagePomeloPro 游戏兼容性数据库与社区维护系统**。

- **Repository**：`VintagePomeloPro-Compatibility`
- **English name**：Vintage Pomelo Pro Game Compatibility Database
- **Short name**：VPP Compatibility
- **中文名称**：旧柚 Pro 游戏兼容性数据库

本项目把 GitHub 仓库同时当作**源代码仓库、兼容性数据库、用户反馈入口与 GitHub Pages 发布源**。数据全部来自仓库中的 YAML 文件，没有后端服务器，网站为纯静态站点。

---

## 网站地址

GitHub Pages 发布（由 `main` 分支的 `pages.yml` 自动构建）：

```text
https://yifengling0.github.io/VintagePomeloPro-Compatibility/
```

如果你使用自定义域名（如 `games.winehua.com`），请同步调整 `astro.config.mjs` 中的 `site` 与 `base`。

---

## 项目结构

```text
VintagePomeloPro-Compatibility/
├── data/games/            # 一款游戏一个 YAML 文件（数据源）
├── schemas/               # game.schema.json（JSON Schema）
├── src/
│   ├── pages/             # 首页 + /games/[slug] 详情页
│   ├── components/        # 搜索/筛选/卡片/徽章/分页
│   ├── layouts/           # 基础布局（含 SEO）
│   ├── lib/               # 数据加载/排序/状态计算/URL 工具
│   └── scripts/           # 前端数据库逻辑（搜索/筛选/分页）
├── scripts/               # 校验脚本（validate/find-duplicates/search-index）
├── .github/
│   ├── ISSUE_TEMPLATE/    # 兼容性报告表单
│   └── workflows/         # CI + Pages 部署
└── docs/agent/            # 自动 Agent 指南（留待后续实现）
```

---

## 核心设计原则

1. **一款游戏 = 一个 YAML 文件**（`data/games/<slug>.yaml`）。禁止把所有数据合并到单个大文件。
2. **GAME 与 REPORT 分离**。一款游戏可以对应多条兼容性报告；同一游戏在不同设备、渲染器、VintagePomeloPro 版本下可以有不同的结果。
3. **历史报告永不覆盖**。新报告总是追加为新的 `reports[]` 条目。
4. **不再猜兼容状态**。兼容状态只能来自真实报告（用户提交 / 维护者测试 / CI 测试），不能通过网络搜索推断。
5. **兼容状态是固定枚举**：`perfect` / `playable` / `minor_issues` / `major_issues` / `broken` / `unknown`。
6. **每条报告都记录 App + 应用版本**（`app` + `winehua_version`），同一个游戏在旧柚 Pro 与旧柚下、不同应用版本与渲染器下结果可能完全不同。

## App 清单（可维护）

数据库同时跟踪以下应用，清单集中在 [`src/lib/apps.ts`](src/lib/apps.ts)，新增应用只需在 `APPS` 里加一项，并把对应报告的 `app` 指向其 `id`：

| id | 中文名 | 英文名 |
| --- | --- | --- |
| `vintagepomelopro` | 旧柚 Pro | VintagePomeloPro |
| `vintagepomelo` | 旧柚 | VintagePomelo |

---

## 兼容状态

| 状态 | 中文 | 含义 |
| --- | --- | --- |
| `perfect` | 完美 | 基本无明显兼容问题 |
| `playable` | 可玩 | 可以正常完成主要游戏流程 |
| `minor_issues` | 小问题 | 有轻微图形/声音/UI 问题 |
| `major_issues` | 严重问题 | 可启动，但问题明显影响游戏 |
| `broken` | 不可用 | 无法进入游戏或核心功能不可用 |
| `unknown` | 未知 | 信息不足 |

Renderer 枚举：`virgl` / `dxvk` / `vkd3d` / `wined3d` / `native_opengl` / `other`。DXVK 的不同版本用 `version` 字段区分，不作为独立的 backend。

---

## 如何提交兼容性报告

你只需提交**你观察到的事实**，不需要填写开发者、发行商、发行日期等元数据（这些由 Agent 自动补全）。

1. 打开仓库页面，点击 **Issues → New Issue**。
2. 选择 **Compatibility Report** 表单。
3. 至少填写：游戏名称、VintagePomeloPro 版本、设备型号、渲染后端、兼容状态、问题描述。

提交后会打上 `compatibility-report` 标签，后续由兼容性 Agent 处理（当前阶段 Agent 自动化尚在后续开发中）。

---

## 本地运行

需要 Node.js 20.19+（建议 22）。

```bash
npm install
npm run dev
```

生产构建与校验：

```bash
npm run validate   # Schema 校验 + 重复检测
npm run check      # 类型检查（astro check）
npm run build      # validate + astro build
```

---

## 如何新增一款游戏

在 `data/games/` 下新建 `<slug>.yaml`，遵循 `schemas/game.schema.json`。一个最小示例：

```yaml
schema_version: 1
id: tomb-raider-2013
slug: tomb-raider-2013
name: Tomb Raider
name_zh: 古墓丽影
aliases:
  - Tomb Raider (2013)
  - 古墓丽影9
release_date: 2013-03-05
release_year: 2013
developer:
  - Crystal Dynamics
publisher:
  - Square Enix
genres:
  - action
  - adventure
platforms:
  - Windows
external_ids:
  steam: "203160"
metadata_sources:
  - type: steam
    id: "203160"
metadata_confidence: high
created_at: 2026-08-23
updated_at: 2026-08-23
reports:
  - report_id: maintainer-tomb-raider-2013-0001
    source:
      type: maintainer
    tested_at: 2026-08-23
    app: vintagepomelopro
    winehua_version: "6.2.0"
    device:
      model: Mate 80
      gpu: Maleoon 920
      os: HarmonyOS
    renderer:
      backend: dxvk
      version: "2.6.2"
    graphics_api:
      api: d3d11
    architecture:
      game: x64
      wine: x64
    status: playable
    symptoms: []
    workarounds: []
    notes: 游戏可正常启动并进入游戏。
    evidence:
      screenshots: []
      logs: []
      videos: []
```

新增后运行 `npm run validate`，会校验 Schema 与重复项；然后 `npm run build` 生成静态站点。

---

## 数据 Schema

完整定义见 [`schemas/game.schema.json`](schemas/game.schema.json)。要点：

- 游戏元数据（`name`、`developer`、`release_date` 等）由 Agent 自动补全，标识置信度 `metadata_confidence`（`high` / `medium` / `low`）。
- 兼容性报告（`reports[]`）记录：应用版本、设备、渲染器、图形 API、架构、状态、性能、症状、解决方法和证据。

---

## 自动化 Agent（后续开发）

当前版本实现的是**数据层与静态网站**。自动读取 GitHub Issue、补全元数据、去重并创建 Pull Request 的兼容性 Agent 将在后续阶段实现，设计指南见：

- [`docs/agent/AGENT_GUIDELINE.md`](docs/agent/AGENT_GUIDELINE.md)
- [`docs/agent/METADATA_POLICY.md`](docs/agent/METADATA_POLICY.md)

Agent 一旦上线，其行为必须遵守：

- 不直接修改 `main`。
- 不删除历史兼容性报告。
- 只允许修改 `data/games/**`。
- 元数据不确定时标记 `needs-review`，不得猜测。

---

## 贡献规则

- 所有数据变更通过 **Pull Request** 进入 `main`，且必须通过 `validate.yml`（Schema、重复检测、类型检查、构建）。
- 建议一个 Issue 对应一个独立分支（如 `agent/issue-351-tomb-raider-2013`）。
- 请勿新增或修改网站核心代码的同时修改数据，以便独立审核。

---

## License

数据与内容以仓库许可证为准（待补充）。
