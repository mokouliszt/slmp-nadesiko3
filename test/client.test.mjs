import test from 'node:test'
import assert from 'node:assert/strict'

import { SlmpClient, openAndConnect } from '../src/client.mjs'
import { MockPlc } from './mock-plc.mjs'

const D_CODE = 0x00A8
const M_CODE = 0x0090

async function withPlc (plcProfile, run) {
  const plc = new MockPlc()
  const port = await plc.listen()
  const client = await openAndConnect({ host: '127.0.0.1', port, plcProfile })
  try {
    await run(client, plc)
  } finally {
    await client.close()
    await plc.close()
  }
}

test('reads words over a 4E connection (iQ-R)', async () => {
  await withPlc('melsec:iq-r', async (client, plc) => {
    plc.setWord(D_CODE, 100, 1234)
    plc.setWord(D_CODE, 101, 0xFFFF)
    assert.deepEqual(await client.readWords('D100', 2), [1234, 0xFFFF])
    assert.equal(plc.lastRequest.is4e, true)
    assert.equal(plc.lastRequest.subcommand, 0x0002)
  })
})

test('reads words over a 3E connection (iQ-F)', async () => {
  await withPlc('melsec:iq-f', async (client, plc) => {
    plc.setWord(D_CODE, 0, 7)
    assert.deepEqual(await client.readWords('D0', 1), [7])
    assert.equal(plc.lastRequest.is4e, false)
    assert.equal(plc.lastRequest.subcommand, 0x0000)
  })
})

test('writes and reads back words, bits, dwords and floats', async () => {
  await withPlc('melsec:iq-r', async (client, plc) => {
    await client.writeWords('D200', [10, 20, 30])
    assert.deepEqual(await client.readWords('D200', 3), [10, 20, 30])

    await client.writeBits('M0', [true, false, true, true, false])
    assert.deepEqual(await client.readBits('M0', 5), [true, false, true, true, false])
    assert.equal(plc.getBit(M_CODE, 3), true)

    await client.writeDwords('D300', [4294967295, 1])
    assert.deepEqual(await client.readDwords('D300', 2), [4294967295, 1])

    await client.writeFloats('D400', [1.5, -2.25])
    assert.deepEqual(await client.readFloats('D400', 2), [1.5, -2.25])
  })
})

test('reads signed values', async () => {
  await withPlc('melsec:iq-r', async (client) => {
    await client.writeWords('D500', [0xFFFF])
    assert.equal(await client.readInt16('D500'), -1)
    await client.writeDwords('D502', [0xFFFFFFFF])
    assert.equal(await client.readInt32('D502'), -1)
  })
})

test('reads the CPU type name and runs a self test', async () => {
  await withPlc('melsec:iq-r', async (client) => {
    const info = await client.readTypeName()
    assert.equal(info.model, 'R08CPU')
    assert.equal(info.modelCode, 0x4806)
    assert.equal(await client.selfTest('ABCD'), 'ABCD')
  })
})

test('surfaces the end code of an abnormal response', async () => {
  await withPlc('melsec:iq-r', async (client) => {
    await assert.rejects(() => client.remoteReset(), (error) => {
      assert.equal(error.endCode, 0xC059)
      return true
    })
  })
})

test('serializes concurrent requests on one connection', async () => {
  await withPlc('melsec:iq-r', async (client, plc) => {
    plc.setWord(D_CODE, 0, 1)
    plc.setWord(D_CODE, 1, 2)
    plc.setWord(D_CODE, 2, 3)
    const results = await Promise.all([
      client.readWords('D0', 1),
      client.readWords('D1', 1),
      client.readWords('D2', 1)
    ])
    assert.deepEqual(results, [[1], [2], [3]])
    assert.equal(client.stats().requestCount, 3)
  })
})

test('rejects use after close and bad options', async () => {
  const client = new SlmpClient({ host: '127.0.0.1', port: 5007, plcProfile: 'melsec:iq-r' })
  await assert.rejects(() => client.readWords('D0', 1), /not connected/)
  assert.throws(() => new SlmpClient({ host: '127.0.0.1', plcProfile: 'melsec:iq-r' }), /port/)
  assert.throws(() => new SlmpClient({ host: '127.0.0.1', port: 5007 }), /plc_profile/)
  assert.throws(() => new SlmpClient({ host: '127.0.0.1', port: 5007, plcProfile: 'melsec:nope' }), /unknown plc_profile/)
})
