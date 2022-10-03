/* eslint import/no-unassigned-import: off */
import 'dotenv/config.js'

import {pipeline} from 'node:stream/promises'
import process from 'node:process'

import {uniqueId} from 'lodash-es'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import multer from 'multer'
import contentDisposition from 'content-disposition'

import {geocodeCsvFile} from './lib/geocode-csv.js'
import {geocode, reverse} from './lib/addok.js'
import w from './lib/w.js'
import errorHandler from './lib/error-handler.js'

const app = express()
const upload = multer()

app.use(cors({origin: true}))

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

function ensureArray(value) {
  if (value) {
    return Array.isArray(value) ? value : [value]
  }

  return []
}

function logFinished(obj) {
  const finishedAt = new Date()
  return {
    ...obj,
    finishedAt,
    duration: finishedAt - obj.startedAt
  }
}

app.post('/search/csv', upload.single('data'), w(async (req, res) => {
  if (!req.file) {
    return res.status(400).send({
      code: 400,
      message: 'A CSV file must be provided in data field'
    })
  }

  const {originalName} = req.file
  const geocodeOptions = req.body ? {
    columns: ensureArray(req.body.columns),
    citycode: req.body.citycode,
    postcode: req.body.postcode,
    resultColumns: ensureArray(req.body.result_columns)
  } : {}

  const logObject = {
    reqId: uniqueId('req_'),
    status: 'created',
    ...geocodeOptions,
    fileSize: req.file.size,
    startedAt: new Date()
  }

  console.log(JSON.stringify(logObject))

  const geocodedStream = geocodeCsvFile(req.file.buffer, geocodeOptions)

  const resultFileName = originalName ? 'geocoded-' + originalName : 'geocoded.csv'

  res
    .type('csv')
    .set('Content-Disposition', contentDisposition(resultFileName))

  try {
    await pipeline(geocodedStream, res)

    console.log(JSON.stringify({
      ...logFinished(logObject),
      status: 'completed'
    }))
  } catch (error) {
    res.destroy()

    console.log(JSON.stringify({
      ...logFinished(logObject),
      status: 'failed',
      error: error.message
    }))

    console.log(error)
  }
}))

app.get('/search', w(async (req, res) => {
  const result = await geocode(req.query)
  res.send(result)
}))

app.get('/reverse', w(async (req, res) => {
  const result = await reverse(req.query)
  res.send(result)
}))

app.use(errorHandler)

app.listen(process.env.PORT || 5000)
