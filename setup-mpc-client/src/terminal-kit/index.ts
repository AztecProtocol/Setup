import chalkmod from 'chalk';
import { Writable } from 'stream';

const options: any = { enabled: true, level: 2 };
const chalk = new chalkmod.constructor(options);

export class TerminalKit {
  private x: number = 1;
  private y: number = 1;

  constructor(private stream: Writable, public height: number, public width: number) {
    this.clear();
  }

  private getNewYPos(str: string) {
    let xPos = this.x;
    let yPos = this.y;
    for (const char of str) {
      if (char === '\n' || xPos === this.width) {
        xPos = 0;
        yPos += 1;
      } else {
        xPos += 1;
      }
    }
    return yPos;
  }

  public white(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.white(str));
    return this;
  }

  public yellow(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.yellow(str));
    return this;
  }

  public cyan(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.cyan(str));
    return this;
  }

  public red(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.red(str));
    return this;
  }

  public redBright(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.redBright(str));
    return this;
  }

  public blue(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.blue(str));
    return this;
  }

  public green(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.green(str));
    return this;
  }

  public magentaBright(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.magentaBright(str));
    return this;
  }

  public yellowBright(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.yellowBright(str));
    return this;
  }

  public grey(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.gray(str));
    return this;
  }

  public clear() {
    this.moveTo(1, 1);
    this.stream.write('\u001B[2J');
    this.stream.write('\u001B[3J');
  }

  public eraseLine() {
    this.moveTo(0, this.y);
    this.stream.write('\u001B[0K');
  }

  public moveTo(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.stream.write(`\u001B[${y};${x}H`);
  }

  public nextLine(n: number) {
    this.moveTo(0, this.y + n);
  }

  public eraseDisplayBelow() {
    this.stream.write('\u001B[0J');
  }

  public hideCursor(hide: boolean = true) {
    if (hide) {
      this.stream.write('\u001B[?25l');
    } else {
      this.stream.write('\u001B[?25h');
    }
  }

  public getCursorLocation(cb: any) {
    cb(null, this.x, this.y);
  }
}
