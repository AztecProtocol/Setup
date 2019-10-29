import moment, { Moment } from 'moment';
import { MpcState, Transcript } from 'setup-mpc-common';
import { TranscriptStore } from '../transcript-store';
import { Verifier } from '../verifier';
import { orderWaitingParticipants } from './order-waiting-participants';

const OFFLINE_AFTER = 10;

export async function advanceState(state: MpcState, store: TranscriptStore, verifier: Verifier, now: Moment) {
  const { paused, sequence, startTime, completedAt, invalidateAfter } = state;
  const nextSequence = sequence + 1;

  // Shift any participants that haven't performed an update recently to offline state and reorder accordingly.
  if (markIdleParticipantsOffline(state, nextSequence, now)) {
    state.participants = orderWaitingParticipants(state.participants, nextSequence);
    state.sequence = nextSequence;
  }

  // Nothing to do if paused, not yet running, or already completed.
  if (now.isBefore(startTime) || completedAt) {
    return;
  }

  // If we've not yet hit our selection block, or are sealing/publishing. Do nothing.
  if (state.ceremonyState !== 'SELECTED' && state.ceremonyState !== 'RUNNING') {
    return;
  }

  // Shift to running state if not already.
  if (state.ceremonyState !== 'RUNNING') {
    state.statusSequence = nextSequence;
    state.ceremonyState = 'RUNNING';
    state.sequence = nextSequence;
  }

  let runningParticipant = state.participants.find(p => p.state === 'RUNNING');

  // If we have a running participant, mark as invalidated if timed out.
  if (runningParticipant) {
    const { startedAt, tier, lastVerified } = runningParticipant;
    const { numG1Points, numG2Points, pointsPerTranscript } = state;
    const completeWithin = runningParticipant.invalidateAfter || invalidateAfter;
    const verifyWithin = 2 * completeWithin / (Math.max(numG1Points, numG2Points) / pointsPerTranscript);
    if (
      moment(now)
        .subtract(completeWithin, 's')
        .isAfter(startedAt!) ||
      (tier > 1 &&
        moment(now)
          .subtract(verifyWithin, 's')
          .isAfter(lastVerified || startedAt!))
    ) {
      runningParticipant.sequence = nextSequence;
      runningParticipant.state = 'INVALIDATED';
      runningParticipant.transcripts = [];
      runningParticipant.error = 'timed out';
      runningParticipant = undefined;
      state.sequence = nextSequence;
    } else {
      return;
    }
  }

  // If at least min participants reached and after end date, shift ceremony to sealing state.
  if (
    !runningParticipant &&
    state.participants.reduce((a, p) => (p.state === 'COMPLETE' ? a + 1 : a), 0) >= state.minParticipants &&
    now.isSameOrAfter(state.endTime)
  ) {
    state.statusSequence = nextSequence;
    state.ceremonyState = 'SEALING';
    state.sequence = nextSequence;
    return;
  }

  // Find next waiting, online participant and shift them to the running state.
  const waitingParticipant = state.participants.find(p => p.state === 'WAITING');
  if (!paused && waitingParticipant && waitingParticipant.online) {
    await store.eraseAll(waitingParticipant.address);
    state.sequence = nextSequence;
    state.statusSequence = nextSequence;
    waitingParticipant.sequence = nextSequence;
    waitingParticipant.startedAt = now;
    waitingParticipant.state = 'RUNNING';
    waitingParticipant.transcripts = await getRunningParticipantsTranscripts(state, store);
    verifier.runningAddress = waitingParticipant.address;
  }
}

async function getRunningParticipantsTranscripts(state: MpcState, store: TranscriptStore): Promise<Transcript[]> {
  const lastCompletedParticipant = state.participants
    .slice()
    .reverse()
    .find(p => p.state === 'COMPLETE');

  if (!lastCompletedParticipant) {
    return Array(Math.ceil(Math.max(state.numG1Points, state.numG2Points) / state.pointsPerTranscript))
      .fill(0)
      .map((_, num) => ({
        num,
        size: 0,
        downloaded: 0,
        uploaded: 0,
        state: 'WAITING',
      }));
  }

  const transcripts = await store.getVerified(lastCompletedParticipant.address);
  return transcripts.map(t => ({
    num: t.num,
    size: t.size,
    fromAddress: lastCompletedParticipant.address,
    downloaded: 0,
    uploaded: 0,
    state: 'WAITING',
  }));
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
