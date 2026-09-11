# ADR 0002: プロトコルの型をドメインの型から独立させる

- ステータス: 承認
- 日付: 2026-09-01
- 関連: [#12](https://github.com/shared-yung/quiz-match/issues/12) / [P2P メッセージプロトコル](../spec/p2p-protocol.md) / [ADR 0001 通信方式](0001-transport.md)

## 背景

[#8](https://github.com/shared-yung/quiz-match/issues/8) で `Player` / `RuleSet` / `Room` を `features/room/domain` に定義した。#12 で定義する P2P メッセージのうち `room/state` は、参加者一覧と RuleSet をそのまま運ぶ。**同じ形のスキーマが2か所に現れる。**

置き場所は先に決まっている。issue の対象 feature は `shared` で、[P2P メッセージプロトコル](../spec/p2p-protocol.md)にも「型定義は `src/shared/` に置く」とある。

そして ESLint の `boundaries` は **`shared` から feature への import を禁じている**（`packages/eslint-config/onion.js`）。`shared` が特定の feature に依存すると、feature をまたぐ共有コードではなくなるため。つまり `src/shared/protocol` からドメインの型は**参照できない**。

## 検討した選択肢

1. **回線用のスキーマを `shared` に自己完結で定義する**（採用）
2. `Player` / `RuleSet` を `src/shared/` へ移し、ドメインと共有する
3. プロトコルを `features/net/domain` に置く

## 決定

**選択肢 1 を採用する。** `src/shared/protocol/` に回線専用のスキーマを置き、ドメインの型は参照しない。ドメイン型への変換は **net の infrastructure**（[#17](https://github.com/shared-yung/quiz-match/issues/17) 以降）で行う。

## 根拠

### 重複ではなく、役割が違う

同じ形に見えるが、課す制約が違う。

|              | ドメインの `RuleSet`                                 | 回線上の RuleSet                         |
| ------------ | ---------------------------------------------------- | ---------------------------------------- |
| 欠けた項目   | **既定値で埋める**（設定必須の項目を増やさないため） | **弾く**。ホストのバグか改造クライアント |
| id           | ブランド型 `PlayerId`。実在が保証される              | ただの文字列。実在はホストが別途照合する |
| 値の出どころ | 自分のプロセス                                       | **相手のクライアント。改造されうる**     |

回線側で既定値を埋めると、壊れたメッセージが**妥当な値に化けて**ドメインに入る。これは検証ではなく隠蔽になる。

### 生成型と同じ扱いにする

これは新しい方針ではない。[API クライアント](../../../docs/architecture/api-client.md)で、OpenAPI の生成型を infrastructure 層でのみ扱いドメイン型へ写すのと同じ形。**外から来る型は境界で止め、内側の型へ明示的に変換する。**

プロトコルは腐敗防止層の外側にあたる。バックエンドの生成型と違い手書きだが、扱いは変えない。

### ドメイン概念を feature の外に出さない（選択肢 2）

`Player` と `RuleSet` を `shared` へ移せば重複は消える。しかし `shared` は feature をまたぐ**技術的な共有物**の置き場で、そこにドメイン概念を置くと、feature-first の切り方が崩れる。「room の RuleSet」ではなく「アプリの RuleSet」になり、feature の境界が意味を持たなくなる。

重複1か所を消すために、既にマージ済みの構造を動かす価値はない。

### 置き場所を変えても制約は消えない（選択肢 3）

`features/net/domain` に置いても、そこから `features/room/domain` は参照できない（`boundaries` は他 feature の内部を禁じる）。**重複は無くならず、spec の記述を変える手間だけが増える。**

## 影響

- `src/shared/protocol/` は zod 以外に依存しない。`shared` → `shared` のみ
- **形のズレは #17 の変換で型エラーとして出る。** #12 の時点では検知できない。`test/shared/**` も `boundaries` 上は `shared` なので、ドメイン側と突き合わせるテストは書けない
- RuleSet に項目を足すときは**両方を更新する。** 片方だけだと #17 の変換が落ちる
- ドメイン型への変換は net の infrastructure に閉じる。use-case より外側にプロトコルの型を漏らさない

## 再検討のトリガー

- **変換のコードが機械的な写経ばかりになり、ズレの検知だけが目的になったとき。** その時点で選択肢 2（共有語彙を `shared` へ移す）を再評価する
- プロトコルのバージョニングが必要になったとき。回線側とドメイン側が**別々に進化する**ことになり、この決定の前提はむしろ強まる

## 追記（2026-09-06 / [#9](https://github.com/shared-yung/quiz-match/issues/9)）

`PlayerId` を `features/room/domain` から `src/shared/identity.ts` へ移した。出題の状態機械がロックアウト集合と早押ししたプレイヤーを状態に持つ必要があり、`boundaries` は他 feature の domain を見せないため。`features/room/domain/player.ts` は shared から再エクスポートしていて、room の公開 API は変わっていない。

**移したのは id だけで、`Player` / `Room` / `RuleSet` は room に残している。** 上の選択肢 2（共有語彙を `shared` へ移す）を採ったわけではない。**この ADR の決定は維持する。**

回線上の識別子（`playerRefSchema`）は今もブランド無しの文字列のままで、ドメインの `PlayerId` への変換は net の infrastructure が行う。本題である「回線の型とドメインの型を独立させる」は変わっていない。
