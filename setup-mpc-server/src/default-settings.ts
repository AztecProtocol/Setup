import moment = require('moment');

export const defaultSettings = () => ({
  startTime: moment().add(5, 's'),
  numG1Points: 1000000,
  numG2Points: 1,
  invalidateAfter: 180,
});
