import process from 'node:process'

import parse from 'csv-parser'
import intoStream from 'into-stream'
import pumpify from 'pumpify'
import {createGeocodeStream} from 'addok-geocode-stream'
import {decodeStream, encodeStream} from 'iconv-lite'
import stringify from 'csv-write-stream'

import {detectParams} from './csv.js'

const ADDOK_SERVICE_URL = process.env.ADDOK_SERVICE_URL || 'https://api-adresse.data.gouv.fr'

export function geocodeCsvFile(buffer, options = {}) {
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
