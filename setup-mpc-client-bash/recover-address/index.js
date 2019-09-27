const { recover } = require('web3x/utils');

try {
  console.log(
    recover(process.argv[2], process.argv[3])
      .toString()
      .toLowerCase()
  );
} catch (err) {
  console.log('Failed to recover address.');
  process.exit(1);
}
