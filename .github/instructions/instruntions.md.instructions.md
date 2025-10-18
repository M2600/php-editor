---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

## コーディング
- 変数名や関数名は処理内容がわかりやすいものにすること。
- 基本的にはオブジェクト指向を活用し、関連するデータと機能をクラスにまとめること。
- 既存のコーディングスタイルを最優先すること。
- コメントは日本語で記述し、コードの意図や複雑なロジックを説明すること。
- セキュリティを考慮し、ユーザ入力の検証やサニタイズを徹底すること。
- パフォーマンスを意識し、不要な処理や重複コードを避けること。
- 同一処理や類似処理は関数にまとめ、再利用性を高めること。

## テスト
- 開発用のサーバはlocalhost:8000で起動していることを想定すること。
- 主に開発している機能はlocalhost:8000/2.phpで動作確認を行うこと。
- デバッグ時のログイン情報は以下の通り：
  - ユーザ名: dev
  - パスワード: password