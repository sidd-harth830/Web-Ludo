import { io } from 'socket.io-client';

export const socket = io('http://localhost:3001', {
  autoConnect: false // We will connect manually when joining a room
});
