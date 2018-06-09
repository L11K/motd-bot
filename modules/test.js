'use strict'

const axios = require('axios')
const cheerio = require('cheerio')
const imdb = require('imdb-api')
const url = 'https://www.imdb.com/title/tt0185906'

let futureRelease = false
let nullCount = 0
let datePublished
let results = { title: null, director: null, runtime: null, genreOne: null, genreTwo: null, release: null, rating: null, url: url, user: '' }

let id = url.substring(url.indexOf('title/') + 6, (url.lastIndexOf('/') === url.length - 1 ? url.lastIndexOf('/') : url.length))
console.log(id)

imdb.getById(id, {apiKey: '254a67b0', timeout: '30000'}).then(console.log).catch(console.log)

let imdbModule = {}

imdbModule.getFilm = (url) => {
  axios.get(url)
    .then((response) => {
      let $ = cheerio.load(response.data)

      // Get temp title
      results.title = $('.title_wrapper > h1[itemprop="name"]').text().trim()
      results.title = results.title.substring(0, (results.title.length - 7))

      // Get movie director
      results.director = $('span[itemprop="director"]').first().text()
      if (results.director.includes(',')) {
        results.director = results.director.substring(0, results.director.indexOf(','))
      }
      results.director = results.director.trim()

      // Get movie runtime
      let runtime = $('time[itemprop="duration"]')
      runtime.attr('datetime', (i, d) => {
        if (!d) {
          results.runtime = null
        } else {
          results.runtime = d.toString().substring(2, d.toString().indexOf('M'))
        }
      })

      // Get movie genre(s)
      let genres = []
      let genre = $('span[itemprop="genre"]').text()
      if (genre === '') {
        console.log(`No genre information found for ${results.title}! Setting null values.`)
        results.genreOne = null
        results.genreTwo = null
      } else {
        // Check for genres such as sci-fi or film-noir
        if (!genre.includes('-')) genres = genre.split(/(?=[A-Z])/)
        else {
          console.log('Genre includes hyphen')
          let lastCapital = 0
          for (let i = 0; i <= genre.length; i++) {
            if ((i !== 0 && genre.charAt(i).match(/(?=[A-Z])/) && genre.charAt(i - 1) !== '-') || i === genre.length) {
              console.log(genre.substring(lastCapital, i))
              genres.push(genre.substring(lastCapital, i))
              lastCapital = i
            }
          }
        }
        if (genres.length > 1) {
          console.log(`There are two genres`)
          results.genreOne = genres[0]
          results.genreTwo = genres[1]
        } else {
          console.log(`There is only one genre`)
          results.genreOne = genres[0]
          results.genreTwo = null
        }
      }

      // Get release year for movie
      results.release = $('#titleYear a').text()
      results.release = results.release.trim()

      datePublished = $('meta[itemprop="datePublished"]').attr('content')

      // Get rating for film
      results.rating = $('.ratingValue').text()
      results.rating = results.rating.trim().substring(0, 3) + '0'

      if (results.rating === '0') results.rating = null

      let titleURL = url
      if (titleURL.includes('?')) {
        titleURL = titleURL.substring(0, titleURL.indexOf('?')) + 'releaseinfo'
      } else {
        if (!titleURL.includes('releaseinfo')) {
          if (titleURL.lastIndexOf('/') !== titleURL.length - 1) {
            titleURL = titleURL + '/releaseinfo'
          } else {
            titleURL = titleURL + 'releaseinfo'
          }
        }
      }
      console.log(titleURL)
      return axios.get(titleURL)
    }).then((response) => {
      let $ = cheerio.load(response.data)

      // Check for worldwide title
      if ($('#akas > tbody').children().last().children().first().text() === 'World-wide (English title)') {
        results.title = $('#akas > tbody').children().last().children().last().text()
      }
    }).then(() => {
      let currentTime = new Date()

      if (parseInt(results.release) > currentTime.getFullYear()) {
        futureRelease = true
      } else if (results.rating === null && results.release === currentTime.getFullYear().toString()) {
        console.log('Trying to compare dates')
        let releaseDate = new Date(datePublished)
        if (releaseDate > currentTime) {
          console.log("Hasn't been released yet")
          futureRelease = true
        }
      }

      for (let i in results) {
        if (results[i] === null) {
          console.log(`Null found!`)
          nullCount++
        }
      }

      if (nullCount < 3 && !futureRelease) {
        console.log(results)
      } else {
        console.log('rejecting movie')
      }
    })
}
