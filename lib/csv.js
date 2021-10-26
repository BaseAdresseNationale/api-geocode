const jschardet = require('jschardet')
const {maxBy, trim} = require('lodash')

const CHARDET_TO_NODEJS_ENCODINGS = {
  'windows-1252': 'latin1',
  'utf-8': 'utf8',
  ascii: 'utf8' // Compat
}

const ONE_MEGABYTE = 1024 * 1024
const CR = '\r'
const LF = '\n'
const CRLF = '\r\n'

function detectEncoding(buffer) {
  const result = jschardet.detect(buffer)
  if (result && result.encoding && result.encoding in CHARDET_TO_NODEJS_ENCODINGS) {
    return CHARDET_TO_NODEJS_ENCODINGS[result.encoding]
  }
}

function detectLineSeparator(str) {
  const crPos = str.indexOf(CR)
  const lfPos = str.indexOf(LF)
  const crlfPos = str.indexOf(CRLF)

  if (crlfPos < 0 && lfPos < 0 && crPos < 0) {
    throw new Error('Unable to detect line separator')
  }

  if (crlfPos >= 0 && (lfPos < 0 || crlfPos <= lfPos) && (crPos < 0 || crlfPos <= crPos)) {
    return CRLF
  }

  return crPos >= 0 && crPos <= lfPos ? CR : LF
}

const COLUMN_SEPARATORS = [',', ';', '\t', '|']

function detectColumnSeparator(firstLine) {
  const counts = COLUMN_SEPARATORS
    .map(sep => ({sep, count: firstLine.split(sep).length - 1}))
    .filter(({count}) => count >= 1)

  if (counts.length > 0) {
    return maxBy(counts, 'count').sep
  }

  return ','
}

function detectParams(buffer) {
  const b = buffer.slice(0, ONE_MEGABYTE)
  const encoding = detectEncoding(b) || 'utf8'
  const bStr = b.toString(encoding)
  const lineSeparator = detectLineSeparator(bStr)
  const firstLine = bStr.substr(0, bStr.indexOf(lineSeparator))
  const columnSeparator = detectColumnSeparator(firstLine)
  const columns = firstLine.split(columnSeparator).map(c => trim(c, '\'" '))
  return {encoding, lineSeparator, columnSeparator, columns}
}

module.exports = {detectParams}
