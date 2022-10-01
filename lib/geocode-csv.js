const {callbackify} = require('util')
const parse = require('csv-parser')
const intoStream = require('into-stream')
const pumpify = require('pumpify')
const {createGeocodeStream} = require('addok-geocode-stream')
const {decodeStream, encodeStream} = require('iconv-lite')
const stringify = require('csv-write-stream')
const {detectParams} = require('./csv')

const ADDOK_SERVICE_URL = process.env.ADDOK_SERVICE_URL || 'https://api-adresse.data.gouv.fr'

async function geocodeCsvFile(buffer, options = {}) {
  const {encoding, columnSeparator, columns} = detectParams(buffer)

  if (options.columns && options.columns.some(c => !columns.includes(c))) {
    throw new Error('At least one given column name is unknown')
  }

  return pumpify(
    intoStream(buffer),
    decodeStream(encoding),
    parse({separator: columnSeparator}),
    createGeocodeStream(ADDOK_SERVICE_URL, options),
    stringify({separator: columnSeparator}),
    encodeStream(encoding)
  )
}

module.exports = {geocodeCsvFile: callbackify(geocodeCsvFile)}
