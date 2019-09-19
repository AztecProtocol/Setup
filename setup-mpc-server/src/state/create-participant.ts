import { Moment } from 'moment';
import { Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';

export function createParticipant(
  sequence: number,
  addedAt: Moment,
  position: number,
  tier: number,
  address: Address
): Participant {
  return {
    sequence,
    addedAt,
    online: false,
    state: 'WAITING',
    runningState: 'WAITING',
    position,
    priority: position,
    tier,
    computeProgress: 0,
    verifyProgress: 0,
    transcripts: [],
    address,
  };
}
