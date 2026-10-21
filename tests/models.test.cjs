const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modelFile = path.join(__dirname, '..', 'workbench-models.js');
// These hand-calculated fixtures catch incorrect protocol and timing rules.
test('teaching models are available for protocol experiments', () => {
  assert.ok(fs.existsSync(modelFile), 'The executable experiment models have not been implemented');
});
if (fs.existsSync(modelFile)) {
  const m = require(modelFile);
  test('AXI source holds its payload through backpressure and counts accepted beats', () => {
    const r = m.stream({cycles:12, packet:8, stallStart:2, stallLength:3});
    assert.deepEqual(r.accepted, [0,1,2,3,4,5,6,7]);
    assert.deepEqual(r.rows.slice(2,5).map(x=>x.data), [2,2,2]);
    assert.equal(r.rows.filter(x=>x.fire && x.last).length, 1);
    assert.equal(r.violations, 0);
  });
  test('an AXI source advancing during a stall loses data', () => {
    const r = m.stream({cycles:12, packet:8, stallStart:2, stallLength:3, broken:true});
    assert.deepEqual(r.accepted, [0,1,5,6,7]);
    assert.ok(r.violations > 0);
  });
  test('AXI Lite accepts address and data on independent cycles', () => {
    assert.equal(m.lite({addressAt:1,dataAt:4}).writes, 1);
    assert.equal(m.lite({addressAt:4,dataAt:1}).writes, 1);
    assert.equal(m.lite({addressAt:1,dataAt:4,broken:true}).writes, 0);
  });
  test('setup slack includes routing, uncertainty and capture skew', () => {
    const r = m.timing({freqMHz:100,clockToQ:0.5,logic:7,route:1,setup:0.5,uncertainty:0.2,skew:0});
    assert.ok(Math.abs(r.slack-0.8)<1e-9);
    assert.equal(m.timing({freqMHz:200,clockToQ:0.5,logic:7,route:1,setup:0.5,uncertainty:0.2,skew:0}).pass,false);
  });
  test('debouncer needs three consecutive samples, not three arbitrary highs', () => {
    const r = m.debounce({samples:[0,1,0,1,1,0,1,1,1,1,0,0,0],threshold:3});
    assert.deepEqual(r.rows.map(x=>x.output),[0,0,0,0,0,0,0,0,1,1,1,1,0]);
    assert.equal(r.rises,1);
  });
  test('FIFO conserves accepted data and detects overflow without backpressure', () => {
    const r = m.fifo({cycles:8,depth:2,produceEvery:1,consumeEvery:1,pauseStart:0,pauseLength:5,backpressure:true});
    assert.equal(r.dropped,0);
    assert.deepEqual(r.received,[0,1,2]);
    assert.equal(r.accepted,r.received.length+r.remaining.length);
    assert.ok(m.fifo({cycles:8,depth:2,produceEvery:1,consumeEvery:1,pauseStart:0,pauseLength:5,backpressure:false}).dropped>0);
  });
  test('noncoherent DMA needs a clean before device reads and invalidation before CPU reads', () => {
    assert.equal(m.cache(['cpuWrite','dmaRead']).deviceRead,0);
    assert.equal(m.cache(['cpuWrite','clean','dmaRead']).deviceRead,42);
    assert.equal(m.cache(['cpuRead','dmaWrite','cpuRead']).cpuRead,0);
    assert.equal(m.cache(['cpuRead','dmaWrite','invalidate','cpuRead']).cpuRead,99);
    assert.equal(m.cache(['cpuWrite','invalidate']).lostDirty,true);
  });
  test('PLC output changes after the next input-image sampling and logic phase', () => {
    const r=m.plc({inputAt:1,scanMs:10,computeMs:3,networkMs:2});
    assert.equal(r.sampleAt,10);assert.equal(r.outputAt,13);assert.equal(r.visibleAt,15);assert.equal(r.latency,12);
  });
  test('100 microseconds cannot be represented by a 1 kHz RTOS tick', () => {
    assert.equal(m.periodic({tickHz:1000,periodUs:100,execUs:20,method:'until'}).supported,false);
    assert.deepEqual(m.periodic({tickHz:1000,periodUs:2000,execUs:500,method:'delay',iterations:3}).starts,[0,2500,5000]);
    assert.deepEqual(m.periodic({tickHz:1000,periodUs:2000,execUs:500,method:'until',iterations:3}).starts,[0,2000,4000]);
  });
  test('bandwidth and buffer budget use bits, bytes and binary buffer sizes consistently', () => {
    const r=m.bandwidth({channels:8,rateKsps:100,bits:16,busBits:64,clockMHz:100,efficiency:75,bufferKiB:64,hostPauseMs:50});
    assert.equal(r.inputMBs,1.6);assert.equal(r.capacityMBs,600);assert.equal(r.backlogBytes,80000);assert.equal(r.fits,false);
  });
  test('priority inheritance prevents medium priority work extending a lock wait', () => {
    assert.equal(m.inversion({inherit:false}).response,6);
    assert.equal(m.inversion({inherit:true}).response,3);
  });
  test('Modbus RTU CRC uses the standard polynomial and low byte first', () => {
    assert.equal(m.crc16([1,3,0,0,0,10]),0xCDC5);
    assert.deepEqual(m.modbus({unit:1,address:0,count:10}).bytes,[1,3,0,0,0,10,0xC5,0xCD]);
  });
  test('boot parallelism changes critical path without summing overlapping services', () => {
    assert.equal(m.boot({rom:1,loader:2,kernel:3,network:4,app:5,parallel:false}).total,15);
    assert.equal(m.boot({rom:1,loader:2,kernel:3,network:4,app:5,parallel:true}).total,11);
  });
}
