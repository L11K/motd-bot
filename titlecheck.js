const request = require('request');
const cheerio = require('cheerio');
const http = require('http');
const axios = require('axios');
const translate = require('translate');

axios.get('http://www.imdb.com/title/tt1588895/')
	.then(response => {
		let $ = cheerio.load(response.data);
		let title = $('.title_wrapper > h1[itemprop="name"]').text().trim()
		console.log('Axios\n' + title.trim().substring(0, title.length - 7));
		translate(title.trim().substring(0, title.length - 7), 'en').then(text => {
			console.log(text);
		});
	})
	.catch(error => {
		console.log(error);
	});

// request('http://www.imdb.com/title/tt1588895/', (err, res, html) => {
// 	if (err) throw err;
// 	let $ = cheerio.load(html);
// 	let title = $('.title_wrapper > h1[itemprop="name"]').text().trim();
// 	console.log('Request\n' + title.trim());
// });

// http.get('http://www.imdb.com/title/tt1588895/', (res) => {
// 	res.setEncoding('utf8');
// 	res.on('data', data => {
// 		let $ = cheerio.load(data);

// 		let title = $('.title_wrapper > h1[itemprop="name"]').text().trim();
// 		console.log('HTTP\n' + title.trim());
// 	});
// });
