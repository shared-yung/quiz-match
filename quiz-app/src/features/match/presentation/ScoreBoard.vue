<script setup lang="ts">
import { computed } from 'vue';
import type { Standings } from '@/features/match/use-case';
import { useAppI18n } from '@/shared/i18n';

/**
 * 順位表。全員の得点と、勝利条件を満たしたときの勝者を見せる。
 *
 * 得点の計算と勝敗の判定はホストの use-case にあり、ここは並べて見せるだけ。
 */
const props = defineProps<{
  standings: Standings;
  /** 参加者。得点に名前を付けるのに使う */
  players: readonly { id: string; name: string }[];
  /** 自分の id。プレイヤーの画面で自分の行に印を付ける */
  self?: string | undefined;
}>();

const { t } = useAppI18n();

const nameOf = (playerId: string): string =>
  props.players.find((player) => player.id === playerId)?.name ?? t('scoreBoard.unknownPlayer');

/** 得点の高い順。同点はホストが決めた参加者の順のまま */
const rows = computed(() =>
  props.standings.points
    .map((entry, order) => ({ ...entry, order, name: nameOf(entry.playerId) }))
    .sort((a, b) => b.points - a.points || a.order - b.order),
);

const isWinner = (playerId: string): boolean =>
  props.standings.winners?.includes(playerId) ?? false;

/** 勝者の名前。ゲームが終わるまでは `undefined` */
const winnerNames = computed(() =>
  props.standings.winners?.map(nameOf).join(t('scoreBoard.nameSeparator')),
);
</script>

<template>
  <q-card flat bordered>
    <q-card-section class="q-gutter-sm">
      <div class="text-subtitle1">{{ t('scoreBoard.title') }}</div>

      <q-banner
        v-if="standings.winners != undefined && winnerNames != undefined"
        rounded
        class="bg-positive text-white"
        data-test="winners"
      >
        {{
          standings.winners.length > 1
            ? t('scoreBoard.draw', { names: winnerNames })
            : t('scoreBoard.winner', { name: winnerNames })
        }}
      </q-banner>

      <div v-if="rows.length === 0" class="text-grey-7">{{ t('scoreBoard.empty') }}</div>
      <q-list v-else dense>
        <q-item v-for="row in rows" :key="row.playerId" data-test="row">
          <q-item-section>
            <span :class="{ 'text-weight-bold': row.playerId === self }">
              {{ row.playerId === self ? t('scoreBoard.you', { name: row.name }) : row.name }}
            </span>
          </q-item-section>
          <q-item-section side>
            <div class="row items-center q-gutter-xs">
              <q-badge
                v-if="isWinner(row.playerId)"
                color="positive"
                :label="t('scoreBoard.winnerBadge')"
              />
              <span>{{ t('scoreBoard.points', { points: row.points }) }}</span>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>
