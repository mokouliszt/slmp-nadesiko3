import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReadDevicesRequest,
  buildWriteDevicesRequest,
  decodeResponse,
  encodeRequest,
  formatDevice,
  packBitValues,
  parseDevice,
  unpackBitValues
} from '../src/core.mjs'

test('parseDevice uses the radix of the device code', () => {
  assert.deepEqual(parseDevice('D100', 'melsec:iq-r').number, 100)
  assert.equal(parseDevice('X1F', 'melsec:iq-r').number, 0x1F)
  assert.equal(parseDevice('W1A0', 'melsec:iq-r').number, 0x1A0)
  assert.equal(parseDevice('m8', 'melsec:iq-r').code, 'M')
})

test('parseDevice treats X/Y as octal on iQ-F', () => {
  assert.equal(parseDevice('X20', 'melsec:iq-f').number, 16)
  assert.throws(() => parseDevice('X18', 'melsec:iq-f'), /octal/)
  assert.equal(formatDevice(parseDevice('X20', 'melsec:iq-f'), 'melsec:iq-f'), 'X20')
})

test('parseDevice rejects unsupported devices per profile', () => {
  assert.throws(() => parseDevice('ZR0', 'melsec:iq-f'), /not supported/)
  assert.throws(() => parseDevice('LTN0', 'melsec:qnu'), /not supported/)
  assert.throws(() => parseDevice('D10A', 'melsec:iq-r'), /decimal/)
  assert.throws(() => parseDevice('QQ1', 'melsec:iq-r'), /Unknown SLMP device code/)
  assert.throws(() => parseDevice('D', 'melsec:iq-r'), /Invalid SLMP device string/)
})

test('parseDevice rejects the abstract qcpu base profile', () => {
  assert.throws(() => parseDevice('D0', 'melsec:qcpu'), /base profile/)
})

test('3E read request matches the documented byte layout', () => {
  const request = buildReadDevicesRequest('D100', 5, {
    bitUnit: false, series: 'ql', addressProfile: 'melsec:qnu', plcProfile: 'melsec:qnu'
  })
  const frame = encodeRequest({
    frameType: '3e',
    serial: 0,
    target: { network: 0x00, station: 0xFF, moduleIo: 0x03FF, multidrop: 0x00 },
    monitoringTimer: 4,
    command: request.command,
    subcommand: request.subcommand,
    data: request.data
  })
  assert.equal(frame.toString('hex').toUpperCase(),
    '5000' + '00FF' + 'FF03' + '00' + '0C00' + '0400' + '0104' + '0000' + '640000A8' + '0500')
})

test('4E read request carries the serial number and iQ-R device spec', () => {
  const request = buildReadDevicesRequest('D100', 5, {
    bitUnit: false, series: 'iqr', addressProfile: 'melsec:iq-r', plcProfile: 'melsec:iq-r'
  })
  const frame = encodeRequest({
    frameType: '4e',
    serial: 1,
    target: { network: 0x00, station: 0xFF, moduleIo: 0x03FF, multidrop: 0x00 },
    monitoringTimer: 4,
    command: request.command,
    subcommand: request.subcommand,
    data: request.data
  })
  assert.equal(frame.toString('hex').toUpperCase(),
    '5400' + '0100' + '0000' + '00FF' + 'FF03' + '00' + '0E00' + '0400' + '0104' + '0200' + '64000000A800' + '0500')
})

test('bit write packs two points per byte, high nibble first', () => {
  assert.equal(packBitValues([true, false, true]).toString('hex'), '1010')
  assert.deepEqual(unpackBitValues(Buffer.from([0x10, 0x10]), 3), [true, false, true])
  assert.throws(() => unpackBitValues(Buffer.from([0x20]), 1), /non-binary/)
})

test('write request rejects out-of-range values and read-only devices', () => {
  const options = { bitUnit: false, series: 'iqr', addressProfile: 'melsec:iq-r', plcProfile: 'melsec:iq-r' }
  assert.throws(() => buildWriteDevicesRequest('D0', [70000], options), /range/)
  assert.throws(() => buildWriteDevicesRequest('S0', [1], { ...options, bitUnit: true }), /read-only/)
  assert.throws(() => buildWriteDevicesRequest('D0', [1], { ...options, bitUnit: true }), /word device/)
})

test('point limits follow the profile', () => {
  const iqr = { bitUnit: true, series: 'iqr', addressProfile: 'melsec:iq-r', plcProfile: 'melsec:iq-r' }
  assert.doesNotThrow(() => buildReadDevicesRequest('M0', 7168, iqr))
  assert.throws(() => buildReadDevicesRequest('M0', 7169, iqr), /out of range/)
  const iqf = { bitUnit: true, series: 'ql', addressProfile: 'melsec:iq-f', plcProfile: 'melsec:iq-f' }
  assert.throws(() => buildReadDevicesRequest('M0', 3585, iqf), /out of range/)
})

test('decodeResponse validates the declared length and reports end codes', () => {
  const ok = Buffer.from('D00000FFFF03000600000064000000', 'hex')
  const response = decodeResponse(ok, '3e')
  assert.equal(response.endCode, 0)
  assert.deepEqual([...response.data], [0x64, 0x00, 0x00, 0x00])

  const truncated = Buffer.from('D00000FFFF0300060000006400', 'hex')
  assert.throws(() => decodeResponse(truncated, '3e'), /size mismatch/)

  const failed = Buffer.from('D00000FFFF0300020059C0', 'hex')
  assert.equal(decodeResponse(failed, '3e').endCode, 0xC059)
})
