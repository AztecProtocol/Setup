import { MpcState } from 'setup-mpc-common';

export interface StateStore {
  setState(state: MpcState): Promise<void>;
  getState(): Promise<MpcState>;
}

export class MemoryStateStore {
  private state!: MpcState;

  public async setState(state: MpcState) {
    this.state = state;
  }

  public async getState(): Promise<MpcState> {
    return this.state;
  }
}
