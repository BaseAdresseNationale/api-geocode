import test from 'ava'
import {prepareQuery} from '../lib/addok.js'

test('prepareQuery / full', t => {
  t.deepEqual(prepareQuery({
    q: 'foobar',
    limit: '3',
    type: 'housenumber',
    lon: '-1.11',
    lat: '3.456',
    postcode: '2B123',
    citycode: '12345',
    autocomplete: '1'
  }), {
    q: 'foobar',
    limit: '3',
    type: 'housenumber',
    lon: '-1.11',
    lat: '3.456',
    postcode: '2B123',
    citycode: '12345',
    autocomplete: '1'
  })
})

test('prepareQuery / pop values', t => {
  t.deepEqual(prepareQuery({
    q: ['foo', 'bar']
  }), {
    q: 'bar'
  })
})
