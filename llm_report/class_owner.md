# 教員紐づけ & クラス有効化

## 前提

BitArrow認証では、教員アカウントのログイン時（代理ログインかどうかを問わず）に「最後にアクセスしたクラス」が `class` フィールドとして返ってくる。BitArrow側で保証されている事実として、教員アカウントに `class` が付与されている場合、その教員はそのクラスのオーナーである。

```json
{"teacher": "prof_tanaka", "class": "3a"}
```

BitArrow上では教員の編集データもクラスごとに分かれているため、`class` を含まない教員ログイン（クラスを開かずにBitArrowにログインした状態）は受け付けない。教員にはBitArrow上で対象クラスを開いた状態でログインしてもらう必要がある。

```json
{"teacher": "prof_tanaka"}
```
→ `class` がないため拒否（`status: class_not_selected`）。

代理ログイン時は `user` も含まれる：

```json
{"teacher": "prof_tanaka", "user": "eh99a001", "class": "3a"}
```

BitArrow上では1つのクラスに複数の教員を登録できる仕様のため、`.owner` は単一の教員IDではなく**1行1教員IDのリスト形式**で管理する。異なる教員が同じクラスにログインした場合は競合ではなく「追加登録」として扱い、両方をオーナーとして保持する。

---

## データ構造（ファイルベース）

```
sandbox/_bitarrow_/
  └── 3a/
      ├── .owner        ← 1行1教員ID（複数行可）
      ├── eh99a001/     ← 学生のホーム
      ├── eh99a002/
      └── prof_tanaka/  ← 教員のホーム（クラスごとに分かれる）
```

教員のホームディレクトリも学生と同じクラス配下に置かれる（`_teachers_` のような専用ディレクトリは存在しない）。これはBitArrow上で教員の編集画面もクラスごとにデータが分かれていることに合わせたもの。同じ教員が複数クラスを担当する場合は、クラスごとに別のホームディレクトリ（`sandbox/_bitarrow_/{class}/prof_tanaka/`）を持つ。

`.owner` はテキストファイル。1行ごとに教員IDを1つ格納する。

```
prof_tanaka
prof_suzuki
```

---

## フロー（実装済み）

### クラス有効化（教員側）

```
教員がBitArrowログイン（通常 or 代理。対象クラスを開いた状態が必須）
  → BitArrowが {"teacher": "prof_tanaka", "class": "3a", ...} を返す
  → class がない場合は拒否（status: class_not_selected）
  → ba_login.php が teacher + class を検出
  → addClassOwner("3a", "prof_tanaka") を呼び、sandbox/_bitarrow_/3a/.owner に
    "prof_tanaka" を追記（既に登録済みなら何もしない＝冪等）
  → 教員としてログイン完了。class_id は "3a"（教員ホームも sandbox/_bitarrow_/3a/prof_tanaka/ になる）
```

同一クラスに別の教員IDが既に登録されていても、上書きせず行を追加する（複数教員の共存）。

`addClassOwner()` は新規にオーナーを追加した場合のみ `true` を返す。これを使い、クラスが新規にアクティベートされた場合のみ、教員を `teacher.php`（教員用メニューページ）にリダイレクトし、アクティベート通知とPHPEditorの使い方・注意点を表示する。同じ教員が既にオーナーのクラスに再ログインした場合は通常のリダイレクト（`redirect_after_login` or `/index.php`）のまま。

### 学生ログイン

```
学生が {"user": "eh99a001", "class": "3a"} でログイン試行
  → isClassActivated("3a") で sandbox/_bitarrow_/3a/.owner にオーナーが
    1人以上いるか確認
  → いない → ログイン拒否（status: class_not_activated）
            「このクラスは有効化されていません。担当教員にBitArrowへの
              ログインを依頼してください。」
  → いる   → ログイン許可
```

### 実装箇所

| ファイル | 内容 |
|---|---|
| `api/file_functions.php` | `getClassOwnerFilePath` / `getClassOwners` / `isClassActivated` / `addClassOwner` |
| `api/ba_login.php` | 学生ログイン時の有効化チェック、教員ログイン時の `addClassOwner` 呼び出しと新規アクティベート時のリダイレクト |
| `teacher.php` / `templates/teacher.html` | 教員用メニューページ（ランディングページ）。`?activated=1&class=...` でアクセスした場合のみアクティベート通知バナーを表示。PHPEditorの使い方・注意点を常設表示 |

---

## 未実装・今後の課題

- `teacher.php`（教員用メニューページ）— ランディングページ自体は実装済みだが、担当クラス一覧の表示と、各クラスの学生への代理ログイン機能は未実装。`getClassOwners()` を使い、戻り値に自分のIDが含まれるクラスを一覧表示する想定。
- クラス有効化の取り消し手段（管理者操作のみ？）
- `.owner` から教員を削除する手段（現状は追加のみで削除APIはない）
- `_system_` ユーザー（ローカルCSVログイン）の教員とクラスの関係は別途設計が必要
