# Metadata Policy

## 元数据与兼容报告必须分离

**元数据**（Meta）与 **兼容性报告**（Report）是两个不同的概念：

- `release_date`、`developer`、`publisher`、`genres` 等属于**元数据**。
- `BROKEN`、`40 FPS`、`黑屏` 等属于**用户兼容性报告**。

Agent 可以使用网络搜索来补全元数据，但**绝不能**通过网络搜索来推断「某款游戏在 VintagePomeloPro 上是否兼容」。

## 自动补全的元数据

当用户只给出模糊名称（如「古墓9」）时，Agent 应自动补全：

```text
正式英文名称
中文名称
Aliases
Release Date
Release Year
Developer
Publisher
Genres
Windows Platform
Steam AppID
IGDB ID（如果能够可靠确认）
```

信息来源优先级：

```text
1. 游戏官方页面
2. Steam
3. GOG
4. IGDB
5. Wikidata
6. Wikipedia
7. 其他可靠游戏数据库
```

不要仅使用搜索摘要作为最终事实。

## 置信度

保存为 `metadata_confidence`，可选值：

```text
high    至少满足一个：Steam AppID 精确匹配 / IGDB ID 精确匹配 / 官方页面明确匹配
medium  名称 + 年份 + 开发商匹配
low     只有名称模糊匹配 / 存在多个候选游戏
```

`low` 时**禁止自动合并**，必须等待人工确认。

## 数据源与用户反馈分离

用户反馈只注入 `reports[]`；元数据中的 ID 应记录在 `metadata_sources[]` 中，例如：

```yaml
metadata_sources:
  - type: steam
    id: "203160"
```

## 身份识别与去重

推荐身份匹配优先级：

```text
Steam AppID
IGDB ID
GOG ID
正式英文名称 + release_year
aliases
模糊名称匹配
```

同一系列不同年份是**不同游戏**，必须使用不同 slug（如 `resident-evil-2` 与 `resident-evil-2-remake`）。
