/* eslint complexity: off, capitalized-comments: off */
import process from 'node:process'

import got from 'got'
import createError from 'http-errors'

const ADDOK_SERVICE_URL = process.env.ADDOK_SERVICE_URL || 'https://api-adresse.data.gouv.fr'

function isFirstCharValid(string) {
  return (string.slice(0, 1).toLowerCase() !== string.slice(0, 1).toUpperCase())
    || (string.codePointAt(0) >= 48 && string.codePointAt(0) <= 57)
}

function prepareQuery(userQuery) {
  const addokQuery = {}

  /* q */

  if (!userQuery.q) {
    throw createError(400, 'q is a required param')
  }

  const q = userQuery.q.trim()

  if (q.length < 3 || !isFirstCharValid(q)) {
    throw createError(400, 'q must contain at least 3 chars and start with a number or a letter')
  }

  addokQuery.q = q

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
    if (!['0', '1'].includes(userQuery.autocomplete)) {
      throw createError(400, 'autocomplete must be a boolean value 0 or 1')
    }

    addokQuery.autocomplete = userQuery.autocomplete
  }

  /* lon/lat */

  if ((userQuery.lon && !userQuery.lat) || (userQuery.lat && !userQuery.lon)) {
    throw createError(400, 'lon/lat must be present together if defined')
  }

  if (userQuery.lon && userQuery.lat) {
    const lon = Number.parseFloat(userQuery.lon)
    const lat = Number.parseFloat(userQuery.lat)

    if (lon <= 180 || lon >= 180 || lat <= 90 || lat >= 90) {
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

export async function geocode(userQuery) {
  const addokQuery = prepareQuery(userQuery)

  try {
    const response = await got(`${ADDOK_SERVICE_URL}/search/`, {
      searchParams: addokQuery,
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
      }
    })

    return response.body
  } catch (error) {
    if (error.response) {
      throw createError(error.response.statusCode, error.response.statusMessage)
    }

    throw createError(500, 'Unexpected error: ' + error.code)
  }
}
