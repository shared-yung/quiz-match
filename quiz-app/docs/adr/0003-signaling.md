# ADR 0003: シグナリングは手動 SDP 交換を暫定手段にし、本実装は ASP.NET (SignalR) に置く

- ステータス: 承認
- 日付: 2026-09-27
- 関連: [#18](https://github.com/shared-yung/quiz-match/issues/18) / [ADR 0001 通信方式](0001-transport.md)

## 背景

ADR 0001 で WebRTC DataChannel のホスト星形トポロジを採用したが、`RTCPeerConnection` を張るには SDP（と ICE candidate）をホストとプレイヤーの間で交換する経路が要る。この経路（シグナリング）は WebRTC 自体の範囲外で、別に用意しなければならない。

ADR 0001 の「影響」に書いたとおり、シグナリングのサーバ側実装は別リポジトリ（ASP.NET）の作業で、このリポジトリの作業と並行しない。バックエンドが無い間も `net` feature の実装（#19 以降）を進められる必要がある。

## 検討した選択肢

1. **本実装は SignalR、揃うまでは手動の SDP コピー&ペーストで代替する**（採用）
2. バックエンドが揃うまで `net` feature の実装を止める
3. 簡易な signaling サーバを自前で立てる（WebSocket の中継サービスなど）

## 決定

**本実装は ASP.NET (SignalR) に置く。揃うまでの暫定手段として、SDP を人がコピー&ペーストして交換する方式を用意する。**

`Signaling` port を `features/net/domain` に定義し、シグナリングの手段を差し替え可能にする。暫定手段の実装（`features/net/infrastructure`）は `RTCPeerConnection` を直接操作し、ICE candidate は trickle させず SDP に含めてから交換する（後述）。

## 根拠

### バックエンドを待たない

選択肢 2 は最も単純だが、`net` feature の他の issue（#19 ホスト星形の P2P 接続、#20 再接続）がすべて止まる。バックエンドは別リポジトリの作業で、いつ揃うか this リポジトリ側からは分からない。

### SignalR を選ぶ理由

ASP.NET を前提にしている（[ADR 0001](0001-transport.md)）ため、素の WebSocket や別サービスより統合が単純。SDP / ICE candidate をやり取りするだけの薄いメッセージ中継で、SignalR の Hub がそのまま使える。自前の中継サーバ（選択肢 3）を立てる理由が無い。

### 手動交換は non-trickle ICE にする

**Trickle ICE（candidate を見つかるたびに個別に送る）だと往復回数が不定になり、コピー&ペーストでは扱えない。** 代わりに `icegatheringstate` が `complete` になるまで待ち、`localDescription` に集まった candidate を含めて**1つの文字列**として交換する。ホスト→プレイヤーに offer を渡し、プレイヤー→ホストに answer を返すだけの、往復1回のやり取りに収まる。

接続に時間がかかる（全 candidate の収集を待つ）が、暫定手段でしか使わないので許容する。SignalR 実装では trickle ICE に戻せる（`Signaling` port の形は往復回数を強制しない）。

### `Signaling` port を分ける理由

`Transport`（[ADR 0001](0001-transport.md)）と同じ考え方。SDP の交換手段（手動 / SignalR）を `net` の他の部分から隠す。`RTCPeerConnection` を直接扱うのは `features/net/infrastructure` に閉じ、domain は交換する文字列の形だけを知る。

## 影響

- `features/net/domain/signaling.ts` に `Signaling` port を追加する
- 暫定実装は `features/net/infrastructure` に置き、`RTCPeerConnection` を直接操作する（#19 の Transport 実装とは別の、単一ペアの接続確立だけに責務を絞る）
- 確認用の最小限の UI を用意し、ブラウザ2タブでの手動確認で「暫定手段で接続できる」ことを示す。ルーム作成・参加の本来の UI は #21 で別に作る
- `RTCPeerConnection` はテスト環境（Node / happy-dom）に無いため、実際の接続確立は自動テストできない。オーケストレーションのロジック（呼び出し順序・状態のマッピング）は `RTCPeerConnection` 相当のフェイクで unit test し、実際の接続はブラウザで手動確認する

## 再検討のトリガー

- SignalR のサーバ実装が揃い、手動交換が不要になった時点で `features/net/infrastructure` の手動実装を削除する（`Signaling` port はそのまま残る）
- 手動交換の接続確立が実用上遅すぎると分かった場合、trickle ICE 相当の複数往復に方式を変える
