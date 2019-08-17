import moment = require('moment');
import { MpcState } from 'setup-mpc-common';

export const defaultState = (): MpcState => ({
  sequence: 0,
  statusSequence: 0,
  ceremonyState: 'PRESELECTION',
  startTime: moment().add(5, 's'),
  numG1Points: 1000000,
  numG2Points: 1,
  pointsPerTranscript: 100000,
  invalidateAfter: 180,
  participants: [],
});
