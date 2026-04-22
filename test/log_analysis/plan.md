## Plan: ツール改良後 成功率比較テスト

改良後のエラー成功率変化を、同一条件で再現可能に比較するための計画。直近7日を改良前ベースラインとし、改良後は自然利用ログを蓄積して合計200件到達時に比較する。成功率定義は success+approved を成功、error+rejected を失敗、no_change は別枠として扱い、dev ユーザーのみを対象にする。

**Steps**
1. フェーズ1: 指標定義と集計仕様の固定
1. 比較期間を固定する: 改良前は実行日から遡って7日、改良後はリリース日以降の同等期間または件数到達時点。今回の初期値は 2026-04-16 から 2026-04-22。
1. 判定ロジックを固定する: success+approved を成功、error+rejected を失敗、no_change は成功率分母から除外して別指標で監視。
1. 集計スコープを固定する: user_id が dev のみ。
1. フェーズ2: ベースライン作成
1. test/log_analysis/log の日次ログから AI_TOOL_EXECUTION を抽出し、ツール別件数を算出する。
1. ツール別に成功率、失敗率、no_change 率、approvalTime の平均/中央値/P95 を算出する。
1. 補助指標として Performance: getFile completed から duration_ms を抽出し、read 系処理の速度分布を算出する。
1. ベースライン成果物を test/log_analysis 配下に保存する: 集計JSON 1つ、比較用サマリMarkdown 1つ。
1. フェーズ3: 改良後ログ収集運用
1. 日常開発で自然収集を継続し、合計200件到達を比較開始条件にする。
1. 収集中は週次で途中集計を作成し、件数偏りを監視する。特定ツールの件数不足が大きい場合は補完シナリオを別途実施する。*parallel with step 12*
1. フェーズ4: Before/After 比較
1. 同一ロジックで改良後集計を作成し、ベースラインとの差分を算出する。*depends on 10*
1. 主要KPIを比較する: 総成功率、ツール別成功率、失敗件数、approvalTime、no_change 率。
1. エラー文言をカテゴリ化して失敗内訳を比較する: path validation、not found、permission、replace miss など。
1. フェーズ5: 妥当性確認
1. 増減の有意性を簡易確認する: 件数が少ないツールは参考値扱いにし、総件数とツール別件数を併記する。
1. ログ欠損/異常フォーマット/日次ファイル欠落がないかを点検する。
1. 最終レポートで改善判定を明記する: 改善、横ばい、悪化。

**Relevant files**
- /home/m260/syncPcloud/php-editor/test/log_analysis/log — 比較元ログ一式。AI_TOOL_EXECUTION と Performance イベントを抽出。
- /home/m260/syncPcloud/php-editor/api/tool_history.php — AI_TOOL_EXECUTION の記録項目と取得形式の基準。
- /home/m260/syncPcloud/php-editor/js/modules/ai/ai_tools/fileEditor.js — status, result, approvalTime の送信元実装。
- /home/m260/syncPcloud/php-editor/api/logger.php — ログの保存形式、ローテーション、保持仕様。

**Verification**
1. 改良前ベースライン検証: 直近7日の対象ログ全件に対し、JSONパース失敗件数が 0 か確認。
1. 判定ロジック検証: success+approved、error+rejected、no_change の3分類が全件を過不足なくカバーするか確認。
1. 件数整合性検証: ツール別件数の総和と分類別件数の総和が一致するか確認。
1. 比較準備検証: 改良後データが 200 件到達した時点で同じ集計処理を実行し、Before/After テーブルが生成できるか確認。
1. 目視検証: サマリMarkdownにツール別の増減、失敗カテゴリ増減、注意事項が明示されているか確認。

**Decisions**
- 比較期間: 直近7日。
- 成功率定義: success+approved を成功、error+rejected を失敗、no_change は別扱い。
- 改良後運用: 自然収集。
- 比較開始条件: 合計200件。
- 対象ユーザー: dev のみ。
- 含む範囲: 成功率・失敗率・no_change・approvalTime・read系パフォーマンス比較。
- 除外範囲: モデル別比較、ユーザー横断比較、A/B 実験設計。

**Further Considerations**
1. no_change が多いツールは、成功率とは別に品質警告閾値を設定する。推奨は 15% 超で要レビュー。
2. createFile/editFileByReplace のような承認必須ツールは approvalTime の改善も主KPIとして扱う。
