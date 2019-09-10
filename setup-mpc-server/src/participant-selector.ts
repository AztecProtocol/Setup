import { EventEmitter } from 'events';
import { Address } from 'web3x/address';
import { Eth } from 'web3x/eth';
import { HttpProvider } from 'web3x/providers';

export type EthNet = 'mainnet' | 'ropsten';

export class ParticipantSelectorFactory {
  constructor(private ethNet: EthNet, private signupAddress: Address, private projectId: string) {}

  public create(startBlock: number, selectBlock: number) {
    return new ParticipantSelector(this.ethNet, this.signupAddress, startBlock, selectBlock, this.projectId);
  }

  public async getCurrentBlockHeight() {
    const provider = new HttpProvider(`https://${this.ethNet}.infura.io/v3/${this.projectId}`);
    const eth = new Eth(provider);
    return await eth.getBlockNumber();
  }
}

export class ParticipantSelector extends EventEmitter {
  private provider: HttpProvider;
  private eth: Eth;
  private cancelled = false;

  constructor(
    ethNet: EthNet,
    private signupAddress: Address,
    private startBlock: number,
    private selectBlock: number,
    private projectId: string
  ) {
    super();

    this.provider = new HttpProvider(`https://${ethNet}.infura.io/v3/${this.projectId}`);
    this.eth = new Eth(this.provider);
  }

  public async run() {
    console.log('Block processor starting...');
    let currentBlock = this.startBlock;
    while (!this.cancelled) {
      try {
        const block = await this.eth.getBlock(currentBlock, true);
        const participants = block.transactions
          .filter(t => (t.to ? t.to.equals(this.signupAddress) : false))
          .map(t => t.from);
        this.emit('newParticipants', participants, currentBlock);
        if (currentBlock === this.selectBlock) {
          this.emit('selectParticipants', block.hash);
        }
        currentBlock += 1;
      } catch (err) {
        await new Promise<void>(resolve => setTimeout(resolve, 10000));
      }
    }
    console.log('Block processor complete.');
  }

  public stop() {
    this.cancelled = true;
  }
}
