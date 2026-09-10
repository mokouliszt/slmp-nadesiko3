# nadesiko3-slmp

**English** | [日本語](README.ja.md)

An SLMP plugin for [nadesiko3](https://nadesi.com/), the Japanese-language programming language. It talks to MITSUBISHI ELECTRIC MELSEC programmable controllers over SLMP binary 3E/4E frames, so a PLC can be read and written directly from nadesiko code.

Ported from [plc-comm-slmp-python](https://github.com/fa-yoshinobu/plc-comm-slmp-python) by fa-yoshinobu (MIT).

```nako3
!「nadesiko3-slmp」を取り込む。
設定は{"ホスト":"192.168.3.39","ポート":5007,"機種":"melsec:iq-r"}
接続は、設定でSLMP接続。
値は、接続から「D100」を10だけSLMPワード読。
値を表示。
接続で[100,200,300]を「D100」にSLMPワード書。
接続をSLMP切断。
```

## Features

- **SLMP binary 3E and 4E frames** over TCP or UDP. The frame type is chosen from the PLC profile, and TCP streams are reassembled by the declared response length
- **14 PLC profiles** (iQ-R, iQ-F, iQ-L, MX-R/F, Q, L, QnU, QnUDV, and Ethernet module variants). Selecting a profile sets the frame type, the subcommand series, the device number radix, and the per-request point limits
- **41 device codes** with correct radix handling — `D`/`M` decimal, `X`/`Y`/`W`/`B` hexadecimal, and `X`/`Y` octal on iQ-F. Devices a profile does not support are rejected before a frame is sent
- **Typed access**: 16-bit words, bits, unsigned/signed 32-bit values, and IEEE 754 single-precision floats
- **CPU operations**: read type name, remote RUN / STOP / PAUSE / RESET, clear error, and the loopback self test
- **Requests are serialized per connection**, so concurrent nadesiko calls on one handle cannot interleave frames
- No native dependencies. Node.js standard library only

## Requirements

- Node.js 18 or later
- nadesiko3 3.6.0 or later, run through `cnako3`

The plugin needs raw TCP/UDP sockets, so it runs on **cnako (Node.js) only**. It cannot run in a browser (wnako).

## Install

```bash
npm install nadesiko3-slmp
```

Then import it by package name:

```nako3
!「nadesiko3-slmp」を取り込む。
```

## Using it from TypeScript / Node.js directly

The nadesiko commands are a thin wrapper over a plain async client, exported separately with full type declarations:

```ts
import { SlmpClient } from 'nadesiko3-slmp/client'

const client = new SlmpClient({ host: '192.168.3.39', port: 5007, plcProfile: 'melsec:iq-r' })
await client.connect()
const values = await client.readWords('D100', 10)
await client.writeWords('D100', [100, 200, 300])
await client.close()
```

Low-level frame/device builders (for requests the client doesn't wrap yet) are at `nadesiko3-slmp/core`, and the error classes for `instanceof` checks (`SlmpTimeoutError`, `SlmpTransportError`, `SlmpNotConnectedError`, `SlmpUnsupportedDeviceError`, ...) are at `nadesiko3-slmp/errors`. All three subpaths ship `.d.mts` declarations, so no `@types` package is needed — only `"moduleResolution": "bundler"`, `"node16"`, or `"nodenext"` in your `tsconfig.json` (the classic `"node"` resolution predates package subpath `exports` and won't see them). The root import (`nadesiko3-slmp`, no subpath) is the nadesiko plugin object and is intentionally untyped — it's a dictionary-driven API meant for `!「nadesiko3-slmp」を取り込む。`, not for `import` from TypeScript.

## Connection settings

`SLMP接続` takes a dictionary. Japanese and English keys are both accepted.

| Key | Alias | Default | Meaning |
| --- | --- | --- | --- |
| `ホスト` | `host` | (required) | PLC IP address or host name |
| `ポート` | `port` | (required) | SLMP port, commonly 5007 |
| `機種` | `plcProfile` | (required) | PLC profile, e.g. `melsec:iq-r` |
| `通信` | `transport` | `tcp` | `tcp` or `udp` |
| `タイムアウト` | `timeoutMs` | `3000` | Response timeout in milliseconds |
| `監視タイマ` | `monitoringTimer` | `4` | SLMP monitoring timer, in 250 ms units |
| `ネットワーク番号` | `network` | `0x00` | Request destination network number |
| `局番` | `station` | `0xFF` | Request destination station number |
| `ユニット番号` | `moduleIo` | `0x03FF` | Request destination module I/O number |
| `マルチドロップ` | `multidrop` | `0x00` | Multidrop station number |

Available profiles are listed in the constant `SLMP機種一覧`:

```
melsec:iq-f, melsec:iq-r, melsec:iq-r:rj71en71, melsec:iq-l,
melsec:mx-f, melsec:mx-r, melsec:mx-r:rj71en71,
melsec:qcpu:qj71e71-100, melsec:lcpu, melsec:lcpu:lj71e71-100,
melsec:qnu, melsec:qnu:qj71e71-100, melsec:qnudv, melsec:qnudv:qj71e71-100
```

## Commands

Reads take the connection with `から`, the device with `を`, and the point count with `だけ`. Writes take the connection with `で`, the values with `を`, and the destination device with `に`.

### Connection

| Command | Example |
| --- | --- |
| `SLMP接続` | `接続は、設定でSLMP接続` |
| `SLMP切断` | `接続をSLMP切断` |
| `SLMP接続中` | `もし、接続がSLMP接続中ならば` |

### Reading

| Command | Returns | Example |
| --- | --- | --- |
| `SLMPワード読` | array of 16-bit values | `接続から「D100」を10だけSLMPワード読` |
| `SLMPビット読` | array of on/off | `接続から「M0」を8だけSLMPビット読` |
| `SLMPダブルワード読` | array of unsigned 32-bit | `接続から「D300」を2だけSLMPダブルワード読` |
| `SLMP実数読` | array of floats | `接続から「D400」を1だけSLMP実数読` |
| `SLMP整数読` | one signed 16-bit value | `接続から「D500」をSLMP整数読` |
| `SLMP倍長整数読` | one signed 32-bit value | `接続から「D502」をSLMP倍長整数読` |

### Writing

| Command | Example |
| --- | --- |
| `SLMPワード書` | `接続で[100,200]を「D100」にSLMPワード書` |
| `SLMPビット書` | `接続で[オン,オフ]を「M0」にSLMPビット書` |
| `SLMPダブルワード書` | `接続で[123456]を「D300」にSLMPダブルワード書` |
| `SLMP実数書` | `接続で[36.5]を「D400」にSLMP実数書` |

### CPU operations and helpers

| Command | Description |
| --- | --- |
| `SLMP形名取得` | Reads the CPU model name and model code |
| `SLMPリモートRUN` / `SLMPリモートSTOP` / `SLMPリモートPAUSE` | Remote control |
| `SLMPリモートRESET` | Remote reset (the CPU drops the connection, so reconnect afterwards) |
| `SLMPエラークリア` | Clears the CPU error |
| `SLMP自己診断` | Loopback test; the payload must be ASCII `0-9` / `A-F` |
| `SLMPデバイス確認` | Validates a device string without communicating |
| `SLMP機種情報取得` | Returns the frame type and series of a profile |
| `SLMP統計取得` | Lifetime request count and byte counters |

## Testing without hardware

[VirtualMelsecR](https://github.com/mokouliszt/VirtualMelsecR) is a virtual MELSEC iQ-R that speaks SLMP 3E/4E on localhost. Every example in this repository was verified against it.

```bash
python -m virtualmelsecr --host 127.0.0.1 --port 5007
cnako3 examples/read.nako3
```

VirtualMelsecR implements batch read/write, random access, remote RUN and read type name. Commands it does not implement — the self test, for instance — come back as end code `C059`, which the plugin surfaces as an error carrying that code.

The unit tests need no PLC at all — an in-process mock server is included.

```bash
npm test
```

## Scope

Implemented: Device Read (0x0401), Device Write (0x1401), Read Type Name (0x0101), remote control (0x1001-0x1006), Clear Error (0x1617), and Self Test (0x0619).

Not implemented yet: random access (0x0403 / 0x1402), block access (0x0406 / 0x1406), monitor registration (0x0801 / 0x0802), label access, and extended device specification. The underlying command and subcommand tables are already in place, so these are additive.

## License

MIT. See [LICENSE](LICENSE).

This project is a port of [plc-comm-slmp-python](https://github.com/fa-yoshinobu/plc-comm-slmp-python) (MIT, Copyright (c) 2026 fa-yoshinobu). The original copyright notice is retained in `LICENSE`.

MELSEC and SLMP are trademarks of Mitsubishi Electric Corporation. This project is not affiliated with or endorsed by Mitsubishi Electric.
