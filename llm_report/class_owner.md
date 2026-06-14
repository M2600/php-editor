# 教員紐づけ & クラス有効化 ドラフト

## 前提

BitArrowから教員-クラスの関係が取れるのは **代理ログイン時のみ**。

```json
{"teacher": "prof_tanaka", "user": "eh99a001", "class": "3a"}
```

通常の教員ログイン `{"teacher": "prof_tanaka"}` にはクラス情報が含まれない。

---

## データ構造（ファイルベース）

```
sandbox/_bitarrow_/
  ├── 3a/
  │   ├── .owner        ← "prof_tanaka"（クラス有効化フラグ兼教員紐づけ）
  │   ├── eh99a001/
  │   └── eh99a002/
  └── _teachers_/
        └── prof_tanaka/
```

`.owner` は1行テキストファイル。教員IDのみ格納。

---

## フロー

### クラス有効化（教員側）

```
教員がBitArrow代理ログインを実行
  → BitArrowが {"teacher": "prof_tanaka", "user": "...", "class": "3a"} を返す
  → ba_login.php が teacher + class の両方を検出
  → sandbox/_bitarrow_/3a/.owner に "prof_tanaka" を書き込む
  → 教員としてログイン完了（3a が有効化される）
```

同一クラスに `.owner` が既に存在する場合：
- 同じ教員IDなら上書き（冪等）
- 異なる教員IDなら **エラー**（競合検出・管理者による解決が必要）

### 学生ログイン

```
学生が {"user": "eh99a001", "class": "3a"} でログイン試行
  → sandbox/_bitarrow_/3a/.owner の存在確認
  → 存在しない → ログイン拒否「このクラスは有効化されていません」
  → 存在する   → ログイン許可
```

### 教員管理画面（teacher.php）

```
教員ログイン後、管理画面へ
  → sandbox/_bitarrow_/_teachers_/{teacher_id}/ 以下を参照
  → sandbox/_bitarrow_/*/. owner が自分のIDと一致するクラス一覧を表示
  → 各クラスの学生に対して代理ログイン可能
```

---

## 未解決課題

- `.owner` の競合（複数教員が同一クラスを担当するケース）
- 教員が代理ログインせずに通常ログインのみの場合、クラスを有効化できない
  → 教員ログイン後にUI上でクラスIDを手動入力する補助手段が必要か
- クラス有効化の取り消し手段（管理者操作のみ？）
- `_system_` ユーザー（ローカルCSVログイン）の教員とクラスの関係は別途設計が必要

---

## 実装対象ファイル（予定）

| ファイル | 変更内容 |
|---|---|
| `api/ba_login.php` | 代理ログイン時に `.owner` ファイルを作成 |
| `api/ba_login.php` | 学生ログイン時に `.owner` の存在確認 |
| `teacher.php` | 新規作成・担当クラス一覧と代理ログイン機能 |
