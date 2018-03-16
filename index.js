const Discord = require("discord.js");
const client = new Discord.Client();
var fs = require('fs');
var util = require('util');
var date = require('get-date');
var tokens = require('./tokens.json');
var request = require('request');
var cheerio = require('cheerio');
var getURL = require('get-urls');
var mysql = require('mysql');
var schedule = require('node-schedule');
var unshort = require('unshort');

var con = mysql.createConnection({
	host: tokens.DB_HOST,
	user: tokens.DB_USER,
	password: tokens.DB_PSWD,
	database: tokens.DB_NAME
});

con.connect(function (err) {
	if (err) throw err;
	console.log("Connected to database!");
});

client.on('ready', () => {
	console.log(`[INIT] (${date()} @${date(true)}): Logged into ${client.user.tag}\n` +
		`    Guilds being moderated:`);
	client.user.setActivity(`MOTD | ${tokens.PREFIX}movie`)
	client.guilds.forEach((guild) => {
		guildStamp = guild.joinedAt;
		console.log(
			`    -   GUILD: ${guild.name}\n` +
			`           -  GUILD_ID: ${guild.id}\n` +
			`           -  OWNER: ${guild.owner.user.tag}\n` +
			`           -  OWNER_ID: ${guild.owner.user.id}\n` +
			`           -  MEMBERS: ${guild.memberCount}\n` +
			`           -  JOINED_AT: ${guildStamp.getDate()}/${guildStamp.getMonth()}/${guildStamp.getFullYear()} @ ${guildStamp.getHours()}:${guildStamp.getMinutes()}:${guildStamp.getSeconds()}`);
	})
});

