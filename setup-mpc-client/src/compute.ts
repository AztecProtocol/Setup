import { Participant, MpcServer, ParticipantRunningState } from 'setup-mpc-server/dest/mpc-server';
import moment = require('moment');

export class Compute {
  constructor(private server: MpcServer, private computeOffline: boolean) {}

  async start(myState: Participant) {
    if (this.computeOffline) {
      await this.updateMyRunningState(myState, 'OFFLINE');
      return;
    }

    if (myState.runningState === 'WAITING') {
      await this.updateMyRunningState(myState, 'DOWNLOADING');
    }

    if (myState.runningState === 'DOWNLOADING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.updateMyRunningState(myState, 'COMPUTING');
    }

    if (myState.runningState === 'COMPUTING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.updateMyRunningState(myState, 'UPLOADING');
    }

    if (myState.runningState === 'UPLOADING') {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const g1Path = '../setup-tools/setup_db/g1_x_current.dat';
      const g2Path = '../setup-tools/setup_db/g2_x_current.dat';

      await this.server.uploadData(myState.address, g1Path, g2Path);
    }
  }

  cancel() {}

  private async updateMyRunningState(myState: Participant, runningState: ParticipantRunningState) {
    console.error(`${myState.runningState} => ${runningState}`);
    myState.runningState = runningState;
    myState.lastUpdate = moment();
    await this.server.updateParticipant(myState);
  }
}
