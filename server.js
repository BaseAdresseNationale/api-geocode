const express = require('express')
const cors = require('cors')
const morgan = require('morgan')

const app = express()

app.use(cors())

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}

app.listen(process.env.PORT || 5000)
