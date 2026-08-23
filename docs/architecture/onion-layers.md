# オニオンの層構成

層を先に切るのではなく **feature を先に切り、その中に層を置く**（feature-first）。規模が大きくなったときに、機能単位で把握・追加・削除ができるようにするため。

## ディレクトリ

```
<project>/src/
├── features/
│   └── <feature>/
│       ├── domain/           最内層。エンティティ、値オブジェクト、リポジトリの interface
│       ├── use-case/         ビジネスロジック本体。domain のみに依存
│       ├── infrastructure/   API・ストレージなど外部との接続。interface の実装
│       ├── presentation/     Vue コンポーネントと Pinia ストア
│       └── index.ts          この feature の公開 API。他 feature はここだけを見る
├── shared/                   feature をまたぐ共有コード
└── boot/ router/ layouts/ pages/   アプリ組み立て層（合成ルート）
```

## 依存の向き

外側から内側へ**一方向**。内側は外側を知らない。

| 層                                      | import してよい先                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `domain`                                | 自 feature の `domain`、`shared`                                                       |
| `use-case`                              | 自 feature の `domain` `use-case`、`shared`、他 feature の `index.ts`                  |
| `infrastructure`                        | 自 feature の `domain` `use-case` `infrastructure`、`shared`、他 feature の `index.ts` |
| `presentation`                          | 自 feature の `domain` `use-case` `presentation`、`shared`、他 feature の `index.ts`   |
| `index.ts`                              | 自 feature の全層、`shared`                                                            |
| `boot` / `router` / `layouts` / `pages` | 各 feature の `index.ts`、`shared`                                                     |

押さえておくべき点が3つある。

**presentation は infrastructure を直接 import できない。** 必ず use-case を経由する。これが Pinia ストアにビジネスロジックが溜まるのを防ぐ主な仕掛けになっている（[Pinia の責務境界](pinia.md)）。

**feature をまたぐ参照は `index.ts` 経由のみ。** 他 feature の `domain/` などに直接手を伸ばすことはできない。feature の内部構造を後から変えても影響範囲が閉じる。

**DI の組み立ては `index.ts` かアプリ組み立て層で行う。** use-case は domain 側に置いた interface に依存し、その実装（infrastructure）を注入されるだけ。use-case から infrastructure への import は許可していない。

## domain 層の外部依存

**import してよい外部ライブラリは `zod` のみ。** Vue、Quasar、Pinia、HTTP クライアント、日付ライブラリはすべて禁止。

domain を純粋に保つと、テストが node 環境で高速に回り、UI やバックエンドの都合から独立する。これは規約ではなく ESLint で機械的に落としている（[ESLint による層の強制](../tooling/eslint-boundaries.md)）。

関連: [API クライアントと型生成](api-client.md) / [テスト方針](../tooling/testing.md)
