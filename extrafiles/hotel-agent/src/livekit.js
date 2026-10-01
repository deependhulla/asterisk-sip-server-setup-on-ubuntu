import { Room, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioFrame } from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';

/** Joins a LiveKit room and publishes two tracks: caller audio + agent audio (16 kHz mono). */
export async function joinRoom(roomName, identity) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: false });
  const room = new Room();
  await room.connect(process.env.LIVEKIT_URL, await at.toJwt(), { autoSubscribe: false });

  const mk = async (name, source) => {
    const src = new AudioSource(16000, 1);
    const track = LocalAudioTrack.createAudioTrack(name, src);
    const opts = new TrackPublishOptions();
    opts.source = source;
    await room.localParticipant.publishTrack(track, opts);
    return src;
  };
  const caller = await mk('caller', TrackSource.SOURCE_MICROPHONE);
  const agent = await mk('agent', TrackSource.SOURCE_UNKNOWN);

  const push = (src, buf) => {
    const s = new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    src.captureFrame(new AudioFrame(s, 16000, 1, s.length)).catch(() => {});
  };
  return {
    pushCaller: (b) => push(caller, b),
    pushAgent: (b) => push(agent, b),
    close: () => room.disconnect().catch(() => {}),
  };
}
