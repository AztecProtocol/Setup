import moment from 'moment';
import { MpcState } from 'setup-mpc-common';
import { hexToBuffer } from 'web3x/utils';
import { Wallet } from 'web3x/wallet';
import { defaultState } from '../default-state';
import { createParticipant } from './create-participant';
import { orderWaitingParticipants } from './order-waiting-participants';
import { selectParticipants } from './select-participants';

describe('select participants', () => {
  const wallet = Wallet.fromMnemonic('alarm disagree index ridge tone outdoor betray pole forum source okay joy', 10);
  const addresses = wallet.currentAddresses();
  let state: MpcState;

  beforeEach(() => {
    state = defaultState(1234);
    state.participants = addresses.map((a, i) => createParticipant(0, moment().add(i, 's'), i + 1, i < 5 ? 1 : 2, a));
  });

  it('should correctly select participants', () => {
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    for (const p of state.participants.slice(0, 5)) {
      expect(addresses.slice(0, 5).includes(p.address)).toBeTruthy();
    }
    for (const p of state.participants.slice(5)) {
      expect(addresses.slice(5).includes(p.address)).toBeTruthy();
    }
  });

  it('should not affect priority with online status', () => {
    state.participants[9].online = true;
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    expect(state.participants[0].address.equals(addresses[9])).toBeTruthy();
    state.participants[0].online = false;
    state.participants = orderWaitingParticipants(state.participants, 0);
    expect(state.participants[0].address.equals(addresses[9])).toBeFalsy();
  });

  it('should change ordering', () => {
    expect(state.participants.map(p => p.address)).toEqual(addresses);
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    expect(state.participants.map(p => p.address)).not.toEqual(addresses);
  });

  it('should have same ordering with same hash', () => {
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    const addresses = state.participants.map(p => p.address);
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    expect(state.participants.map(p => p.address)).toEqual(addresses);
  });

  it('should have different ordering with different hash', () => {
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    const addresses = state.participants.map(p => p.address);
    state.ceremonyState = 'PRESELECTION';
    selectParticipants(state, hexToBuffer('0x2aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    expect(state.participants.map(p => p.address)).not.toEqual(addresses);
  });

  it('should limit tier 2 participants, resulting tier 3 in time added order', () => {
    state.maxTier2 = 2;
    selectParticipants(state, hexToBuffer('0x1aeaff3366f816e1d0157664dcd7ffaeb8741c854e2575ec9d438fc42c83b870'));
    for (const p of state.participants.slice(0, 5)) {
      expect(p.tier).toBe(1);
      expect(addresses.slice(0, 5).includes(p.address)).toBeTruthy();
    }
    for (const p of state.participants.slice(5, 7)) {
      expect(p.tier).toBe(2);
      expect(addresses.slice(5).includes(p.address)).toBeTruthy();
    }
    for (const p of state.participants.slice(7, 10)) {
      expect(p.tier).toBe(3);
      expect(addresses.slice(5).includes(p.address)).toBeTruthy();
    }
    expect(state.participants[7].addedAt.isBefore(state.participants[8].addedAt)).toBeTruthy();
    expect(state.participants[8].addedAt.isBefore(state.participants[9].addedAt)).toBeTruthy();
  });
});
