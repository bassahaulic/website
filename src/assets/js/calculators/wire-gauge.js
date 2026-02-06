/**
 * Wire Gauge Calculator
 *
 * Calculates recommended AWG wire gauge based on:
 * - Current draw (amps)
 * - Wire run length (feet, one-way)
 * - Acceptable voltage drop percentage
 *
 * Uses copper wire ampacity at 12V automotive.
 */
(function () {
  // AWG gauges with max ampacity and circular mil area for voltage drop calc
  // Sorted from thickest to thinnest
  const WIRE_TABLE = [
    { gauge: '0000 (4/0)', cmil: 211600, maxAmps: 400 },
    { gauge: '000 (3/0)',  cmil: 167800, maxAmps: 350 },
    { gauge: '00 (2/0)',   cmil: 133100, maxAmps: 300 },
    { gauge: '0 (1/0)',    cmil: 105500, maxAmps: 250 },
    { gauge: '1',          cmil: 83690,  maxAmps: 200 },
    { gauge: '2',          cmil: 66370,  maxAmps: 175 },
    { gauge: '4',          cmil: 41740,  maxAmps: 125 },
    { gauge: '6',          cmil: 26250,  maxAmps: 80 },
    { gauge: '8',          cmil: 16510,  maxAmps: 50 },
    { gauge: '10',         cmil: 10380,  maxAmps: 30 },
    { gauge: '12',         cmil: 6530,   maxAmps: 20 },
    { gauge: '14',         cmil: 4107,   maxAmps: 15 },
    { gauge: '16',         cmil: 2583,   maxAmps: 10 },
  ];

  const SYSTEM_VOLTAGE = 13.8; // Running voltage
  const COPPER_RESISTIVITY = 10.75; // ohms per cmil-foot for copper

  const form = document.getElementById('wire-gauge-form');
  const resultBox = document.getElementById('wire-result');
  const resultGauge = document.getElementById('result-gauge');
  const resultDetail = document.getElementById('result-detail');

  form.addEventListener('submit', function () {
    const amps = parseFloat(document.getElementById('amperage').value);
    const length = parseFloat(document.getElementById('wire-length').value);
    const maxDropPct = parseFloat(document.getElementById('voltage-drop').value);

    if (!amps || !length) return;

    const maxDropVolts = (maxDropPct / 100) * SYSTEM_VOLTAGE;
    // Required circular mils: (2 * length * resistivity * amps) / maxDropVolts
    const requiredCmil = (2 * length * COPPER_RESISTIVITY * amps) / maxDropVolts;

    // Find the smallest gauge that meets both cmil and ampacity requirements
    let recommended = null;
    for (let i = WIRE_TABLE.length - 1; i >= 0; i--) {
      const wire = WIRE_TABLE[i];
      if (wire.cmil >= requiredCmil && wire.maxAmps >= amps) {
        recommended = wire;
        break;
      }
    }

    resultBox.hidden = false;

    if (recommended) {
      const actualDrop = (2 * length * COPPER_RESISTIVITY * amps) / recommended.cmil;
      const actualPct = ((actualDrop / SYSTEM_VOLTAGE) * 100).toFixed(1);

      resultGauge.textContent = recommended.gauge + ' AWG';
      resultDetail.textContent =
        `For ${amps}A over ${length}ft with ${maxDropPct}% max drop. ` +
        `Actual voltage drop: ${actualDrop.toFixed(2)}V (${actualPct}%).`;
    } else {
      resultGauge.textContent = 'Multiple runs needed';
      resultDetail.textContent =
        `${amps}A over ${length}ft exceeds single-wire capacity. ` +
        'Consider parallel wire runs or shorter distances.';
    }
  });
})();
