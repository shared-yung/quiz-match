import type { Room } from '@/features/room/domain/room';
import type { RoomNotifier } from '@/features/room/domain/room-notifier';

/** 知らされたルームを、届いた順に記録するだけの fake。 */
export const createRecordingRoomNotifier = () => {
  const rooms: Room[] = [];

  const notifier: RoomNotifier = {
    roomChanged: (room) => {
      rooms.push(room);
    },
  };

  return { notifier, rooms };
};