client.on('message', msg => {
	// Letterboxd channel management
	if (msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.LETTERBOXD_ID) {
		if (msg.content.includes('letterboxd.com')) {
			var urlPosted = Array.from(getURL(msg.content));
			if (urlPosted.length > 0) {
				msg.channel.fetchMessages()
					.then(messages => {
						console.log(`Got ${messages.size} messages`);
						messages.some(message => {
							if (msg.content == message.content && msg.id !== message.id) {
								msg.delete()
									.then(msg => {
										if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been posted in this channel.\n```" + msg.content + "```")
									})
									.catch(console.error);
								return true;
							}
						})
					})
			} else {
				msg.delete()
					.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not follow the content guidelines.\n```" + msg.content + "```") })
					.catch(console.error);
			}
		} else {
			msg.delete()
				.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not follow the content guidelines.\n```" + msg.content + "```") })
				.catch(console.error);
		}
	}

	// Set embed
	else if (msg.content.toLowerCase() == '!testset' && msg.author.id == tokens.ADMIN_ID) {
		setEmbed()
	}

	// Get embed
	else if (msg.content.toLowerCase() == '!testsend' && msg.author.id == tokens.ADMIN_ID) {
		sendEmbed()
	}

	else if (msg.content.toLowerCase() == '!cleardb' && msg.author.id == tokens.ADMIN_ID) {
		console.log('Clearing Database!')
		con.query('DELETE FROM suggested');
		con.query('DELETE FROM used');
	}
	else if (msg.content.toLowerCase() == '!clearchannel' && msg.author.id == tokens.ADMIN_ID) {
		console.log('Clearing Channel!')
		deleteStuff(msg);
	}

	// Movie recommendations management
	else if (msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.RECOMMENDATIONS_ID && !msg.author.bot) {

		var url = Array.from(getURL(msg.content));

		console.log(url.length)

		var isUnique = true;

		msg.channel.fetchMessages()
			.then(messages => {
				console.log("Performing message duplicate check")
				console.log(`Got ${messages.size} messages`);
				if (!messages.some(message => {
					if (msg.content == message.content && msg.id !== message.id) {
						console.log("Check Failed, message has already been posted.")
						console.log(`Message sent: ${msg.content} from ${msg.author.username}`)
						console.log(`Message posted: ${message.content} from ${message.author.username}`)
						isUnique = false;
						msg.delete()
							.then(msg => {
								console.log(`Notifying ${msg.author.username} their message was deleted.`)
								if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been posted in this channel.\n```" + msg.content + "```")
							})
							.catch(console.error);
						return true;
					}
				})) {
					console.log(`Message is unique, attempting to scrape URL`)
					if (url.length > 0) {
						scrapeURL()
					} else {
						console.log('Link was invalid, deleting message and notifying user')
						msg.delete()
							.then(message => { if (!message.author.bot) message.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a valid link.\n```" + msg.content + "```") })
							.catch(console.error())
					}
				}
			})

		function scrapeURL() {

			if (url.length > 0) {
				if (url[0].includes('http://') || url[0].includes('https://')) {
					request(url[0], (error, response, html) => {
						if (error) console.log(error)
						if (response.statusCode == 200) {
							makeRequest();
						} else {
							console.log('Link was invalid, deleting message and notifying user')
							msg.delete()
								.then(message => { if (!message.author.bot) message.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a valid link.\n```" + msg.content + "```") })
								.catch(console.error())
						}
					})
					function makeRequest() {
						if (url[0].includes('imdb.com/title/') && isUnique) {

							if (url[0].includes('m.imdb.com')) url[0] = url[0].replace('m.', 'www.');

							console.log(`[MOVIE REQUEST] (${date()} @${date(true)}): Making request for IMDB\n` +
								`        URL:  ${url[0]}\n` +
								`        AUTHOR: ${msg.author.username}\n` +
								`        -  AUTHOR_ID: ${msg.author.id}\n`);

							var isMovie = true;

							request(url[0], function (error, response, html) {
								if (!error) {
									var $ = cheerio.load(html)

									$('.subtext').filter(function () {
										var data = $(this);

										var isTV = data.children().first()[0].attribs.content;

										if (isTV != undefined) {
											if (isTV.includes('TV')) isMovie = false;
										} else {
											console.log(`Not certain if this is a movie, still attempting to scrape information`)
										}

									})

									if (isMovie) {
										console.log(`Url is a movie, moving on!`);
										request(url[0], function (error, response, html) {
											if (!error) {
												var $ = cheerio.load(html);

												var title, director, genre, release, rating;
												let futureRelease = false;
												let genres = [];
												var results = { title: "", director: "", runtime: "", genreOne: "", genreTwo: "", release: "", rating: "", url: url[0], user: msg.author.id };

												// Get movie title
												title = $('h1[itemprop="name"]').text().trim();
												results.title = title.substring(0, (title.length - 7));

												// Get movie director
												director = $('span[itemprop="director"]').first().text();
												results.director = director.trim();

												// Get movie runtime
												let runtime = $('time[itemprop="duration"]');
												runtime.attr('datetime', (i, d) => {
													if (!d) {
														results.runtime = null;
													} else {
														results.runtime = d.toString().substring(2, d.toString().indexOf('M'))
													}
												})

												// Get movie genre(s)
												genre = $('span[itemprop="genre"]').text();
												if (genre == '') {
													console.log(`No genre information found for ${results.title}! Setting null values.`)
													results.genreOne = null;
													results.genreTwo = null;
												} else {
													// Check for genres such as sci-fi or film-noir
													if (!genre.includes('-')) genres = genre.split(/(?=[A-Z])/);
													else {
														console.log('Genre includes hyphen')
														let lastCapital = 0;
														for (let i = 0; i <= genre.length; i++) {
															if ((i != 0 && genre.charAt(i).match(/(?=[A-Z])/) && genre.charAt(i - 1) !== '-') || i == genre.length) {
																console.log(genre.substring(lastCapital, i))
																genres.push(genre.substring(lastCapital, i))
																lastCapital = i;
															}
														}
													}
													if (genres.length > 1) {
														console.log(`There are two genres`)
														results.genreOne = genres[0];
														results.genreTwo = genres[1];
													} else {
														console.log(`There is only one genre`)
														results.genreOne = genres[0];
														results.genreTwo = null;
													}
												}

												// Get release year for movie
												release = $('#titleYear a').text();
												results.release = release.trim();

												// Get rating for film
												rating = $('.ratingValue').text();
												results.rating = rating.trim().substring(0, 3) + '0';

												if (results.rating === '0') results.rating = null;

												// Do null check
												if (results.runtime == '') results.runtime = null;

												// Log results
												console.log(results);

												let currentTime = new Date();

												if (parseInt(results.release) > currentTime.getFullYear()) {
													futureRelease = true;
												} else if (results.rating === null && results.release === currentTime.getFullYear().toString()) {
													console.log('Trying to compare dates')
													let releaseDate = new Date($('meta[itemprop="datePublished"]').attr('content'))
													if (releaseDate > currentTime) {
														console.log("Hasn't been released yet")
														futureRelease = true;
													}
												}

												let nullCount = 0;

												for (let i in results) {
													if (results[i] === null) {
														console.log(`Null found!`)
														nullCount++;
													}
												}

												if (nullCount < 3) {
													if (!futureRelease) {


														con.query(`SELECT title FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release}`, function (e, rows, fields) {
															if (e) console.log(e);
															if (rows.length == 0) {
																console.log('Entry does not exist, inserting data into table')
																con.query(`INSERT INTO suggested VALUES ("${results.title}", "${results.director}", ${results.release}, ${results.runtime}, ${results.genreOne ? `"${results.genreOne}"` : null}, ${results.genreTwo ? `"${results.genreTwo}"` : null}, ${results.rating}, "${results.url}", "${results.user}")`, function (error, result, field, ) {
																	if (error) throw error;
																	console.log(`Success: affected rows: ${result.affectedRows}`);
																	msg.reply(`got it! **${results.title}** was added to the database!`)
																});
															} else {
																console.log('Entry exists, deleting message')
																msg.delete()
																	.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been recommended.\n```" + msg.content + "```") })
																	.catch(console.error);
															}
														})
													} else {
														console.log(`Movie is a future release, denying`)
														msg.delete()
															.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has not been released yet.\n```" + msg.content + "```") })
															.catch(console.error);
													}
												} else {
													console.log(`Too many null values, denying entry`)
													msg.delete()
														.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not have enough information for the database.\n```" + msg.content + "```") })
														.catch(console.error);
												}
											} else {
												console.log(error)
											}
										});
									} else {
										console.log('DELETING MESSAGE')
										msg.delete()
											.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a movie.\n```" + msg.content + "```") })
											.catch(console.error);
									}
								} else console.log(error)
							})
						} else if (url[0].includes('letterboxd.com/film/') && isUnique || url[0].includes('boxd.it') && isUnique) {
							let boxdURL = url[0];
							console.log(`[MOVIE REQUEST] (${date()} @${date(true)}): Making request for Letterboxd\n` +
								`        URL:  ${boxdURL}\n` +
								`        AUTHOR: ${msg.author.username}\n` +
								`        -  AUTHOR_ID: ${msg.author.id}\n`);

							if (boxdURL.includes('boxd.it')) {
								console.log(`Attempting to expand url ${url[0]}`)
								unshort(url[0], (err, url) => {
									if (!err) {
										console.log(`Expansion on Letterboxd link successful! Expanded URL: ${url}`)
										boxdURL = url;
									} else console.log(`There was an error attempting to expand ${boxdURL}:\n${err}`)
								})
							}
							request(boxdURL, function (error, response, html) {
								if (!error) {
									var $ = cheerio.load(html);

									var title, director, release, runtime, genre, rating;
									let futureRelease = false;
									let genres = [];
									var results = { title: "", director: "", runtime: "", genreOne: "", genreTwo: "", release: "", rating: "", url: url[0], user: msg.author.id };

									// Get movie title
									title = $('.headline-1').text();
									results.title = title.trim();

									// Get movie director
									director = $('#featured-film-header span.prettify').first().text();
									results.director = director;


									// Get movie genre(s)
									genre = $('#tab-genres > .text-sluglist').text().trim();
									console.log(genre)
									if (genre === '') {
										console.log(`There is no genre for ${results.title}, setting null values.`)
										results.genreOne = null;
										results.genreTwo = null;
									} else {
										genres = genre.split(' ');
										if (genres.length > 1) {
											console.log('There is two genres')
											results.genreOne = genres[0].charAt(0).toUpperCase() + genres[0].slice(1);
											results.genreTwo = genres[1].charAt(0).toUpperCase() + genres[1].slice(1);
										} else {
											console.log('There is only one genre')
											results.genreOne = genres[0].charAt(0).toUpperCase() + genres[0].slice(1);
											results.genreTwo = null;
										}
									}

									// Get movie runtime
									runtime = $('.text-footer').text().trim();
									results.runtime = parseInt(runtime);

									// Get movie release year
									release = $('.number').text();
									results.release = release.trim();


									// Get ratings
									let ratingsUrl = boxdURL.substring(0, boxdURL.indexOf('film')) + 'csi/' + boxdURL.substring(boxdURL.indexOf('film'), boxdURL.length) + '/rating-histogram/'

									request(ratingsUrl, (e, r, h) => {
										if (h) {
											let currentTime = new Date()
											let $$ = cheerio.load(h);
											rating = $$('span.average-rating meta[itemprop="ratingValue"]').attr('content')
											results.rating = parseFloat(rating);
											if (parseInt(results.release) > currentTime.getFullYear()) {
												console.log('Comes out in a later year')
												futureRelease = true
											} else if (isNaN(results.rating) && results.release === currentTime.getFullYear().toString()) {
												console.log('Making request on imdb site');
												request($('a[data-track-action="IMDb"]').attr('href'), (er, re, ht) => {
													if (!er) {
														if (ht) {
															let $$$ = cheerio.load(ht);
															let releaseDate = new Date($$$('meta[itemprop="datePublished"]').attr('content'))
															if (releaseDate > currentTime) {
																console.log("Hasn't been released yet")
																futureRelease = true;
															}
														} else {
															console.log('nothing to show')
														}
													}
												})
											}

											setTimeout(() => {
												dataCheck()
											}, 2000);
										} else {
											console.log('no html returned?')
										}
									})

									function dataCheck() {
										// Do null value check
										if (isNaN(results.rating)) results.rating = null
										if (isNaN(results.runtime)) results.runtime = null;

										// Output results object
										console.log(results)

										let nullCount = 0;

										for (let i in results) {
											if (results[i] === null) {
												console.log(`Null found!`)
												nullCount++;
											}
										}

										if (nullCount < 3) {
											if (!futureRelease) {
												console.log(`Performing database precheck for ${results.title}`);

												con.query(`SELECT title FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release}`, function (e, rows, fields) {
													if (e) console.log(e);
													if (rows.length == 0) {
														console.log('Entry does not exist, inserting data into table ')
														con.query(`INSERT INTO suggested VALUES ("${results.title}", "${results.director}", ${results.release}, ${results.runtime}, ${results.genreOne ? `"${results.genreOne}"` : null}, ${results.genreTwo ? `"${results.genreTwo}"` : null}, ${results.rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
															if (error) throw error;
															console.log(`Success: affected rows: ${result.affectedRows}`);
															msg.reply(`got it! **${results.title}** was added to the database!`)
														});
													} else {
														console.log('Entry exists, deleting message')
														msg.delete()
															.then(message => { if (!message.author.bot) msg.author.send("The following message has been deleted from **#" + message.channel.name + "** as it has already been recommended.\n```" + message.content + "```") })
															.catch(console.error);
													}
												})
											} else {
												console.log(`Movie is a future release, denying`)
												msg.delete()
													.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has not been released yet.\n```" + msg.content + "```") })
													.catch(console.error);
											}
										} else {
											console.log(`Too many null values, denying entry`)
											msg.delete()
												.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not have enough information for the database.\n```" + msg.content + "```") })
												.catch(console.error);
										}
									}
								} else {
									console.log(error)
								}
							});
						} else {
							console.log('DELETING MESSAGE')
							msg.delete()
								.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not fit the content guidelines.\n```" + msg.content + "```") })
								.catch(console.error);
						}
					}
				} else {
					console.log('DELETING MESSAGE')
					msg.delete()
						.then(msg => {
							console.log(`Notifying ${msg.author.username} their message was deleted.`)
							if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a valid link (http:// or https://).\n```" + msg.content + "```")
						})
						.catch(console.error);
				}
			} else {
				msg.delete()
					.then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not fit the content guidelines.\n```" + msg.content + "```") })
					.catch(console.error)
			}
		}
	}

	// MOVIE OF THE DAY COMMAND
	else if ((msg.content.toLowerCase() == `${tokens.PREFIX}movie` && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID)) ||
		(msg.content.toLowerCase().includes('what should i watch') && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID)) ||
		(msg.content.toLowerCase().includes('what i should watch') && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID)) ||
		(msg.content.toLowerCase().includes('what movie should i watch') && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID)) ||
		(msg.content.toLowerCase().includes('what movie i should watch') && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID))) {
		console.log(`[MOTD REQUEST] (${date()} @${date(true)}): Sending the movie of the day, details:\n` +
			`        AUTHOR: ${msg.author.username}\n` +
			`        -  AUTHOR_ID: ${msg.author.id}`);
		sendEmbed(msg.channel.id);
	}

	else if ((msg.content.toLowerCase() == `${tokens.PREFIX}randmovie` && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID) && !msg.author.bot) ||
		(msg.content.toLowerCase().includes('netflix and chill') && (msg.channel.id == tokens.CHANNEL_ID || msg.channel.id == tokens.BAV_ID) && !msg.author.bot)) {
		console.log(`[RANDMOVIE REQUEST] (${date()} @${date(true)}): Sending random movie, details:\n` +
			`        AUTHOR: ${msg.author.username}\n` +
			`        -  AUTHOR_ID: ${msg.author.id}`);
		var recChannel = client.channels.find('id', tokens.RECOMMENDATIONS_ID);
		msg.reply("let me see what I can find...")
			.then(console.log(`Getting random movie for ${msg.author.tag}`))
			.catch(console.error());
		let MOTD = {};
		con.query('SELECT * FROM suggested ORDER BY RAND() LIMIT 1', (e, r, f) => {
			if (e) throw e;
			console.log(`Random title selected:`);
			console.log(r[0]);
			var imageLink;

			if (r[0].url.includes('imdb.com')) {
				request(r[0].url, (error, response, html) => {
					if (!error) {
						var $ = cheerio.load(html);

						imageLink = $('.poster').find('img')[0].attribs.src;

						console.log('thumbnail url: ' + imageLink)
						saveEmbed(imageLink);
					} else console.log(error);
				})
			} else if (r[0].url.includes('letterboxd.com') || r[0].url.includes('boxd.it')) {
				request(r[0].url, (error, response, html) => {
					if (!error) {
						var $ = cheerio.load(html);

						imageLink = $('.film-poster').find('img')[0].attribs.src;

						console.log('thumbnail url: ' + imageLink)
						saveEmbed(imageLink)
					} else console.log(error);
				})
			}

			function saveEmbed(imageLink) {
				let ratingString = runtimeString = genreString = userString = '';
				if (!r[0].rating) {
					ratingString = 'No rating'
				} else {
					ratingString = `${r[0].rating.toFixed(1)}/10`
				}
				if (!r[0].runtime) {
					runtimeString = 'No runtime'
				} else {
					runtimeString = `${r[0].runtime} mins`
				}
				if (!r[0].genreOne) {
					genreString = 'No genre'
				} else if (!r[0].genreTwo) {
					genreString = `${r[0].genreOne}`
				} else {
					genreString = `${r[0].genreOne}, ${r[0].genreTwo}`
				}
				let userRec = msg.guild.members.find('id', r[0].userTag)
				if (userRec === null) {
					userString = ''
				} else {
					userString = `*Suggested by **${userRec.user.tag}***\n\n`
				}
				MOTD = {
					embed: {
						color: 0x6bb6d1,
						author: {
							name: `How about ${r[0].title}?`,
							icon_url: "https://image.flaticon.com/icons/png/512/236/236626.png"
						},
						thumbnail: {
							url: imageLink
						},
						fields: [
							{
								name: `About the film:`,
								value: `**Director:** ${r[0].director}  \n` +
									`**Release Year:** ${r[0].releaseYear}\n` +
									`**Genre${r[0].genreTwo === null ? "" : "s"}:** ${genreString}\n` +
									`**Runtime:** ${runtimeString}\n` +
									`**Rating:** ${ratingString}\n` +
									`[See More](${r[0].url})`,
								inline: true
							},
							{
								name: "Want to suggest your movie?",
								value: `Post your link in **#${recChannel.name}**!\n\n` +
									`**Not the droid you're looking for?**\n` +
									`Try **${tokens.PREFIX}randmovie** for a random film!\n\n` +
									`${userString}`,
								inline: true
							}
						],
						timestamp: new Date(),
						footer: {
							text: "BETA"
						}
					}
				}
				console.log(`Attempting to send embed for user ${msg.author.tag}`)
				msg.channel.send(MOTD)
					.then(console.log("Embed was sent!"))
					.catch(console.error());
			}
		})
	}
});

schedule.scheduleJob('0 0 * * *', () => {
	console.log("Setting embed (should be midnight)")
	setEmbed()
})

schedule.scheduleJob('0 4-20/4 * * *', () => {
	console.log(`Sending embed for ${Date.now()}`)
	sendEmbed();
})

let deleteStuff = (msg) => {
	let count = 0;
	msg.channel.fetchMessages({ limit: 100 })
		.then(messages => {
			let messagesArr = messages.array();
			let messageCount = messagesArr.length;

			for (let i = 0; i < messageCount; i++) {
				messagesArr[i].delete()
					.then(function () {
						count = count + 1;
						if (count >= 100) {
							deleteStuff();
						}
					})
					.catch(function () {
						count = count + 1;
						if (count >= 100) {
							deleteStuff();
						}
					})
			}
		})
		.catch(function (err) {
			console.log('error thrown');
			console.log(err);
		});
};

function setEmbed() {
	console.log(`Attempting to set a new movie of the day!`)
	let recChannel = client.channels.find('id', tokens.RECOMMENDATIONS_ID);
	let movieChannel = client.channels.find('id', tokens.CHANNEL_ID);
	let MOTD = {};
	con.query('CHECKSUM TABLE suggested, used', (error, rows, field) => {
		if (error) throw error;
		if (rows[0].Checksum == rows[1].Checksum) {
			console.log('Used database is full, deleting rows')
			con.query('DELETE QUICK FROM used');
		}
		getMovie()
	})
	function getMovie() {
		con.query('SELECT * FROM suggested WHERE title NOT IN (SELECT title FROM used) ORDER BY RAND() LIMIT 1', (e, r, f) => {
			if (e) throw e;
			console.log(`Random title selected:`);
			console.log(r[0]);
			var imageLink;

			if (r[0].url.includes('imdb.com')) {
				request(r[0].url, (error, response, html) => {
					if (!error) {
						var $ = cheerio.load(html);

						imageLink = $('.poster').find('img')[0].attribs.src;

						console.log('thumbnail url: ' + imageLink)
						saveEmbed(imageLink);
					} else console.log(error);
				})
			} else if (r[0].url.includes('letterboxd.com') || r[0].url.includes('boxd.it')) {
				request(r[0].url, (error, response, html) => {
					if (!error) {
						var $ = cheerio.load(html);

						imageLink = $('.film-poster').find('img')[0].attribs.src;

						console.log('thumbnail url: ' + imageLink)
						saveEmbed(imageLink)
					} else console.log(error);
				})
			}

			function saveEmbed(imageLink) {
				let ratingString = runtimeString = userString = genreString = '';
				if (!r[0].rating) {
					ratingString = 'No rating'
				} else {
					ratingString = `${r[0].rating.toFixed(1)}/10`
				}
				if (!r[0].runtime) {
					runtimeString = 'No runtime'
				} else {
					runtimeString = `${r[0].runtime} mins`
				}
				if (!r[0].genreOne) {
					genreString = 'No genre'
				} else if (!r[0].genreTwo) {
					genreString = `${r[0].genreOne}`
				} else {
					genreString = `${r[0].genreOne}, ${r[0].genreTwo}`
				}
				let userRec = recChannel.guild.members.find('id', r[0].userTag)
				if (userRec === null) {
					userString = ''
				} else {
					userString = `*Suggested by **${userRec.user.tag}***\n\n`
				}
				MOTD = {
					embed: {
						color: 0x6bb6d1,
						author: {
							name: `The Movie of the Day is ${r[0].title}`,
							icon_url: "https://image.flaticon.com/icons/png/512/236/236626.png"
						},
						thumbnail: {
							url: imageLink
						},
						fields: [
							{
								name: `About the film:`,
								value: `**Director:** ${r[0].director}\n` +
									`**Release Year:** ${r[0].releaseYear}\n` +
									`**Genre${r[0].genreTwo === null ? "" : "s"}:** ${genreString}\n` +
									`**Runtime:** ${runtimeString}\n` +
									`**Rating:** ${ratingString}\n` +
									`[See More](${r[0].url})`,
								inline: true
							},
							{
								name: "Want to suggest your movie?",
								value: `Post your link in **#${recChannel.name}**!\n\n` +
									`**Not the droid you're looking for?**\n` +
									`Try **${tokens.PREFIX}randmovie** for a random film!\n\n` +
									`${userString}`,
								inline: true
							}
						],
						timestamp: new Date(),
						footer: {
							text: "BETA"
						}
					}
				}

				console.log('Done with MOTD, letting user know their movie was picked')

				//Let user know their movie was picked
				let movieBoi = recChannel.guild.members.get(r[0].userTag);
				movieBoi.send(`Congratulations! **${r[0].title}** was picked as movie of the day!`, MOTD)
					.then(() => {
						console.log(`Attempting to write embed to file`)
						fs.writeFile('movie.json', JSON.stringify(MOTD), (err) => {
							if (err) throw (err);
							console.log(`Wrote movie to file successfully!`);
							console.log('Attempting to insert into used database')

							con.query(`INSERT INTO used VALUES ("${r[0].title}", "${r[0].director}", ${r[0].releaseYear}, ${r[0].runtime}, ${r[0].genreOne ? `"${r[0].genreOne}"` : null}, ${r[0].genreTwo ? `"${r[0].genreTwo}"` : null}, ${r[0].rating}, "${r[0].url}", "${r[0].userTag}")`, (error, results, fields) => {
								if (error) throw error;
								console.log(`Successfully entered into used DB, affected rows:  ${results.affectedRows}`);
							})
						})
					})
					.catch(console.error());
			}

		})
	}
}

function sendEmbed(idToSend = tokens.CHANNEL_ID) {
	let movieChannel = client.channels.find('id', idToSend);
	console.log('Attempting to read file')
	let embed;
	fs.readFile('movie.json', (err, data) => {
		if (err) throw err;

		embed = JSON.parse(data);

		console.log("Got embed from file, attempting to send")

		movieChannel.send(embed)
			.then(console.log('Sent embed to channel!'))
			.catch(console.error());
	});
}

function toUnicode(str) {
	return str.split('').map(function (value, index, array) {
		var temp = value.charCodeAt(0).toString(16).toUpperCase();
		if (temp.length > 2) {
			return '\\u' + temp;
		}
		return value;
	}).join('');
}

function ValidURL(str) {
	var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
	return regexp.test(str);
}

client.login(tokens.BOT_TOKEN);