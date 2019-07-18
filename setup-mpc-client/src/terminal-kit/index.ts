import { Writable } from 'stream';
import chalkmod from 'chalk';

let options: any = { enabled: true, level: 2 };
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

  white(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.white(str));
    return this;
  }

  cyan(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.cyan(str));
    return this;
  }

  red(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.red(str));
    return this;
  }

  blue(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.blue(str));
    return this;
  }

  green(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.green(str));
    return this;
  }

  grey(str: string = '') {
    this.y = this.getNewYPos(str);
    this.stream.write(chalk.gray(str));
    return this;
  }

  clear() {
    this.moveTo(1, 1);
    this.stream.write('\u001B[2J');
  }

  eraseLine() {
    this.moveTo(0, this.y);
    this.stream.write('\u001B[0K');
  }

  moveTo(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.stream.write(`\u001B[${y};${x}H`);
  }

  nextLine(n: number) {
    this.moveTo(0, this.y + n);
  }

  eraseDisplayBelow() {
    this.stream.write('\u001B[0J');
  }

  hideCursor(hide: boolean = true) {
    if (hide) {
      this.stream.write('\u001B[?25l');
    } else {
      this.stream.write('\u001B[?25h');
    }
  }

  getCursorLocation(cb: any) {
    cb(null, this.x, this.y);
  }
}
