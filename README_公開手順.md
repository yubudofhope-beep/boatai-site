# BoatAI サイト公開手順 (初心者向け・コピペでOK)

このフォルダ (`site/`) が、そのまま公開されるホームページ一式です。
GitHub Pages という**無料**のサービスに置くと、インターネット上に公開されます。
初回だけ手順1〜5の設定が必要で、2回目以降は自動 (毎朝・毎晩のレポート処理が勝手に更新) です。

---

## 1. GitHub アカウントを作る (持っていなければ)

1. ブラウザで https://github.com/ を開く
2. 右上の「Sign up」をクリック
3. メールアドレス・パスワード・ユーザー名を入力して登録
   - ユーザー名は公開URLの一部になります (例: ユーザー名が `yubud` なら `https://yubud.github.io/...`)
4. 届いた確認メールのコードを入力して完了

## 2. Git をインストールする (入っていなければ)

1. https://git-scm.com/download/win からダウンロードしてインストール
   (設定は全部「Next」でOK)
2. PowerShell を**新しく開き直して**、動作確認:

```powershell
git --version
```

`git version 2.xx.x` のように表示されれば OK。

3. 自分の名前とメールを一度だけ登録します (コミットの署名に使われるだけ):

```powershell
git config --global user.name "あなたの名前"
git config --global user.email "GitHubに登録したメールアドレス"
```

## 3. GitHub にリポジトリ (置き場所) を作る

1. GitHub にログインした状態で https://github.com/new を開く
2. **Repository name** に `boatai-site` と入力
3. **Public** を選ぶ (Pages の無料公開は Public が必要)
4. 他はチェックを入れず (README等は追加しない)、緑の「Create repository」をクリック
5. 表示されたページの URL (`https://github.com/あなたのユーザー名/boatai-site.git`) を控えておく

## 4. site フォルダを GitHub に送る (初回だけ)

PowerShell を開いて、下を1行ずつコピペして実行します。
**4行目の `あなたのユーザー名` だけ自分のものに書き換えてください。**

```powershell
cd C:\Users\user\MyPython\BoatAI\site
git init
git add -A
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/boatai-site.git
git push -u origin main
```

- 途中でブラウザが開いて「Sign in to GitHub」と出たら、ログインして許可すればOKです
- `git push` が成功すると、GitHub のリポジトリページにファイルが表示されます

## 5. GitHub Pages を有効にする (公開スイッチ)

1. ブラウザで自分のリポジトリページ (`https://github.com/あなたのユーザー名/boatai-site`) を開く
2. 上のタブの **Settings** をクリック
3. 左メニューの **Pages** をクリック
4. 「Build and deployment」の **Branch** で `main` を選び、フォルダは `/ (root)` のまま **Save**
5. 1〜2分待ってページを再読み込みすると、上部に公開URLが表示されます:

```
https://あなたのユーザー名.github.io/boatai-site/
```

これがあなたのホームページのアドレスです。スマホでも開けます。

## 6. ふだんの更新 (自動)

毎朝・毎晩のレポートスクリプト (`morning_report.ps1` / `evening_report.ps1`) の最後に
公開処理が組み込み済みです。手動で更新したいときは:

```powershell
cd C:\Users\user\MyPython\BoatAI\tools
python publish_site.py --date (Get-Date -Format "yyyyMMdd")
powershell -ExecutionPolicy Bypass -File publish.ps1
```

- `publish_site.py` … レポートHTMLを site/ にコピーし、一覧(reports.json)と実績(stats.json)を更新
- `publish.ps1` … site/ の変更を GitHub に送信 (=公開)

## 7. 独自ドメイン (将来、アクセスが増えたら)

広告 (Google AdSense 等) を貼るなら独自ドメインがあると審査に有利です。

1. お名前.com や Cloudflare Registrar などでドメインを購入 (年1,000〜2,000円程度)
2. ドメイン管理画面で DNS に CNAME レコードを追加:
   `www` → `あなたのユーザー名.github.io`
3. GitHub のリポジトリ → Settings → Pages → **Custom domain** にドメインを入力して Save
4. 「Enforce HTTPS」にチェック

詳しくは GitHub 公式ヘルプ「GitHub Pages カスタムドメイン」で検索してください。

---

## 困ったとき

| 症状 | 対処 |
|---|---|
| `git push` で認証エラー | ブラウザでのログイン認証をやり直す。だめなら `git config --global credential.helper manager` を実行してから再度 push |
| ページが404 | Pages有効化から数分待つ。Settings→Pages のBranch設定を確認 |
| ページが更新されない | push できているか `git log -1` で確認。ブラウザはスーパーリロード (Ctrl+F5) |
| `publish.ps1` が黄色いメッセージを出す | 初回設定 (手順4) がまだです。表示されたコマンドを実行 |

## 注意

- このサイトは予想の**参考情報**です。免責事項 (フッター) は消さないでください
- 20歳未満の舟券購入は法律で禁止されています (この文言も全ページ必須)
