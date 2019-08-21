import moment from 'moment';
import { Participant } from 'setup-mpc-common';
import { Wallet } from 'web3x/wallet';
import { createParticipant } from './create-participant';
import { orderWaitingParticipants } from './order-waiting-participants';

describe('order waiting participants', () => {
  const wallet = Wallet.fromMnemonic('alarm disagree index ridge tone outdoor betray pole forum source okay joy', 10);
  const addresses = wallet.currentAddresses();
  let participants: Participant[];

  beforeEach(() => {
    participants = addresses.map((a, i) => createParticipant(0, moment().add(i, 's'), i + 1, 1, a));
  });

  it('should correctly order participants', () => {
    const result = orderWaitingParticipants(participants, 0);
    expect(result.map(p => p.address)).toEqual(addresses);
  });

  it('should correctly order online participants', () => {
    participants[3].online = true;
    participants[7].online = true;
    const result = orderWaitingParticipants(participants, 0);
    expect(result[0].address).toEqual(addresses[3]);
    expect(result[1].address).toEqual(addresses[7]);
    expect(result[2].address).toEqual(addresses[0]);
  });

  it('should correctly order tiered participants', () => {
    participants[0].tier = 3;
    participants[1].tier = 2;
    participants[2].tier = 3;
    participants[2].online = true;

    const result = orderWaitingParticipants(participants, 0);

    expect(result[9].address).toEqual(addresses[0]);
    expect(result[8].address).toEqual(addresses[1]);
    expect(result[0].address).toEqual(addresses[2]);
  });

  it('should correctly order priority participants', () => {
    participants[0].tier = 2;
    participants[0].priority = 5;
    participants[1].tier = 2;
    participants[2].tier = 2;
    participants[2].online = true;
    participants[3].tier = 2;
    participants[4].tier = 2;
    participants[4].priority = 1;

    const result = orderWaitingParticipants(participants, 0);

    expect(result[6].address).toEqual(addresses[4]);
  });
});
