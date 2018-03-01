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

client.on('guildCreate', (guild) => {
    guild.owner.user.send("Ayo whas poppin :b:");
    console.log(`[GUILD UPDATE] (${date()} @${date(true)}):    Bot added, details:\n` +
        `        GUILD: ${guild.name}\n` +
        `        -  GUILD_ID: ${guild.id}\n` +
        `        OWNER: ${guild.owner.user.tag}\n` +
        `        -  OWNER_ID: ${guild.owner.user.id}`);
});

client.on('guildDelete', (guild) => {
    console.log(`[GUILD UPDATE] (${date()} @${date(true)}):    Bot kicked, details:\n` +
        `        GUILD: ${guild.name}\n` +
        `        -  GUILD_ID: ${guild.id}\n` +
        `        OWNER: ${guild.owner.user.tag}\n` +
        `        -  OWNER_ID: ${guild.owner.user.id}`);
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
                    .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not follow the content guidelines.\n```" + msg.content + "```"))
                    .catch(console.error);
            }
        } else {
            msg.delete()
                .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not follow the content guidelines.\n```" + msg.content + "```"))
                .catch(console.error);
        }
    }

    // Movie recommendations management
    else if (msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.RECOMMENDATIONS_ID) {

        var url = Array.from(getURL(msg.content));

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
                    if (url[0].includes('http://') || url[0].includes('https://')) {
                        scrapeURL();
                    } else {
                        msg.delete()
                            .then(msg => {
                                console.log(`Notifying ${msg.author.username} their message was deleted.`)
                                if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a valid link (http:// or https://).\n```" + msg.content + "```")
                            })
                            .catch(console.error);
                    }
                }
            })

        function scrapeURL() {

            if (url.length > 0) {
                request(url[0], (error, response, html) => {
                    if (error) console.log(error)
                    if (response.statusCode == 200) {
                        makeRequest();
                    } else {
                        console.log('Link was invalid, deleting message and notifying user')
                        msg.delete()
                            .then(message => message.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it is not a valid link.\n```" + msg.content + "```"))
                            .catch(console.error())
                    }
                })
                function makeRequest() {
                    if (url[0].includes('imdb.com/title/') && isUnique) {

                        if (url[0].includes('m.imdb.com')) url[0] = url[0].replace('m.', 'www.');

                        console.log(`[MOVIE REQUEST] (${date()} @${date(true)}): Making request for IMDB URL ${url[0]}, details:\n` +
                            `        GUILD: ${msg.guild.name}\n` +
                            `        -  GUILD_ID: ${msg.guild.id}\n` +
                            `        AUTHOR: ${msg.author.username}\n` +
                            `        -  OWNER_ID: ${msg.author.id}`);

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
                                    request(url[0], function (error, response, html) {
                                        if (!error) {

                                            var $ = cheerio.load(html);

                                            var title, director, release, rating;
                                            var results = { title: "", director: "", release: "", rating: "", url: url[0], user: msg.author.id };

                                            $('.title_wrapper').filter(function () {
                                                var data = $(this);

                                                title = data.children().first().text();

                                                results.title = title.trim().substring(0, title.indexOf('(') - 1);
                                            })

                                            $('span[itemprop="director"]').filter(function () {
                                                var data = $(this);

                                                director = data.text();

                                                results.director = director.trim();
                                            })

                                            $('#titleYear').filter(function () {
                                                var data = $(this);

                                                release = data.children().last().text();

                                                results.release = release.trim();
                                            })

                                            $('.ratingValue').filter(function () {
                                                var data = $(this);

                                                rating = data.text();

                                                results.rating = rating.trim().substring(0, 3) + '0';
                                            })

                                            console.log(results);

                                            if (results.rating == undefined || results.rating == '') {
                                                results.rating = 0.01;
                                                console.log(`There was no rating for this item, entering identifiable value for later`);
                                            }

                                            results.title = toUnicode(results.title);
                                            results.director = toUnicode(results.director);

                                            con.query(`SELECT title FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release}`, function (e, rows, fields) {
                                                if (e) console.log(e);
                                                if (rows.length == 0) {
                                                    console.log('Entry does not exist, inserting data into table')
                                                    con.query(`INSERT INTO suggested VALUES ("${results.title}", '${results.director}', ${results.release}, ${results.rating}, '${results.url}', '${results.user}')`, function (error, result, field, ) {
                                                        if (error) throw error;
                                                        console.log(`Success: affected rows: ${result.affectedRows}`);
                                                        msg.reply(`got it! **${results.title}** was added to the database!`)
                                                    });
                                                } else {
                                                    console.log('Entry exists, deleting message')
                                                    msg.delete()
                                                        .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been recommended.\n```" + msg.content + "```"))
                                                        .catch(console.error);
                                                }
                                            })
                                        } else {
                                            console.log(error)
                                        }
                                    });
                                } else {
                                    console.log('DELETING MESSAGE')
                                    msg.delete()
                                        .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not fit the content guidelines.\n```" + msg.content + "```"))
                                        .catch(console.error);
                                }
                            } else console.log(error)
                        })
                    } else if (url[0].includes('letterboxd.com/film/') && isUnique || url[0].includes('boxd.it') && isUnique) {
                        console.log(`[MOVIE REQUEST] (${date()} @${date(true)}): Making request for Letterboxd URL ${url[0]}, details:\n` +
                            `        GUILD: ${msg.guild.name}\n` +
                            `        -  GUILD_ID: ${msg.guild.id}\n` +
                            `        AUTHOR: ${msg.author.username}\n` +
                            `        -  AUTHOR_ID: ${msg.author.id}\n`);

                        if (url[0].includes('boxd.it')) {
                            console.log(`Attempting to expand url ${url[0]}`)
                            unshort(url[0], (err, url) => {
                                if (!err) {
                                    console.log(`Expansion on Letterboxd link successful! Expanded URL: ${url}`)
                                    url[0] = url;
                                } else console.log(`There was an error attempting to expand ${url[0]}:\n${err}`)
                            })
                        }

                        request(url[0], function (error, response, html) {
                            if (!error) {
                                var $ = cheerio.load(html);

                                var title, director, release, rating;
                                var results = { title: "", director: "", release: "", rating: "", url: url[0], user: msg.author.id };

                                $('.headline-1').filter(function () {
                                    var data = $(this);

                                    title = data.text();

                                    results.title = title.trim();
                                })

                                $('#featured-film-header').filter(function () {
                                    $('span.prettify').filter(function () {
                                        var data = $(this);

                                        director = data.text();

                                        results.director = director;
                                    })
                                })

                                $('.number').filter(function () {
                                    var data = $(this);

                                    release = data.text();

                                    results.release = release.trim();
                                })

                                $('.average-rating').filter(function () {
                                    var data = $(this);

                                    rating = data.children()[1].attribs.content;

                                    results.rating = rating.trim();
                                })

                                console.log(results)

                                if (results.rating == undefined || results.rating == '') {
                                    results.rating = 0.01;
                                    console.log(`There was no rating for this item, entering identifiable value for later`);
                                }
                                results.title = toUnicode(results.title)
                                results.director = toUnicode(results.director);

                                console.log(`Performing database precheck for ${results.title}`);

                                con.query(`SELECT title FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release}`, function (e, rows, fields) {
                                    if (e) console.log(e);
                                    if (rows.length == 0) {
                                        console.log('Entry does not exist, inserting data into table ')
                                        con.query(`INSERT INTO suggested VALUES ("${results.title}", "${results.director}", ${results.release}, ${results.rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
                                            if (error) throw error;
                                            console.log(`Success: affected rows: ${result.affectedRows}`);
                                            msg.reply(`got it! **${results.title}** was added to the database!`)
                                        });
                                    } else {
                                        console.log('Entry exists, deleting message')
                                        msg.delete()
                                            .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been recommended.\n```" + msg.content + "```"))
                                            .catch(console.error);
                                    }
                                })
                            } else {
                                console.log(error)
                            }
                        });
                    } else {
                        console.log('DELETING MESSAGE')
                        msg.delete()
                            .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not fit the content guidelines.\n```" + msg.content + "```"))

                            .catch(console.error);
                    }
                }
            } else {
                console.log('DELETING MESSAGE')
                msg.delete()
                    .then(msg => msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it does not fit the content guidelines.\n```" + msg.content + "```"))
                    .catch(console.error);
            }
        }
    }

    // MOVIE OF THE DAY COMMAND
    else if (msg.content.toLowerCase() == `${tokens.PREFIX}movie` && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('what should i watch') && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('what i should watch') && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('what movie should i watch') && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('what movie i should watch') && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('movie of the day') && msg.channel.id == tokens.CHANNEL_ID) {
        sendEmbed()
    }

    else if (msg.content.toLowerCase() == `${tokens.PREFIX}randmovie` && msg.channel.id == tokens.CHANNEL_ID || msg.content.toLowerCase().includes('netflix and chill') && msg.channel.id == tokens.CHANNEL_ID) {
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

                        console.log('Image link: ' + imageLink)
                        saveEmbed(imageLink);
                    } else console.log(error);
                })
            } else if (r[0].url.includes('letterboxd.com')) {
                request(r[0].url, (error, response, html) => {
                    if (!error) {
                        var $ = cheerio.load(html);

                        imageLink = $('.film-poster').find('img')[0].attribs.src;

                        console.log('Image link: ' + imageLink)
                        saveEmbed(imageLink)
                    } else console.log(error);
                })
            }

            function saveEmbed(imageLink) {
                let ratingString = '';
                if (r[0].rating == 0.01) {
                    ratingString = 'No rating for this title'
                } else {
                    ratingString = `${r[0].rating}/10`
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
                                value: `**Director:**   ${r[0].director}\n` +
                                    `**Release Year:**   ${r[0].releaseYear}\n` +
                                    `**Rating:**   ${ratingString}\n` +
                                    `[See More](${r[0].url})\n\n` +
                                    `***Suggested by*** <@${r[0].userTag}>`
                            },
                            {
                                name: '\u200b',
                                value: '\u200b'
                            },
                            {
                                name: "Not the droid you're looking for?",
                                value: `Type **${tokens.PREFIX}randmovie** to get another suggestion!`
                            },
                            {
                                name: '\u200b',
                                value: '\u200b'
                            },
                            {
                                name: 'I post a new movie here daily!',
                                value: `Want to submit your movie? Post your IMDB or Letterboxd link to ${recChannel}!`
                            }
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: "BETA"
                        }
                    }
                }
                msg.channel.send(MOTD);
            }
        })
    }

    // Set embed
    else if (msg.content.toLowerCase() == '!testset' && msg.author.id == tokens.ADMIN_ID) {
        setEmbed()
    }

    // Get embed
    else if (msg.content.toLowerCase() == '!testsend' && msg.author.id == tokens.ADMIN_ID) {
        sendEmbed()
    }
});

schedule.scheduleJob('0 0 * * *', () => {
    console.log("Setting embed (should be midnight)")
    setEmbed()
})

schedule.scheduleJob('0 0-20/4 * * *', () => {
    console.log(`Sending embed for ${Date.now()}`)
    sendEmbed();
})

function setEmbed() {
    console.log(`Attempting to set a new movie of the day!`)
    var recChannel = client.channels.find('id', tokens.RECOMMENDATIONS_ID);
    let MOTD = {};
    con.query('CHECKSUM TABLE suggested, used', (error, rows, field) => {
        if (error) throw error;
        if (rows[0].Checksum == rows[1].Checksum) {
            console.log('Used database is full, deleting rows')
            movieChannel.send("I've used up your suggestions, you may see duplicates.");
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

                        console.log('Image link: ' + imageLink)
                        saveEmbed(imageLink);
                    } else console.log(error);
                })
            } else if (r[0].url.includes('letterboxd.com')) {
                request(r[0].url, (error, response, html) => {
                    if (!error) {
                        var $ = cheerio.load(html);

                        imageLink = $('.film-poster').find('img')[0].attribs.src;

                        console.log('Image link: ' + imageLink)
                        saveEmbed(imageLink)
                    } else console.log(error);
                })
            }

            function saveEmbed(imageLink) {
                let ratingString = '';
                if (r[0].rating == 0.01) {
                    ratingString = 'No rating for this title'
                } else {
                    ratingString = `${r[0].rating}/10`
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
                                value: `**Director:**   ${r[0].director}\n` +
                                    `**Release Year:**   ${r[0].releaseYear}\n` +
                                    `**Rating:**   ${ratingString}\n` +
                                    `[See More](${r[0].url})\n\n` +
                                    `***Suggested by*** <@${r[0].userTag}>`
                            },
                            {
                                name: '\u200b',
                                value: '\u200b'
                            },
                            {
                                name: "Not the droid you're looking for?",
                                value: `Type **${tokens.PREFIX}randmovie** to get another suggestion!`
                            },
                            {
                                name: '\u200b',
                                value: '\u200b'
                            },
                            {
                                name: 'I post a new movie here daily!',
                                value: `Want to submit your movie? Post your IMDB or Letterboxd link to ${recChannel}!`
                            }
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: "BETA"
                        }
                    }
                }

                //Let user know their movie was picked
                let movieBoi = recChannel.guild.members.get(r[0].userTag);
                movieBoi.send(`Congratulations! Your movie suggestion **${r[0].title}** was picked as movie of the day!`)
                    .then("Message was sent to user!")
                    .catch(console.error());

                console.log(`Attempting to write embed to file`)
                fs.writeFile('movie.json', JSON.stringify(MOTD), (err) => {
                    if (err) throw (err);
                    console.log(`Wrote movie to file successfully!`);
                })
            }

            console.log('Inserting into used database')

            con.query(`INSERT INTO used VALUES ("${r[0].title}", "${r[0].director}", ${r[0].releaseYear}, ${r[0].rating}, "${r[0].url}", "${r[0].userTag}")`, (error, results, fields) => {
                if (error) throw error;
                console.log(`Successfully entered into used DB, affected rows:  ${results.affectedRows}`);
            })

        })
    }
}

function sendEmbed() {
    let movieChannel = client.channels.find('id', tokens.CHANNEL_ID);
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