import moment = require('moment');
import { MpcState } from 'setup-mpc-common';

export function defaultState(latestBlock: number): MpcState {
  return {
    sequence: 0,
    statusSequence: 0,
    startSequence: 0,
    ceremonyState: 'PRESELECTION',
    startTime: moment().add(5, 's'),
    endTime: moment().add(1, 'month'),
    latestBlock,
    selectBlock: latestBlock + 3,
    maxTier2: 0,
    minParticipants: 100,
    numG1Points: 1000000,
    numG2Points: 1,
    pointsPerTranscript: 100000,
    invalidateAfter: 180,
    participants: [],
  };
}
