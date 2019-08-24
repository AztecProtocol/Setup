import moment, { Moment } from 'moment';
import { MpcState } from 'setup-mpc-common';
import { TranscriptStore } from '../transcript-store';
import { Verifier } from '../verifier';
import { orderWaitingParticipants } from './order-waiting-participants';

const OFFLINE_AFTER = 10;

export async function advanceState(state: MpcState, store: TranscriptStore, verifier: Verifier, now: Moment) {
  const { sequence, startTime, completedAt, invalidateAfter } = state;
  const nextSequence = sequence + 1;

  // Shift any participants that haven't performed an update recently to offline state and reorder accordingly.
  if (markIdleParticipantsOffline(state, nextSequence, now)) {
    state.participants = orderWaitingParticipants(state.participants, nextSequence);
    state.sequence = nextSequence;
  }

  // Nothing to do if not yet running, or already completed.
  if (now.isBefore(startTime) || completedAt) {
    return;
  }

  // If we've not yet hit our selection block. Do nothing.
  if (state.ceremonyState === 'PRESELECTION') {
    return;
  }

  // Shift to running state if not already.
  if (state.ceremonyState !== 'RUNNING') {
    state.statusSequence = nextSequence;
    state.ceremonyState = 'RUNNING';
    state.sequence = nextSequence;
  }

  // If at least min participants reached and after end date, shift ceremony to complete state.
  if (
    state.participants.reduce((a, p) => (p.state === 'COMPLETE' ? a + 1 : a), 0) >= state.minParticipants &&
    now.isSameOrAfter(state.endTime)
  ) {
    state.statusSequence = nextSequence;
    state.ceremonyState = 'COMPLETE';
    state.completedAt = now;
    state.sequence = nextSequence;
    return;
  }

  // If we have a running participant, mark as invalidated if timed out.
  const runningParticipant = state.participants.find(p => p.state === 'RUNNING');
  if (runningParticipant) {
    const { startedAt, tier, lastVerified } = runningParticipant;
    const { numG1Points, numG2Points, pointsPerTranscript } = state;
    const verifyWithin = invalidateAfter / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
    if (
      moment(now)
        .subtract(invalidateAfter, 's')
        .isAfter(startedAt!) ||
      (tier > 1 &&
        moment(now)
          .subtract(verifyWithin, 's')
          .isAfter(lastVerified || startedAt!))
    ) {
      runningParticipant.sequence = nextSequence;
      runningParticipant.state = 'INVALIDATED';
      runningParticipant.error = 'timed out';
      state.sequence = nextSequence;
    } else {
      return;
    }
  }

  // Find next waiting, online participant and shift them to the running state.
  const waitingParticipant = state.participants.find(p => p.state === 'WAITING' && p.online);
  if (waitingParticipant && waitingParticipant.state === 'WAITING') {
    await store.erase(waitingParticipant.address);
    state.sequence = nextSequence;
    state.statusSequence = nextSequence;
    waitingParticipant.sequence = nextSequence;
    waitingParticipant.startedAt = now;
    waitingParticipant.state = 'RUNNING';
    verifier.runningAddress = waitingParticipant.address;
  }
}

function markIdleParticipantsOffline(state: MpcState, sequence: number, now: Moment) {
  const { participants } = state;
  let changed = false;
  participants.forEach(p => {
    if (
      moment(now)
        .subtract(OFFLINE_AFTER, 's')
        .isAfter(p.lastUpdate!) &&
      p.online
    ) {
      state.statusSequence = sequence;
      p.sequence = sequence;
      p.online = false;
      changed = true;
    }
  });
  return changed;
}
