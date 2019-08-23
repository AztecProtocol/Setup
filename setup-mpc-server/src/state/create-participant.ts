import { Moment } from 'moment';
import { Participant } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { getGeoData } from '../maxmind';

const fakeIps = [
  '217.169.11.246', // London, GB
  '185.246.128.5', // Sweden
  '174.128.180.57', // US
  '5.181.235.180', // Japan
  '139.99.122.129', // Singapore
  '103.228.153.228', // India
  '209.58.190.1', // Hong Kong, CN
  '64.120.114.178', // Canada
  '169.57.213.160', // Brazil
  '185.253.97.215', // Norway
];

export function createParticipant(
  sequence: number,
  addedAt: Moment,
  position: number,
  tier: number,
  address: Address
): Participant {
  const ip = fakeIps[(position - 1) % fakeIps.length];
  const location = getGeoData(ip);
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
    location,
  };
}
