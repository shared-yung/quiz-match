# quiz-app のドキュメント

オンライン早押しクイズサービス。ホストが問題文を1文字ずつ配信し、プレイヤーが早押しで回答する。正誤判定はホストの手動。

**リポジトリ全体に適用される規約は [ルートの docs/](../../docs/README.md) にある。** ここにはこのプロジェクト固有のものだけを置く。

## 仕様

- [ゲームルールと状態遷移](spec/game-rules.md) — 状態機械、RuleSet、得点と勝利条件
- [P2P メッセージプロトコル](spec/p2p-protocol.md) — ホストとプレイヤーがやり取りするメッセージ

## 設計

`architecture/` — このプロジェクト固有の設計。層構成やテスト方針などリポジトリ共通のものは[ルートの docs/](../../docs/README.md)。

- [net feature の構成](architecture/net.md) — ホスト星形を Signaling / Transport / Messenger でどう組み立てるか、手動での接続確認の手順

## 決定の記録

- [0001 通信に WebRTC を採用し、Epic Online Services を見送る](adr/0001-transport.md) — EOS がブラウザで使えない理由と、設計意図をどう保ったか
- [0002 プロトコルの型をドメインの型から独立させる](adr/0002-protocol-types.md) — 同じ形のスキーマを2か所に持つ理由と、ズレをどこで検知するか
- [0003 シグナリングは手動 SDP 交換を暫定手段にし、本実装は ASP.NET (SignalR) に置く](adr/0003-signaling.md) — バックエンドを待たずに進める方法と、non-trickle ICE にした理由
- [0004 切断は退室とせず、再参加はホストが渡すトークンで本人を確かめる](adr/0004-rejoin-token.md) — 表示名や id で照合しない理由と、ホストの切断から復帰しない理由

リポジトリ全体にまたがる判断は[ルートの docs/adr/](../../docs/adr/)。
