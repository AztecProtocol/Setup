import moment = require('moment');
import { Address } from 'web3x/address';
import { MpcState, Participant } from './mpc-server';

export function mpcStateFromJSON(json: any): MpcState {
  const { startTime, completedAt, participants, ...rest } = json;

  return {
    ...rest,
    startTime: moment(startTime),
    completedAt: completedAt ? moment(completedAt) : undefined,
    participants: participants.map(({ startedAt, lastUpdate, completedAt, address, transcripts, ...rest }: any) => ({
      ...rest,
      startedAt: startedAt ? moment(startedAt) : undefined,
      lastUpdate: lastUpdate ? moment(lastUpdate) : undefined,
      completedAt: completedAt ? moment(completedAt) : undefined,
      address: Address.fromString(address),
      transcripts: transcripts.map(({ fromAddress, ...rest }: any) => ({
        ...rest,
        fromAddress: fromAddress ? Address.fromString(fromAddress) : undefined,
      })),
    })),
  };
}

export function cloneParticipant(participant: Participant): Participant {
  return {
    ...participant,
    transcripts: participant.transcripts.map(t => ({ ...t })),
  };
}

export function cloneMpcState(state: MpcState): MpcState {
  return {
    ...state,
    participants: state.participants.map(cloneParticipant),
  };
}

export function applyDelta(state: MpcState, delta: MpcState): MpcState {
  const participants = [...state.participants];
  delta.participants.forEach(p => (participants[p.position - 1] = p));
  return {
    ...delta,
    participants,
  };
}
