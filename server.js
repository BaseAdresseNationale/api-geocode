const {pipeline} = require('stream')
const {uniqueId} = require('lodash')
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const multer = require('multer')
const contentDisposition = require('content-disposition')
const {geocodeCsvFile} = require('./lib/geocode-csv')

const app = express()
const upload = multer()

app.use(cors())

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

app.post('/search/csv', upload.single('data'), (req, res) => {
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
    postcode: req.body.postcode
  } : {}

  const logObject = {
    reqId: uniqueId('req_'),
    status: 'created',
    ...geocodeOptions,
    fileSize: req.file.size,
    startedAt: new Date()
  }

  console.log(JSON.stringify(logObject))

  geocodeCsvFile(req.file.buffer, geocodeOptions, (err, geocodedStream) => {
    if (err) {
      return res.status(500).send({code: 500, message: err.message})
    }

    const resultFileName = originalName ? 'geocoded-' + originalName : 'geocoded.csv'

    res
      .type('csv')
      .set('Content-Disposition', contentDisposition(resultFileName))

    pipeline(geocodedStream, res, err => {
      if (err) {
        res.destroy()
        console.log(JSON.stringify({
          ...logFinished(logObject),
          status: 'failed',
          error: err.message
        }))
        console.log(err)
        return
      }

      console.log(JSON.stringify({
        ...logFinished(logObject),
        status: 'completed'
      }))
    })
  })
})

app.listen(process.env.PORT || 5000)
