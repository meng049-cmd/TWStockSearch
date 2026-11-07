const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('published data directory includes a valid daily industry flow snapshot', () => {
  const path = 'data/industry-flows.json';
  assert(fs.existsSync(path), 'Every Pages publishing route needs the committed industry snapshot');
  const snapshot = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert.equal(snapshot.version, 1);
  assert(snapshot.dates.length > 0);
  assert.equal(snapshot.latestDate, snapshot.dates.at(-1));
  assert(snapshot.sectors.length > 0);
  const dates = new Set(snapshot.dates);
  for (const sector of snapshot.sectors) {
    assert(sector.code && sector.name && sector.stockCount > 0);
    assert(sector.rows.length > 0);
    let previous = '';
    for (const row of sector.rows) {
      assert(dates.has(row.date) && row.date > previous);
      previous = row.date;
      assert(row.sampleCount > 0);
      assert(Number.isInteger(row.financingBalanceCount));
      if(row.financingBalanceCount === 0) assert.equal(row.financingBalance, null);
      else assert(Number.isFinite(row.financingBalance));
      for (const key of ['foreign', 'trust', 'dealer', 'financing']) {
        const count = row[key + 'Count'];
        assert(Number.isInteger(count) && count >= 0 && count <= row.sampleCount);
        if (count === 0) assert.equal(row[key], null);
        else assert(Number.isFinite(row[key]));
        const amountCount = row[key + 'AmountCount'];
        assert(Number.isInteger(amountCount) && amountCount >= 0 && amountCount <= row.sampleCount);
        if (amountCount === 0) assert.equal(row[key + 'Amount'], null);
        else assert(Number.isFinite(row[key + 'Amount']));
      }
    }
  }
});
