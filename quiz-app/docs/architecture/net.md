# net feature の構成

ホスト星形の P2P 通信（[ADR 0001](../adr/0001-transport.md)）を、どの部品で組み立てているか。シグナリングの方式は [ADR 0003](../adr/0003-signaling.md)、やり取りするメッセージは [P2P メッセージプロトコル](../spec/p2p-protocol.md)。

## port（`features/net/domain`）

| port                                | 責務                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `Signaling`                         | **1ペア**の接続確立（offer / answer の交換）                                            |
| `Transport`                         | 相手（`PeerId`）ごとの**文字列**の送受信と接続状態。プロトコルを知らない                |
| `HostMessenger` / `PlayerMessenger` | `Transport` の上でプロトコルのメッセージをやり取りする。**受信の検証はここで行う**      |
| `HostNetwork` / `PlayerNetwork`     | 上の3つを役ごとに束ねたもの。ホストは `invite()` でプレイヤー1人分の `Signaling` を得る |
| `Networking`                        | ホスト / プレイヤーのどちらとして通信を始めるかを選ぶ入口。合成ルートが provide する    |

## 星形はどこで表れるか

**`Transport` の実装（`data-channel-transport.ts`）は星形を知らない。** `PeerId` ごとに `RTCDataChannel` を束ねるだけで、ホストはプレイヤーの数だけ、プレイヤーはホストの1本だけを `attach` する。この使い方の違いが星形になる。

- ホスト: `invite()` のたびに `RTCPeerConnection` と `Signaling` を1組作り、新しい `PeerId` を割り当てる。DataChannel はホスト側が作る
- プレイヤー: `RTCPeerConnection` は1本だけ。ホストの DataChannel が届いたら固定の `hostPeerId` で `attach` する

`Signaling` は1ペアの責務のまま変えていない。確立した DataChannel は `onDataChannel` で外へ渡すだけで、送受信は `Transport` が受け持つ。複数ペアの管理を `Signaling` に持たせると、SignalR 実装に差し替えるときに同じ管理を書き直すことになる。

## 受信の検証を `Transport` に置かない理由

`Transport` は文字列の送受信に徹する（#17 で決めた契約）。WebRTC 以外にも差し替えられるよう、プロトコルの知識を持ち込まない。検証は `shared/protocol` のコーデック（`decodePlayerMessage` / `decodeHostMessage`）を通す `HostMessenger` / `PlayerMessenger` が行い、通らなかったものは黙って捨てる。

- ホストはプレイヤーから **Player → Host のメッセージだけ**を受け付ける。Host → Player の形をしたものも破棄する
- プレイヤーは `hostPeerId` 以外からの受信を、検証する前に捨てる

## 接続状態

`Transport` の接続状態は `RTCPeerConnection` ではなく **DataChannel の `readyState`** から写す。送受信できるかどうかを表したいので、メッセージの通り道そのものの状態を見る。

| `RTCDataChannelState` | `ConnectionState` |
| --------------------- | ----------------- |
| `connecting`          | `Connecting`      |
| `open`                | `Connected`       |
| `closing` / `closed`  | `Disconnected`    |

同じ `PeerId` に DataChannel を `attach` し直すと置き換わり、古い DataChannel からの通知は無視する。プレイヤーの再接続はこの経路を使う（下記）。

**通知するのは状態が変わったときだけ。** Chrome は相手が作った DataChannel を開いた状態で `datachannel` イベントに渡し、その後で `open` も発火する。イベントの数だけ知らせると「接続済み」が重なる。

## 参加・再参加（ロビー）

接続をプレイヤーとして迎えるのは use-case の2つ。早押しや回答は扱わない。仕様は[プロトコル](../spec/p2p-protocol.md)の「再参加と途中参加」、決めた理由は [ADR 0004](../adr/0004-rejoin-token.md)。

| use-case            | 役割                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createHostLobby`   | `join` / `rejoin` を受けて `PeerRegistry` で接続とプレイヤーを結び、本人に返事と途中経過を送る。プレイヤー単位の接続状態（`presence`）を持つ |
| `createPlayerLobby` | ホストとつながるたびに名乗る（初回は `join`、受け付けられた後は `rejoin`）。参加の状態（参加待ち / 参加済み / 断られた / 切断）を持つ        |

ホストのロビーは room を直接知らない。参加の可否（`admit`）、まだ居るか（`isMember`）、途中経過（`catchUp`）を関数で受け取る。合成ルートが room の `RoomSession` と `catchUpMessages` をつなぐ。

**再接続の手順。** ホストはもう一度 `invite()` して新しい `PeerId` の接続を作る。プレイヤーは `PlayerNetwork.connect()` で前の `RTCPeerConnection` を閉じて新しく用意し、届いた DataChannel を同じ `hostPeerId` に `attach` する。`Transport` と `messenger` は差し替わらないので、購読者はそのまま使える。つながったら `PlayerLobby` が `rejoin` を送り、ホストのロビーが新しい `PeerId` を同じプレイヤーに結び直す。

## テストと手動確認

`RTCPeerConnection` と `RTCDataChannel` はテスト環境に無いため、どちらもフェイク（`test/features/net/infrastructure/*.fake.ts`）で置き換えて unit test する。3人のプレイヤーとの送受信は `webrtc-network.spec.ts` で確かめている。

実際の接続はブラウザで手動確認する。

1. `bun run dev` で起動し、`/#/debug/net/host` を1タブ、`/#/debug/net/player` を人数分のタブで開く
2. ホストで「プレイヤーを招待」を人数分押す。招待ごとに Offer の文字列ができる
3. 各プレイヤーのタブに Offer を貼って「Offer を受けて Answer を作る」。できた Answer をホストの同じ枠に貼って「Answer を受ける」
4. プレイヤーはつながると自動で参加する（Offer を受ける前に表示名を入れておく）。ホストの「参加者」に名前と接続状態が出る。早押しを送ったり、ホストから全員へ文字を送ったりできる
5. 再参加を試すときは、ホストで「プレイヤーを招待」をもう一度押し、新しい Offer で 3 と同じ操作をする。プレイヤーの前の接続は閉じられ、ホストの「参加者」で同じ名前・同じ id のまま「接続済み」に戻る

## 決めていないこと

- 切断したプレイヤーの `PeerId` を `Transport` から消すかどうか。今は残し、状態が `Disconnected` になるだけ。再参加で置き換えられた古い接続も、ホストの `close()` まで残る
