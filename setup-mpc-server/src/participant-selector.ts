import { EventEmitter } from 'events';
import { MemoryFifo } from 'setup-mpc-common';
import { Address } from 'web3x/address';
import { Eth } from 'web3x/eth';
import { BlockHeaderResponse } from 'web3x/formatters';
import { WebsocketProvider } from 'web3x/providers';
import { Subscription } from 'web3x/subscriptions';

export type EthNet = 'mainnet' | 'ropsten';

export class ParticipantSelector extends EventEmitter {
  private provider: WebsocketProvider;
  private eth: Eth;
  private newBlockSub?: Subscription<BlockHeaderResponse>;
  private startBlock!: number;
  private selectBlock!: number;
  private queue = new MemoryFifo<number>();

  constructor(ethNet: EthNet, private signupAddress: Address) {
    super();
    this.provider = new WebsocketProvider(`wss://${ethNet}.infura.io/ws`);
    this.eth = new Eth(this.provider);
  }

  public async restart(startBlock?: number, selectBlock?: number) {
    this.queue.cancel();
    this.queue = new MemoryFifo<number>();

    if (startBlock !== undefined) {
      this.startBlock = startBlock;
      let n = startBlock;
      try {
        let block = await this.eth.getBlock(n, true);
        while (block) {
          this.emit('newParticipants', await this.getBlockParticipants(block.number!), block.number!);
          block = await this.eth.getBlock(++n, true);
        }
      } catch (err) {
        // Swallow bug in web3x when requesting block that doesn't exist.
      }
    } else {
      this.startBlock = (await this.eth.getBlock('latest')).number!;
    }

    this.selectBlock = selectBlock === undefined ? this.startBlock + 1 : selectBlock;

    this.newBlockSub = this.eth.subscribe('newBlockHeaders').on('data', args => this.queue.put(args.number));

    this.processQueue();
  }

  private async processQueue() {
    console.error('Block processor starting...');
    while (true) {
      const blockNumber = await this.queue.get();
      if (blockNumber === null) {
        break;
      }
      while (true) {
        try {
          const participants = await this.getBlockParticipants(blockNumber);
          this.emit('newParticipants', participants, blockNumber);
          if (blockNumber === this.selectBlock) {
            this.emit('selectParticipants');
          }
          break;
        } catch (err) {
          await new Promise<void>(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    console.error('Block processor complete.');
  }

  private async getBlockParticipants(blockNumber: number) {
    const block = await this.eth.getBlock(blockNumber, true);
    return block.transactions.filter(t => (t.to ? t.to.equals(this.signupAddress) : false)).map(t => t.from);
  }

  public async getCurrentBlockHeight() {
    return await this.eth.getBlockNumber();
  }

  public stop() {
    if (this.newBlockSub) {
      this.newBlockSub.removeAllListeners();
    }
  }
}
