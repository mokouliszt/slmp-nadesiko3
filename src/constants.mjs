/**
 * SLMP binary 3E/4E constants.
 * Ported from plc-comm-slmp-python (slmp/constants.py, slmp/core.py,
 * slmp/capability_profiles.py). Values follow SLMP specification SH080956ENG.
 */

export const FRAME_3E_REQUEST_SUBHEADER = Buffer.from([0x50, 0x00])
export const FRAME_3E_RESPONSE_SUBHEADER = Buffer.from([0xD0, 0x00])
export const FRAME_4E_REQUEST_SUBHEADER = Buffer.from([0x54, 0x00])
export const FRAME_4E_RESPONSE_SUBHEADER = Buffer.from([0xD4, 0x00])

/** Frame type. */
export const FRAME_3E = '3e'
export const FRAME_4E = '4e'

/** Series option for subcommand / device-spec width compatibility. */
export const SERIES_QL = 'ql' // MELSEC-Q/L compatible (subcommand 0000/0001)
export const SERIES_IQR = 'iqr' // MELSEC iQ-R / iQ-L (subcommand 0002/0003)

/** Device-clear policy for remote RUN. */
export const REMOTE_CLEAR_NO_CLEAR = 0
export const REMOTE_CLEAR_EXCEPT_LATCH = 1
export const REMOTE_CLEAR_ALL = 2

/** Request destination module I/O numbers (SH080956ENG 4.2). */
export const MODULE_IO = {
  CONTROL_SYSTEM_CPU: 0x03D0,
  STANDBY_SYSTEM_CPU: 0x03D1,
  SYSTEM_A_CPU: 0x03D2,
  SYSTEM_B_CPU: 0x03D3,
  MULTIPLE_CPU_1: 0x03E0,
  MULTIPLE_CPU_2: 0x03E1,
  MULTIPLE_CPU_3: 0x03E2,
  MULTIPLE_CPU_4: 0x03E3,
  OWN_STATION: 0x03FF,
  REMOTE_HEAD_1: 0x03E0,
  REMOTE_HEAD_2: 0x03E1,
  CONTROL_SYSTEM_REMOTE_HEAD: 0x03D0,
  STANDBY_SYSTEM_REMOTE_HEAD: 0x03D1
}

/** Command list (SH080956ENG 5.1). */
export const COMMAND = {
  DEVICE_READ: 0x0401,
  DEVICE_WRITE: 0x1401,
  DEVICE_READ_RANDOM: 0x0403,
  DEVICE_WRITE_RANDOM: 0x1402,
  DEVICE_ENTRY_MONITOR: 0x0801,
  DEVICE_EXECUTE_MONITOR: 0x0802,
  DEVICE_READ_BLOCK: 0x0406,
  DEVICE_WRITE_BLOCK: 0x1406,
  MEMORY_READ: 0x0613,
  MEMORY_WRITE: 0x1613,
  EXTEND_UNIT_READ: 0x0601,
  EXTEND_UNIT_WRITE: 0x1601,
  REMOTE_RUN: 0x1001,
  REMOTE_STOP: 0x1002,
  REMOTE_PAUSE: 0x1003,
  REMOTE_LATCH_CLEAR: 0x1005,
  REMOTE_RESET: 0x1006,
  READ_TYPE_NAME: 0x0101,
  REMOTE_PASSWORD_LOCK: 0x1631,
  REMOTE_PASSWORD_UNLOCK: 0x1630,
  SELF_TEST: 0x0619,
  CLEAR_ERROR: 0x1617
}

export const SUBCOMMAND_DEVICE_WORD_QL = 0x0000
export const SUBCOMMAND_DEVICE_BIT_QL = 0x0001
export const SUBCOMMAND_DEVICE_WORD_IQR = 0x0002
export const SUBCOMMAND_DEVICE_BIT_IQR = 0x0003

export const UNIT_BIT = 'bit'
export const UNIT_WORD = 'word'

/**
 * Device codes (SH080956ENG 5.2, binary code column).
 * radix is the default notation radix of the device number.
 */
