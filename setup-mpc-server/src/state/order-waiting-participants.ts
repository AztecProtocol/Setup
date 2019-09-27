import { cloneParticipant, Participant } from 'setup-mpc-common';

export function orderWaitingParticipants(participants: Participant[], sequence: number) {
  const indexOfFirstWaiting = participants.findIndex(p => p.state === 'WAITING');

  const waiting = participants.slice(indexOfFirstWaiting).sort((a, b) => {
    if (a.tier === 0 || b.tier === 0) {
      return a.tier !== b.tier ? a.tier - b.tier : a.priority - b.priority;
    }
    if (a.online !== b.online) {
      return a.online ? -1 : 1;
    }
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    return a.priority - b.priority;
  });

  let orderedParticipants = [...participants.slice(0, indexOfFirstWaiting), ...waiting];

  // Adjust positions based on new order and advance sequence numbers if position changed.
  orderedParticipants = orderedParticipants.map((p, i) => {
    if (p.position !== i + 1) {
      p = cloneParticipant(p);
      p.position = i + 1;
      p.sequence = sequence;
    }
    return p;
  });

  return orderedParticipants;
}
