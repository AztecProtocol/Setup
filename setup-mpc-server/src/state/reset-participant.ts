import { MpcState, Participant } from 'setup-mpc-common';
import { orderWaitingParticipants } from './order-waiting-participants';

export function resetParticipant(state: MpcState, p: Participant, invalidateAfter?: number) {
  // Reset participant.
  p.state = 'WAITING';
  p.runningState = 'WAITING';
  p.startedAt = undefined;
  p.lastVerified = undefined;
  p.error = undefined;
  p.invalidateAfter = invalidateAfter;
  p.computeProgress = 0;
  p.verifyProgress = 0;
  p.transcripts = [];

  const complete = state.participants
    .filter(p => p.state !== 'WAITING')
    .sort((a, b) => a.startedAt!.unix() - b.startedAt!.unix());
  const waiting = state.participants.filter(p => p.state === 'WAITING');

  state.participants = orderWaitingParticipants([...complete, ...waiting], state.sequence);
}
