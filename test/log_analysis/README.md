# log_analysis workflow

## 1. Baseline作成（改良前）

```bash
php test/log_analysis/analyze_tool_logs.php \
  --log-dir=test/log_analysis/log \
  --output-dir=test/log_analysis \
  --user-id=dev \
  --days=7 \
  --end-date=2026-04-22
```

出力:
- baseline_YYYYMMDD_HHMMSS.json
- baseline_YYYYMMDD_HHMMSS.md

## 2. 改良後ログの定期集計（自然収集）

改良後期間の終端日を指定して同じ集計を実行し、afterとして保管する。

```bash
php test/log_analysis/analyze_tool_logs.php \
  --log-dir=test/log_analysis/log \
  --output-dir=test/log_analysis \
  --user-id=dev \
  --days=7 \
  --end-date=YYYY-MM-DD
```

## 3. Before/After 比較

```bash
php test/log_analysis/compare_reports.php \
  --before=test/log_analysis/baseline_YYYYMMDD_HHMMSS.json \
  --after=test/log_analysis/after_YYYYMMDD_HHMMSS.json \
  --output=test/log_analysis/comparison_YYYYMMDD_HHMMSS.md \
  --min-after-count=200
```

## 判定ルール

- 成功: success + approved
- 失敗: error + rejected
- no_change: 成功率分母から除外し、別指標で監視
- 対象: user_id=dev

## モデル別集計

- analyze_tool_logs.php は AI_TOOL_EXECUTION.context.model を集計し、byModel を JSON/Markdown に出力する。
- 既存ログ（改修前）には model が無いので unknown として集計される。
- compare_reports.php でも By Model セクションで差分を確認できる。

## 注意

- ログ件数が少ないツールの変化は参考値として扱う。
- after総件数が200未満の比較結果は暫定とする。
