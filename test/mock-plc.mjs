/**
 * Minimal in-process SLMP server for tests.
 * Implements Device Read/Write (0x0401/0x1401), Read Type Name (0x0101)
 * and Self Test (0x0619) over TCP for both 3E and 4E frames.
 *
 * For hardware-like verification use VirtualMelsecR instead; this mock only
 * exists so `npm test` runs with no PLC and no network.
 */

import net from 'node:net'

const SUB_3E_REQ = 0x0050
const SUB_4E_REQ = 0x0054

export class MockPlc {
  constructor () {
    this.words = new Map() // key: `${deviceCode}:${number}` -> uint16
    this.bits = new Map()
    this.server = null
    this.port = 0
    this.typeName = 'R08CPU'
    this.typeCode = 0x4806
    this.lastRequest = null
  }

  key (code, number) { return `${code}:${number}` }

  setWord (code, number, value) { this.words.set(this.key(code, number), value & 0xFFFF) }
  getWord (code, number) { return this.words.get(this.key(code, number)) ?? 0 }
  setBit (code, number, value) { this.bits.set(this.key(code, number), !!value) }
  getBit (code, number) { return this.bits.get(this.key(code, number)) ?? false }

  listen () {
    return new Promise((resolve) => {
      this.server = net.createServer((socket) => {
        let buffer = Buffer.alloc(0)
        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk])
          for (;;) {
            const frame = this._takeFrame(buffer)
            if (!frame) { break }
            buffer = buffer.subarray(frame.length)
            const response = this._handle(frame)
            if (response) { socket.write(response) }
          }
        })
        socket.on('error', () => {})
      })
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port
        resolve(this.port)
      })
    })
  }

  close () {
    return new Promise((resolve) => {
      if (!this.server) { resolve(); return }
      this.server.close(() => resolve())
    })
  }

  _takeFrame (buffer) {
    if (buffer.length < 2) { return null }
    const sub = buffer.readUInt16LE(0)
    if (sub === SUB_3E_REQ) {
      if (buffer.length < 9) { return null }
      const total = 9 + buffer.readUInt16LE(7)
      return buffer.length >= total ? buffer.subarray(0, total) : null
    }
    if (sub === SUB_4E_REQ) {
      if (buffer.length < 13) { return null }
      const total = 13 + buffer.readUInt16LE(11)
      return buffer.length >= total ? buffer.subarray(0, total) : null
    }
    throw new Error(`mock: unknown subheader 0x${sub.toString(16)}`)
  }

  _handle (frame) {
    const is4e = frame.readUInt16LE(0) === SUB_4E_REQ
    const base = is4e ? 6 : 2 // index of the network number
    const serial = is4e ? frame.readUInt16LE(2) : 0
    const target = {
      network: frame[base],
      station: frame[base + 1],
      moduleIo: frame.readUInt16LE(base + 2),
      multidrop: frame[base + 4]
    }
    const command = frame.readUInt16LE(base + 9)
    const subcommand = frame.readUInt16LE(base + 11)
    const payload = frame.subarray(base + 13)
    this.lastRequest = { is4e, serial, target, command, subcommand, payload: Buffer.from(payload) }

    let endCode = 0
    let data = Buffer.alloc(0)
    try {
      data = this._dispatch(command, subcommand, payload)
    } catch (error) {
      endCode = error.endCode ?? 0xC059
      data = Buffer.alloc(0)
    }
    return this._encodeResponse({ is4e, serial, target, endCode, data })
  }

  _decodeDeviceSpec (payload, series) {
    if (series === 'ql') {
      return { number: payload.readUIntLE(0, 3), code: payload.readUInt8(3), size: 4 }
    }
    return { number: payload.readUInt32LE(0), code: payload.readUInt16LE(4), size: 6 }
  }

  _dispatch (command, subcommand, payload) {
    const bitUnit = (subcommand & 0x0001) === 0x0001
    const series = (subcommand & 0x0002) === 0x0002 ? 'iqr' : 'ql'

    if (command === 0x0401) {
      const spec = this._decodeDeviceSpec(payload, series)
      const points = payload.readUInt16LE(spec.size)
      if (bitUnit) {
        const out = Buffer.alloc(Math.ceil(points / 2))
        for (let i = 0; i < points; i += 2) {
          const hi = this.getBit(spec.code, spec.number + i) ? 1 : 0
          const lo = (i + 1 < points && this.getBit(spec.code, spec.number + i + 1)) ? 1 : 0
          out[i / 2] = (hi << 4) | lo
        }
        return out
      }
      const out = Buffer.alloc(points * 2)
      for (let i = 0; i < points; i += 1) { out.writeUInt16LE(this.getWord(spec.code, spec.number + i), i * 2) }
      return out
    }

    if (command === 0x1401) {
      const spec = this._decodeDeviceSpec(payload, series)
      const points = payload.readUInt16LE(spec.size)
      const body = payload.subarray(spec.size + 2)
      if (bitUnit) {
        for (let i = 0; i < points; i += 1) {
          const byte = body[Math.floor(i / 2)]
          const value = i % 2 === 0 ? (byte >> 4) & 0x0F : byte & 0x0F
          this.setBit(spec.code, spec.number + i, value === 1)
        }
      } else {
        for (let i = 0; i < points; i += 1) { this.setWord(spec.code, spec.number + i, body.readUInt16LE(i * 2)) }
      }
      return Buffer.alloc(0)
    }

    if (command === 0x0101) {
      const out = Buffer.alloc(18)
      out.write(this.typeName.padEnd(16, '\u0000'), 0, 'ascii')
      out.writeUInt16LE(this.typeCode, 16)
      return out
    }

    if (command === 0x0619) {
      const length = payload.readUInt16LE(0)
      const body = payload.subarray(2, 2 + length)
      const out = Buffer.alloc(2 + body.length)
      out.writeUInt16LE(body.length, 0)
      body.copy(out, 2)
      return out
    }

    if ([0x1001, 0x1002, 0x1003, 0x1005, 0x1617].includes(command)) { return Buffer.alloc(0) }

    const error = new Error(`unsupported command 0x${command.toString(16)}`)
    error.endCode = 0xC059
    throw error
  }

  _encodeResponse ({ is4e, serial, target, endCode, data }) {
    const headSize = is4e ? 15 : 11
    const out = Buffer.alloc(headSize + data.length)
    let pos = 0
    out.writeUInt16LE(is4e ? 0x00D4 : 0x00D0, pos); pos += 2
    if (is4e) {
      out.writeUInt16LE(serial, pos); pos += 2
      out.writeUInt16LE(0x0000, pos); pos += 2
    }
    out.writeUInt8(target.network, pos); pos += 1
    out.writeUInt8(target.station, pos); pos += 1
    out.writeUInt16LE(target.moduleIo, pos); pos += 2
    out.writeUInt8(target.multidrop, pos); pos += 1
    out.writeUInt16LE(2 + data.length, pos); pos += 2
    out.writeUInt16LE(endCode, pos); pos += 2
    data.copy(out, pos)
    return out
  }
}
