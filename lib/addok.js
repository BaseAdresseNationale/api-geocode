/* eslint complexity: off, capitalized-comments: off */
import process from 'node:process'
import {Agent as HttpAgent} from 'node:http'
import {Agent as HttpsAgent} from 'node:https'

import got from 'got'
import createError from 'http-errors'
import {pick} from 'lodash-es'

function isFirstCharValid(string) {
  return (string.slice(0, 1).toLowerCase() !== string.slice(0, 1).toUpperCase())
    || (string.codePointAt(0) >= 48 && string.codePointAt(0) <= 57)
}

export function prepareQuery(userQuery) {
  for (const [key, value] of Object.entries(userQuery)) {
    if (Array.isArray(value)) {
      userQuery[key] = value.pop()
    }

    if (['undefined', 'null', ''].includes(value)) {
      userQuery[key] = undefined
    }
  }

  const addokQuery = {}

  /* q */

  if (userQuery.q) {
    const q = userQuery.q.trim()

    if (q.length < 3 || !isFirstCharValid(q)) {
      throw createError(400, 'q must contain at least 3 chars and start with a number or a letter')
    }

    addokQuery.q = q
  }

  /* limit */

  if (userQuery.limit) {
    const limit = Number.parseInt(userQuery.limit, 10)

    if (!Number.isInteger(limit) || limit < 1 || limit >= 100) {
      throw createError(400, 'limit must be an integer between 1 and 100')
    }

    addokQuery.limit = limit.toString()
  }

  /* autocomplete */

  if (userQuery.autocomplete) {
    if (!['0', '1', 'true', 'false'].includes(userQuery.autocomplete)) {
      throw createError(400, 'autocomplete must be a boolean value 0 or 1')
    }

    if (userQuery.autocomplete === 'true') {
      addokQuery.autocomplete = '1'
    } else if (userQuery.autocomplete === 'false') {
      addokQuery.autocomplete = '0'
    } else {
      addokQuery.autocomplete = userQuery.autocomplete
    }
  }

  /* lon/lat */

  if ((userQuery.lon && !userQuery.lat) || (userQuery.lat && !userQuery.lon)) {
    throw createError(400, 'lon/lat must be present together if defined')
  }

  if (userQuery.lon && userQuery.lat) {
    const lon = Number.parseFloat(userQuery.lon)
    const lat = Number.parseFloat(userQuery.lat)

    if (Number.isNaN(lon) || lon <= -180 || lon >= 180 || Number.isNaN(lat) || lat <= -90 || lat >= 90) {
      throw createError(400, 'lon/lat must be valid WGS-84 coordinates')
    }

    addokQuery.lon = lon.toString()
    addokQuery.lat = lat.toString()
  }

  /* type */

  if (userQuery.type) {
    if (!['housenumber', 'street', 'locality', 'municipality'].includes(userQuery.type)) {
      throw createError(400, 'type must be one of housenumber/street/locality/municipality')
    }

    addokQuery.type = userQuery.type
  }

  /* postcode */

  if (userQuery.postcode) {
    if (!/^\d([AB\d])\d{3}$/.test(userQuery.postcode)) {
      throw createError(400, 'postcode not valid')
    }

    addokQuery.postcode = userQuery.postcode
  }

  /* citycode */

  if (userQuery.citycode) {
    if (!/^\d{5}$/.test(userQuery.citycode)) {
      throw createError(400, 'citycode not valid')
    }

    addokQuery.citycode = userQuery.citycode
  }

  return addokQuery
}

const ADDOK_SERVICE_URL = process.env.ADDOK_SERVICE_URL || 'https://api-adresse.data.gouv.fr'

const httpAgent = new HttpAgent({keepAlive: true})
const httpsAgent = new HttpsAgent({keepAlive: true})

const addokClient = got.extend({
  prefixUrl: ADDOK_SERVICE_URL,
  responseType: 'json',
  retry: {
    limit: 2,
    methods: ['GET'],
    statusCodes: [502, 503, 504],
    errorCodes: [
      'ETIMEDOUT',
      'ECONNRESET',
      'EADDRINUSE',
      'ECONNREFUSED',
      'EPIPE',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN'
    ]
  },
  timeout: {
    request: 5000
  },
  agent: {
    http: httpAgent,
    https: httpsAgent
  }
})

function handleGotError(error) {
  if (error.response) {
    throw createError(error.response.statusCode, error.response.statusMessage)
  }

  if (error.code === 'ETIMEDOUT') {
    throw createError(504, 'Timeout')
  }

  throw createError(500, 'Unexpected error: ' + error.code)
}

export async function geocode(userQuery) {
  const addokQuery = prepareQuery(
    pick(userQuery, [
      'q',
      'limit',
      'type',
      'lon',
      'lat',
      'postcode',
      'citycode',
      'autocomplete'
    ])
  )

  if (!addokQuery.q) {
    throw createError(400, 'q is a required param')
  }

  try {
    const response = await addokClient.get('search/', {
      searchParams: addokQuery
    })

    if (response.timings.phases.firstByte > 200) {
      console.log(JSON.stringify({
        type: 'addok-slow-query',
        duration: response.timings.phases.firstByte,
        action: 'geocode',
        query: addokQuery
      }))
    }

    return response.body
  } catch (error) {
    handleGotError(error)
  }
}

export async function reverse(userQuery) {
  const addokQuery = prepareQuery(
    pick(userQuery, [
      'lon',
      'lat',
      'limit',
      'type'
    ])
  )

  if (!addokQuery.lon) {
    throw createError(400, 'lon/lat are required params')
  }

  try {
    const response = await addokClient.get('reverse/', {
      searchParams: addokQuery
    })

    if (response.timings.phases.firstByte > 200) {
      console.log(JSON.stringify({
        type: 'addok-slow-query',
        duration: response.timings.phases.firstByte,
        action: 'reverse',
        query: addokQuery
      }))
    }

    return response.body
  } catch (error) {
    handleGotError(error)
  }
}