export const DEVICE_CODES = {
  SM: { code: 0x0091, radix: 10, unit: UNIT_BIT },
  SD: { code: 0x00A9, radix: 10, unit: UNIT_WORD },
  X: { code: 0x009C, radix: 16, unit: UNIT_BIT },
  Y: { code: 0x009D, radix: 16, unit: UNIT_BIT },
  M: { code: 0x0090, radix: 10, unit: UNIT_BIT },
  L: { code: 0x0092, radix: 10, unit: UNIT_BIT },
  F: { code: 0x0093, radix: 10, unit: UNIT_BIT },
  V: { code: 0x0094, radix: 10, unit: UNIT_BIT },
  B: { code: 0x00A0, radix: 16, unit: UNIT_BIT },
  S: { code: 0x0098, radix: 10, unit: UNIT_BIT },
  D: { code: 0x00A8, radix: 10, unit: UNIT_WORD },
  W: { code: 0x00B4, radix: 16, unit: UNIT_WORD },
  TS: { code: 0x00C1, radix: 10, unit: UNIT_BIT },
  TC: { code: 0x00C0, radix: 10, unit: UNIT_BIT },
  TN: { code: 0x00C2, radix: 10, unit: UNIT_WORD },
  LTS: { code: 0x0051, radix: 10, unit: UNIT_BIT },
  LTC: { code: 0x0050, radix: 10, unit: UNIT_BIT },
  LTN: { code: 0x0052, radix: 10, unit: UNIT_WORD },
  STS: { code: 0x00C7, radix: 10, unit: UNIT_BIT },
  STC: { code: 0x00C6, radix: 10, unit: UNIT_BIT },
  STN: { code: 0x00C8, radix: 10, unit: UNIT_WORD },
  LSTS: { code: 0x0059, radix: 10, unit: UNIT_BIT },
  LSTC: { code: 0x0058, radix: 10, unit: UNIT_BIT },
  LSTN: { code: 0x005A, radix: 10, unit: UNIT_WORD },
  CS: { code: 0x00C4, radix: 10, unit: UNIT_BIT },
  CC: { code: 0x00C3, radix: 10, unit: UNIT_BIT },
  CN: { code: 0x00C5, radix: 10, unit: UNIT_WORD },
  LCS: { code: 0x0055, radix: 10, unit: UNIT_BIT },
  LCC: { code: 0x0054, radix: 10, unit: UNIT_BIT },
  LCN: { code: 0x0056, radix: 10, unit: UNIT_WORD },
  SB: { code: 0x00A1, radix: 16, unit: UNIT_BIT },
  SW: { code: 0x00B5, radix: 16, unit: UNIT_WORD },
  DX: { code: 0x00A2, radix: 16, unit: UNIT_BIT },
  DY: { code: 0x00A3, radix: 16, unit: UNIT_BIT },
  Z: { code: 0x00CC, radix: 10, unit: UNIT_WORD },
  LZ: { code: 0x0062, radix: 10, unit: UNIT_WORD },
  R: { code: 0x00AF, radix: 10, unit: UNIT_WORD },
  ZR: { code: 0x00B0, radix: 10, unit: UNIT_WORD },
  RD: { code: 0x002C, radix: 10, unit: UNIT_WORD },
  G: { code: 0x00AB, radix: 10, unit: UNIT_WORD },
  HG: { code: 0x002E, radix: 10, unit: UNIT_WORD }
}

/** Longest-first candidates so that 'LSTS' wins over 'L'. */
export const DEVICE_CODE_CANDIDATES = Object.keys(DEVICE_CODES)
  .sort((a, b) => (b.length - a.length) || (a < b ? -1 : 1))

/** X/Y are octal on iQ-F. */
export const IQF_OCTAL_DEVICE_CODES = new Set(['X', 'Y'])

/**
 * Canonical PLC profiles.
 * frame / series / addressProfile mirror _PLC_PROFILE_DEFAULTS in the Python library.
 */
