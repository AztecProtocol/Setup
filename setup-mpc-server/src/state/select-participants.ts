import seedrandom from 'seedrandom';
import { MpcState } from 'setup-mpc-common';
import { orderWaitingParticipants } from './order-waiting-participants';

function shuffle<T>(seed: Buffer, array: T[]) {
  const prng = seedrandom(seed.toString('hex'));
  let m = array.length;
  let t: T;
  let i: number;

  // Fisher-Yates shuffle.
  while (m) {
    // Pick a remaining element.
    const n = prng.double();
    i = Math.floor(n * m--);
    t = array[m];

    // And swap it with the current element.
    array[m] = array[i];
    array[i] = t;
  }
}

export function selectParticipants(state: MpcState, blockHash: Buffer) {
  if (state.ceremonyState !== 'PRESELECTION') {
    return;
  }

  console.log('Selecting participants.');

  state.sequence += 1;
  state.statusSequence = state.sequence;
  state.ceremonyState = 'SELECTED';

  let { participants } = state;
  const tier0 = participants.filter(t => t.tier === 0);
  const tier1 = participants.filter(t => t.tier === 1);
  shuffle(blockHash, tier1);
  const earlyBirds = participants.filter(t => t.tier === 2);
  shuffle(blockHash, earlyBirds);
  const tier2 = earlyBirds.slice(0, state.maxTier2);
  const tier3 = earlyBirds.slice(state.maxTier2).sort((a, b) => a.addedAt.valueOf() - b.addedAt.valueOf());
  tier3.forEach(p => (p.tier = 3));

  participants = [...tier0, ...tier1, ...tier2, ...tier3];

  participants.forEach((p, i) => {
    p.sequence = state.sequence;
    p.priority = i + 1;
  });

  state.participants = orderWaitingParticipants(participants, state.sequence);
}
