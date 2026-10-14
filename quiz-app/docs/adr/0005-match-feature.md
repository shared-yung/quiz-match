# ADR 0005: room・quiz・net をつなぐ match feature を置き、型の変換もそこで行う

- ステータス: 承認
- 日付: 2026-10-11
- 関連: [#21](https://github.com/shared-yung/quiz-match/issues/21) / [ADR 0002 プロトコルの型](0002-protocol-types.md) / [ADR 0004 再参加](0004-rejoin-token.md)

## 背景

#21（ルーム作成・参加画面）で、ホスト側で room（ルームの正本と参加の判断）と net（接続とロビー）を初めてつなぐことになった。#22 以降は quiz（出題）も加わる。`room/state` には room の参加者と RuleSet に加え、quiz の得点と出題の状態が載る。

[ADR 0002](0002-protocol-types.md) は「ドメインの型と回線の型の変換は net の infrastructure で行う」としていた。これに従うと net が room と quiz に依存する。一方、ルーム画面（room）は招待と接続に net を使うので room も net に依存し、**feature の間で循環する。**

## 検討した選択肢

1. **room・quiz・net をつなぐ新しい feature（match）を置き、変換もそこで行う**（採用）
2. room と quiz が net に依存し、変換はドメインを持つ側の infrastructure で行う
3. net が room と quiz に依存し、変換も画面も net に置く（ADR 0002 のまま）

## 決定

**選択肢 1 を採用する。** `features/match` を置く。

- **依存の向きは match → room / quiz / net の一方向。** room・quiz・net は互いを知らず、match も知らない
- ドメインの型と回線の型の変換は match の infrastructure に置く（`toRoomStateMessage` / `toRoomView`）
- ホストとプレイヤーそれぞれの対戦の組み立て（`createHostMatch` / `createPlayerMatch`）は match の use-case、画面と Pinia ストアは match の presentation に置く
- 画面の部品のうち、1つの feature で閉じるもの（ルールの編集フォーム・表示）は、その feature（room）の presentation に置き、match の画面から使う

## 根拠

### 選択肢 2 では room と quiz がつながる

`room/state` を作るには、ルームと得点の両方が要る。変換を room に置けば room が quiz に、quiz に置けば quiz が room に依存する。どちらかが net に依存したうえに、ドメイン同士も結ばれる。

### 選択肢 3 では net が「通信」でなくなる

net は今、プロトコルは知っていてもゲームのドメインは知らない（`Transport` / `Messenger` / ロビー）。room と quiz を取り込むと、net が対戦そのものになり、通信手段を差し替える単位としての意味を失う。issue の対象 feature（room）とも食い違う。

### match は「組み立て役」

match に新しい業務の規則はほとんど無い。room と quiz の判断を呼び、結果を net で配るだけ。組み立て役を独立させると、room と quiz は通信を知らないまま単体で検証でき、#22 以降で quiz をつなぐときも変更が match に閉じる。

## 影響

- ADR 0002 の「変換は net の infrastructure」を「変換は match の infrastructure」に改める（ADR 0002 に追記）。回線の型とドメインの型を独立させる、という本題は変わらない
- net と room の入口から、match が使う port・型に加えて **use-case のファクトリー**（`createHostLobby` / `createPeerRegistry` / `createPlayerLobby` / `createRoomSession`）を出す。入口から出さないと決めているのは infrastructure の具体的なファクトリーで、use-case は対象外とする
- **他 feature の入口は画面の部品（`.vue`）も再 export する。** use-case がそこから値を import すると、実行時には推移的に画面まで読み込む。ESLint は直接の import しか見ないので検出できない。これは受け入れ、node 環境の unit テストでも `.vue` を読めるよう、Vitest の unit project に `@vitejs/plugin-vue` を足した（マウントはしないので Quasar は通さない）
- プレイヤー側の画面は、参加の状態（net の `PlayerLobbyState`）を通じて回線の型（`JoinRejectedReason`）を見る。表示名の検証にも回線のスキーマ（`displayNameSchema`）を使う。ホストが検証するのは回線のスキーマなので、それに合わせている。ADR 0002 の「use-case より外側にプロトコルの型を漏らさない」は、プレイヤー側の画面については守れていない

## 再検討のトリガー

- 入口が画面を再 export することで、use-case のテストや起動が目に見えて遅くなった。入口を「画面以外」と「画面の部品」に分ける（共通規約 ARCH-07 の変更になるので dev-standards で扱う）
- match に業務の規則が溜まり始めた。room / quiz のどちらかに移せないか見直す