export const PLC_PROFILES = {
  'melsec:iq-f': { frame: FRAME_3E, series: SERIES_QL, addressProfile: 'melsec:iq-f', display: 'MELSEC iQ-F' },
  'melsec:iq-r': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:iq-r', display: 'MELSEC iQ-R' },
  'melsec:iq-r:rj71en71': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:iq-r', display: 'MELSEC iQ-R (RJ71EN71)' },
  'melsec:iq-l': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:iq-l', display: 'MELSEC iQ-L' },
  'melsec:mx-f': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:mx-f', display: 'MELSEC MX-F' },
  'melsec:mx-r': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:mx-r', display: 'MELSEC MX-R' },
  'melsec:mx-r:rj71en71': { frame: FRAME_4E, series: SERIES_IQR, addressProfile: 'melsec:mx-r', display: 'MELSEC MX-R (RJ71EN71)' },
  'melsec:qcpu:qj71e71-100': { frame: FRAME_4E, series: SERIES_QL, addressProfile: 'melsec:qcpu', display: 'MELSEC-Q (QJ71E71-100)' },
  'melsec:lcpu': { frame: FRAME_3E, series: SERIES_QL, addressProfile: 'melsec:lcpu', display: 'MELSEC-L' },
  'melsec:lcpu:lj71e71-100': { frame: FRAME_4E, series: SERIES_QL, addressProfile: 'melsec:lcpu', display: 'MELSEC-L (LJ71E71-100)' },
  'melsec:qnu': { frame: FRAME_3E, series: SERIES_QL, addressProfile: 'melsec:qnu', display: 'MELSEC-Q (QnU)' },
  'melsec:qnu:qj71e71-100': { frame: FRAME_4E, series: SERIES_QL, addressProfile: 'melsec:qnu', display: 'MELSEC-Q (QnU, QJ71E71-100)' },
  'melsec:qnudv': { frame: FRAME_3E, series: SERIES_QL, addressProfile: 'melsec:qnudv', display: 'MELSEC-Q (QnUDV)' },
  'melsec:qnudv:qj71e71-100': { frame: FRAME_4E, series: SERIES_QL, addressProfile: 'melsec:qnudv', display: 'MELSEC-Q (QnUDV, QJ71E71-100)' }
}

/** melsec:qcpu is an abstract base profile and cannot be connected directly. */
export const QCPU_BASE_PROFILE_MESSAGE =
  'melsec:qcpu is a base profile; use melsec:qcpu:qj71e71-100.'

/** Device codes rejected per address profile. */
export const PROFILE_UNSUPPORTED_DEVICE_CODES = {
  'melsec:iq-f': new Set(['DX', 'DY', 'V', 'LTS', 'LTC', 'LTN', 'LSTS', 'LSTC', 'LSTN', 'ZR', 'RD']),
  'melsec:qcpu': new Set(['LTS', 'LTC', 'LTN', 'LSTS', 'LSTC', 'LSTN', 'LCS', 'LCC', 'LCN', 'LZ', 'RD']),
  'melsec:lcpu': new Set(['LTS', 'LTC', 'LTN', 'LSTS', 'LSTC', 'LSTN', 'LCS', 'LCC', 'LCN', 'LZ', 'RD']),
  'melsec:qnu': new Set(['LTS', 'LTC', 'LTN', 'LSTS', 'LSTC', 'LSTN', 'LCS', 'LCC', 'LCN', 'LZ', 'RD']),
  'melsec:qnudv': new Set(['LTS', 'LTC', 'LTN', 'LSTS', 'LSTC', 'LSTN', 'LCS', 'LCC', 'LCN', 'LZ', 'RD'])
}

/** Maximum points per direct access request, by address profile. */
export const PROFILE_DIRECT_LIMITS = {
  default: { word: 960, bit: 7168 },
  'melsec:iq-f': { word: 960, bit: 3584 }
}

/** Devices marked read-only by write_policy for every profile. */
export const READ_ONLY_DEVICE_CODES = new Set(['S'])

/** Long timer / long counter device groups with special direct-access rules. */
export const LT_LST_DIRECT_CODES = new Set(['LTC', 'LTS', 'LSTC', 'LSTS'])
export const LT_LST_CURRENT_BLOCK_CODES = new Set(['LTN', 'LSTN'])
export const LT_LST_CURRENT_CODES = new Set(['LTN', 'LSTN', 'LCN'])
export const LC_CONTACT_CODES = new Set(['LCS', 'LCC'])
export const LONG_FAMILY_STATE_WRITE_DIRECT_CODES = new Set([...LT_LST_DIRECT_CODES, ...LC_CONTACT_CODES])
export const DWORD_ONLY_DIRECT_CODES = new Set(['LZ'])
export const RANDOM_DWORD_ONLY_DIRECT_CODES = new Set(['LCN', 'LZ'])

export const MAX_REQUEST_PAYLOAD_LENGTH = 0xFFFF - 6
export const MAX_IPV4_UDP_DATAGRAM_LENGTH = 65507
