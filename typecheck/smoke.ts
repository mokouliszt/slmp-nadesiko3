/**
 * Type-level smoke test. Not shipped (not listed in package.json "files"),
 * not executed — `tsc --noEmit` only needs it to compile under strict mode.
 * Run: npx tsc --noEmit
 */

import { SlmpClient, openAndConnect, normalizeOptions } from 'nadesiko3-slmp/client'
import type { SlmpClientOptions, ResolvedSlmpOptions, TrafficStats } from 'nadesiko3-slmp/client'
import {
  parseDevice,
  formatDevice,
  availableProfiles,
  resolveProfile,
  buildReadDevicesRequest,
  decodeReadDevicesResponse,
  packBitValues,
  unpackBitValues
} from 'nadesiko3-slmp/core'
import type { DeviceRef, ProfileInfo } from 'nadesiko3-slmp/core'
import {
  SlmpError,
  SlmpTimeoutError,
  SlmpTransportError,
  SlmpNotConnectedError,
  SlmpUnsupportedDeviceError,
  endCodeName,
  isRemotePasswordEndCode
} from 'nadesiko3-slmp/errors'

async function main (): Promise<void> {
  const options: SlmpClientOptions = {
    host: '192.168.3.39',
    port: 5007,
    plcProfile: 'melsec:iq-r',
    timeoutMs: 2000
  }
  const resolved: ResolvedSlmpOptions = normalizeOptions(options)
  console.log(resolved.frameType, resolved.series, resolved.target.station)

  const client: SlmpClient = new SlmpClient(options)
  await client.connect()

  const words: number[] = await client.readWords('D100', 10)
  await client.writeWords('D100', [1, 2, 3])

  const bits: boolean[] = await client.readBits('M0', 8)
  await client.writeBits('M0', [true, false, 1, 0])

  const dwords: number[] = await client.readDwords('D300', 2)
  await client.writeDwords('D300', [123456789])

  const floats: number[] = await client.readFloats('D400', 1)
  await client.writeFloats('D400', [36.5])

  const i16: number = await client.readInt16('D500')
  const i32: number = await client.readInt32('D502')

  const info = await client.readTypeName()
  console.log(info.model, info.modelCode)

  await client.remoteRun({ force: true, clearMode: 1 })
  await client.remoteStop()
  await client.remotePause()
  await client.remoteLatchClear()
  await client.clearError()
  const echoed: string = await client.selfTest('ABCD')

  const ref: DeviceRef = client.parseDevice('D100')
  const stats: TrafficStats = client.stats()
  const connected: boolean = client.connected

  await client.close()

  const opened: SlmpClient = await openAndConnect(options)
  await opened.close()

  console.log(words, bits, dwords, floats, i16, i32, echoed, ref, stats, connected)

  try {
    await client.readWords('D0', 1)
  } catch (error) {
    if (error instanceof SlmpTimeoutError) { console.log('timeout') }
    if (error instanceof SlmpTransportError) { console.log('transport') }
    if (error instanceof SlmpNotConnectedError) { console.log('not connected') }
    if (error instanceof SlmpUnsupportedDeviceError) { console.log('unsupported device') }
    if (error instanceof SlmpError) { console.log(error.endCode, endCodeName(error.endCode ?? 0)) }
  }

  const profiles: string[] = availableProfiles()
  const profile: ProfileInfo = resolveProfile('melsec:iq-r')
  const device: DeviceRef = parseDevice('D100', 'melsec:iq-r')
  const text: string = formatDevice(device, 'melsec:iq-r')
  const request = buildReadDevicesRequest('D100', 5, {
    bitUnit: false,
    series: profile.series,
    addressProfile: profile.addressProfile,
    plcProfile: profile.name
  })
  const packed: Buffer = packBitValues([true, false, 1, 0])
  const unpacked: boolean[] = unpackBitValues(packed, 4)
  console.log(profiles, profile, device, text, request, isRemotePasswordEndCode(0xC200), decodeReadDevicesResponse)
}

void main
