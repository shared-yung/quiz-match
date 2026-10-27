import { expect, type Page, test } from '@playwright/test';

/**
 * ホストとプレイヤーが揃った状態での通しの動作（#27）。
 *
 * ルーム作成 → 参加 → 出題 → 早押し → 回答 → 判定。ホストとプレイヤーは別のブラウザ
 * コンテキストで、接続の文字列（SDP）は人の代わりにテストが受け渡す。
 */

/** 読み取り専用の欄に出た文字列を待って取り出す */
const readOffer = async (page: Page, label: string): Promise<string> => {
  const field = page.getByLabel(label);
  await expect(field).not.toHaveValue('');

  return field.inputValue();
};

test('ルームを作って参加し、早押しで答えて正解すると勝者が決まる', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const player = await (await browser.newContext()).newPage();

  // ルームを作る。1 点先取にして、1 問の正解で決着させる
  await host.goto('/#/host');
  await host.getByLabel('勝ちになる点数').fill('1');
  await host.getByRole('button', { name: 'この設定でルームを作る' }).click();

  // 招待の文字列をプレイヤーへ渡し、返事をホストへ戻す
  await host.getByRole('button', { name: 'プレイヤーを招待' }).click();
  const offer = await readOffer(host, 'プレイヤーへ渡す文字列');

  await player.goto('/#/join');
  await player.getByLabel('表示名').fill('たろう');
  await player.getByRole('button', { name: 'この名前で参加する' }).click();
  await player.getByLabel('ホストから受け取った文字列').fill(offer);
  await player.getByRole('button', { name: '返事を作る' }).click();
  const answer = await readOffer(player, 'ホストへ渡す文字列');

  await host.getByLabel('プレイヤーから返ってきた文字列').fill(answer);
  await host.getByRole('button', { name: '受け取る' }).click();
  await expect(host.getByText('参加者（1 人）')).toBeVisible();

  // 出題する
  await host.getByLabel('問題文').fill('日本一高い山は');
  await host.getByRole('button', { name: 'この問題にする' }).click();
  await host.getByRole('button', { name: '公開を始める' }).click();

  // 文字が届き始めたら早押しする
  await expect(player.getByTestId('revealed')).toContainText('日本');
  await player.getByRole('button', { name: '早押し' }).click();
  await expect(host.getByText('たろう が押しました。回答を待っています。')).toBeVisible();

  // 回答する
  await expect(player.getByText(/残り \d+ 秒/)).toBeVisible();
  await player.getByLabel('回答', { exact: true }).fill('富士山');
  await player.getByRole('button', { name: '回答を送る' }).click();
  await expect(player.getByText('回答を送りました。ホストの判定を待っています。')).toBeVisible();

  // ホストが判定する
  await expect(host.getByLabel('回答', { exact: true })).toHaveValue('富士山');
  await host.getByRole('button', { name: '正解', exact: true }).click();

  // 得点と決着が両方に届く
  await expect(host.getByText('たろう の勝ちです。')).toBeVisible();
  await expect(player.getByText('たろう の勝ちです。')).toBeVisible();
  await expect(player.getByText('正解: 日本一高い山は')).toBeVisible();
});
