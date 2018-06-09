'use strict';

const Discord = require("discord.js");
const client = new Discord.Client();
let fs = require('fs');
let util = require('util');
let tokens = require('./tokens.json')
let getURL = require('get-urls');
let imdb = require('imdb-api')
let mysql = require('mysql');
let schedule = require('node-schedule');
let unshort = require('unshort');

let suggestionLimiter = {};

let con = mysql.createConnection({
  host: tokens.DB_HOST,
  user: tokens.DB_USER,
  password: tokens.DB_PSWD,
  database: tokens.DB_NAME
});

con.connect(function (err) {
  if (err) throw err;
  console.log("Connected to database!");
});

schedule.scheduleJob('0 * * * *', () => {
  suggestioncLimiter = {}
})

schedule.scheduleJob('0 0 * * *', () => {
  console.log("Setting embed (should be midnight)")
  setEmbed()
})


schedule.scheduleJob('0 4-20/4 * * *', () => {
  console.log(`Sending embed for ${Date.now()}`)
  sendEmbed();
})

client.login(tokens.BOT_TOKEN);

client.on('ready', () => {
  console.log(`[INIT] (${date()} @${date(true)}): Logged into ${client.user.tag}\n` +
    `    Guilds being moderated:`);
  client.user.setActivity(`MOTD | ${tokens.PREFIX}movie`, { type: 'WATCHING' });
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
  // Set embed
  if (msg.content.toLowerCase() == '!testset' && msg.author.id == tokens.ADMIN_ID) {
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

  else if (msg.content.toLowerCase() === '!help' && msg.channel.id === tokens.CHANNEL_ID) {
    helpEmbed = {
      embed: {
        color: 0x6bb6d1,
        author: {
          name: `Bot Usage`,
          icon_url: "https://image.flaticon.com/icons/png/512/236/236626.png"
        },
        fields: [
          {
            name: 'Commands',
            value: '`!movie`  - Get current movie of the day\n`!randmovie`  - Get a random film (WIP)\n`!top`  - Get top suggestors\n`!stats [@user]`  - Get you or a user\'s stats\n\n'
          }
        ],
        timestamp: new Date(),
        footer: {
          text: "BETA"
        }
      }
    }
    msg.channel.send(helpEmbed).then('Sent help embed for user!');
  }

  // Letterboxd channel management
  else if (msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.LETTERBOXD_ID) {
    if (msg.content.includes('letterboxd.com') || msg.content.includes('boxd.it')) {
      let urlPosted = Array.from(getURL(msg.content));
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

  else if (msg.content.toLowerCase().includes(`${tokens.PREFIX}stats`) && msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.CHANNEL_ID && !msg.author.bot) {
    con.query(`SELECT userTag, COUNT(*) AS numMovies FROM suggested GROUP BY userTag ORDER BY 2 DESC`, (err, rows, field) => {
      console.log(`[RANKS] Stats command issued\n    User: ${msg.author.tag}\n    Content: ${msg.content}`);
      if (!err) {
        if (rows.length > 0) {
          let userID = null;
          let invalidUser = false;
          if (msg.content === `${tokens.PREFIX}stats`) {
            console.log('User getting own rank')
            userID = msg.author.id;
          } else if (msg.content.includes('<@')) {
            console.log('User looking for member\'s rank');
            userID = msg.content.substring((msg.content.indexOf('@') + 1), msg.content.indexOf('>'))
            if (userID.includes('!')) userID = userID.substring(1, userID.length);
          } else {
            console.log('User not found, marking as invalid')
            invalidUser = true;
          }
          if (!invalidUser) {
            if (userID === tokens.BOT_ID) {
              console.log('User is looking for bot\'s stats')
              let userObj = msg.guild.members.find('id', userID);
              con.query('SELECT COUNT(DISTINCT title) AS numMovies FROM suggested', (error, rows, field) => {
                if (!error) {
                  let statsObj = []
                  statsObj.push({ name: `Movie Count: ${rows[0].numMovies}`, value: '\u200b' });

                  con.query('SELECT x.title, COUNT(*) AS top FROM suggested as x, suggested as y WHERE x.title = y.title && x.director = y.director && x.userTag != y.userTag GROUP BY x.title ORDER BY top DESC LIMIT 3', (e, r, f) => {
                    if (!e) {
                      statsObj.push({ name: 'Top Suggested:', value: '', inline: true })
                      for (let i = 0; i < r.length; i++) {
                        statsObj[1].value += `${i + 1}. __**${r[i].title}**__\n  *Suggested by **${r[i].top}** user${r[i].top > 1 ? 's' : ''}*\n`;
                      }

                      con.query('select genreOne, count(distinct title) as count from suggested group by genreOne order by 2 desc limit 3', (err, ro, fi) => {
                        if (err) throw err;
                        statsObj.push({ name: 'Top Genres:', value: '', inline: true }) ``
                        for (let i = 0; i < ro.length; i++) {
                          statsObj[2].value += `${i + 1}. **${ro[i].genreOne}**: **${ro[i].count}** movie${ro[i].count > 1 ? 's' : ''}\n\n`;
                        }
                        rankEmbed = {
                          embed: {
                            color: 0x6bb6d1,
                            author: {
                              name: `Stats for ${userObj.user.tag}`,
                              icon_url: userObj.user.avatarURL
                            },
                            fields: statsObj,
                            timestamp: new Date(),
                            footer: {
                              text: "BETA"
                            }
                          }
                        }
                        msg.channel.send(rankEmbed).then('Sent embed for user!');
                      })
                    }
                  })
                }
              });
            } else {
              let userObj = msg.guild.members.find('id', userID);
              console.log(`Getting rank information for ${userObj.user.tag}`)
              let userMovie;
              let rankIndex;
              let userSuggested = false;
              for (let i = 0; i < rows.length; i++) {
                if (rows[i].userTag === userID) {
                  console.log(`ID ${rows[i].userTag} found! ${rows[i].numMovies} movie(s) posted!`)
                  userSuggested = true;
                  userMovie = rows[i];
                  rankIndex = i;
                }
              }
              if (userSuggested) {
                con.query(`select x.genre, x.genreCount + y.genreCount as genreTotal from (select genreOne as genre, count(*) as genreCount from suggested where userTag='${userID}' group by genreOne order by genreCount desc) as x join (select genreTwo as genre, count(*) as genreCount from suggested where userTag='${userID}' group by genreTwo order by genreCount desc) as y on x.genre = y.genre order by genreTotal desc;`, (err, topgenres, field) => {
                  if (err) throw err;
                  con.query(`select avg(runtime) as avgRuntime, avg(rating) as avgRating, avg(releaseYear) as avgRelease from suggested where userTag='${userID}'`, (e, data, f) => {

                    let genreObj = { name: 'Top Genres: ', value: '', inline: true };
                    let genreArr = topgenres.slice(0, 3);
                    let runtime = data[0].avgRuntime;
                    let rating = data[0].avgRating;
                    let release = data[0].avgRelease;

                    for (let i = 0; i < genreArr.length; i++) {
                      genreObj.value += `**${i + 1}.** ${genreArr[i].genre}\n`
                    }

                    genreObj.value += '\n';

                    let rankEmbed = {
                      embed: {
                        color: 0x6bb6d1,
                        author: {
                          name: `Stats for ${userObj.user.tag}`,
                          icon_url: userObj.user.avatarURL
                        },
                        fields: [
                          {
                            name: `Suggested ${userMovie.numMovies} movie${userMovie.numMovies > 1 ? 's' : ''}`,
                            value: `Rank **${rankIndex + 1}/${rows.length}**\n\u200b`
                          },
                          {
                            name: 'User Averages',
                            value: `Runtime: **${Math.round(runtime)}** minutes\nRating: **${rating.toFixed(1)}/10**\nRelease Year: **${Math.round(release)}**\n\n`,
                            inline: true
                          },
                          genreObj
                        ],
                        timestamp: new Date(),
                        footer: {
                          text: 'BETA'
                        }
                      }
                    };
                    msg.channel.send(rankEmbed).then('Sent embed for user!');
                  });
                });
              } else {
                console.log('User not found in Movies database');
                if (msg.author.id === userID) {
                  msg.reply(`I don't have any recommendations from you! Head over to ${msg.guild.channels.find('id', tokens.RECOMMENDATIONS_ID)} and post your film link!`);
                } else {
                  msg.channel.send(`I don't have any recommendations from **${userObj.user.username}**!`);
                }
              }
            }
          } else {
            console.log('No user specified');
            msg.reply('I was unable to get a user from your message! If you\'re looking for a user\'s rank, type `!stats @User`');
          }
        } else {
          console.log('Movies db is empty');
          msg.channel.send('No movies have been recommended!');
        }
      }
    });
  }

  else if (msg.content.toLowerCase() === '!top' && msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.CHANNEL_ID && !msg.author.bot) {
    con.query('SELECT userTag, COUNT(*) AS numMovies FROM suggested GROUP BY userTag ORDER BY 2 DESC LIMIT 3', (err, rows) => {
      if (!err) {
        console.log(rows);
        let topRecs = [];
        let members = msg.guild.members;
        for (let i = 0; i < rows.length; i++) {
          if (members.find('id', rows[i].userTag)) {
            let memVar = members.find('id', rows[i].userTag);
            topRecs.push({ 'name': `${i + 1}. ${memVar.user.tag}`, 'value': `${rows[i].numMovies} movie${rows[i].numMovies > 1 ? 's' : ''}\n\u200b` });
          } else {
            console.log('User not found, excluding from array');
          }
        }
        if (topRecs.length > 0) {
          let topEmbed = {
            embed: {
              color: 0x6bb6d1,
              author: {
                name: `Top Suggestors`,
                icon_url: "https://image.flaticon.com/icons/png/512/236/236626.png"
              },
              fields: topRecs,
              timestamp: new Date(),
              footer: {
                text: "BETA"
              }
            }
          };
          msg.channel.send(topEmbed);
        }
      } else {
        throw err;
      }
    });
  }

  // MOVIE OF THE DAY COMMAND
  else if ((msg.content.toLowerCase() === `${tokens.PREFIX}movie` && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID)) ||
    (msg.content.toLowerCase().includes('what should i watch') && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID)) ||
    (msg.content.toLowerCase().includes('what i should watch') && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID)) ||
    (msg.content.toLowerCase().includes('what movie should i watch') && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID)) ||
    (msg.content.toLowerCase().includes('what movie i should watch') && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID))) {
    console.log(`[MOTD REQUEST] (${date()} @${date(true)}): Sending the movie of the day, details:\n` +
      `        AUTHOR: ${msg.author.username}\n` +
      `        -  AUTHOR_ID: ${msg.author.id}`);
    sendEmbed(msg.channel.id);
  }

  else if ((msg.content.toLowerCase() === `${tokens.PREFIX}randmovie` && (msg.channel.id === tokens.CHANNEL_ID || msg.channel.id === tokens.BAV_ID) && !msg.author.bot) ||
    (msg.content.toLowerCase().includes('netflix and chill') && !msg.author.bot)) {
    console.log(`[RANDMOVIE REQUEST] (${date()} @${date(true)}): Sending random movie, details:\n` +
      `        AUTHOR: ${msg.author.username}\n` +
      `        -  AUTHOR_ID: ${msg.author.id}`);
    let recChannel = client.channels.find('id', tokens.RECOMMENDATIONS_ID);
    msg.reply('let me see what I can find...')
      .then(console.log(`Getting random movie for ${msg.author.tag}`))
      .catch(console.error());
    let MOTD = {};
    con.query('SELECT * FROM suggested ORDER BY RAND() LIMIT 1', (e, r) => {
      if (e) {
        throw e;
      }
      console.log('Random title selected:');
      console.log(r[0]);
      let usersSuggested = [];
      con.query(`SELECT userTag FROM suggested WHERE title="${r[0].title}" AND releaseYear=${r[0].releaseYear}`, (err, rows) => {
        if (!err) {
          usersSuggested = rows;
        }
      });
      let imageLink;

      if (r[0].url.includes('imdb.com')) {
        request(r[0].url, (error, response, html) => {
          if (!error) {
            let $ = cheerio.load(html);

            imageLink = $('.poster').find('img')[0].attribs.src;

            console.log('thumbnail url: ' + imageLink)
            saveEmbed(imageLink);
          } else console.log(error);
        })
      } else if (r[0].url.includes('letterboxd.com') || r[0].url.includes('boxd.it')) {
        request(r[0].url, (error, response, html) => {
          if (!error) {
            let $ = cheerio.load(html);

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
          if (usersSuggested.length > 1) {
            userString = `*Suggested by **${usersSuggested.length}** users*`
          } else {
            userString = `*Suggested by **${userRec.user.tag}***\n\n`
          }
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

  // Movie recommendations management
  else if (msg.author.id !== tokens.BOT_ID && msg.channel.id === tokens.RECOMMENDATIONS_ID && !msg.author.bot) {

    let url = Array.from(getURL(msg.content));

    console.log(url.length)

    let isUnique = true;

    msg.channel.fetchMessages()
      .then(messages => {
        console.log("Performing message duplicate check")
        console.log(`Got ${messages.size} messages`);
        if (!messages.some(message => {
          if (msg.content === message.content && msg.id !== message.id && msg.author.id === message.author.id) {
            console.log("Check Failed, message has already been posted.")
            console.log(`Message sent: ${msg.content} from ${msg.author.username}`)
            console.log(`Message posted: ${message.content} from ${message.author.username}`)
            isUnique = false;
            msg.delete()
              .then(msg => {
                console.log(`Notifying ${msg.author.username} their message was deleted.`)
                if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has already been posted in this channel.\n```" + msg.content + "```")
              })
              .catch(console.error)
            return true
          }
        })) {
          console.log(`Message is unique, attempting to scrape URL`)
          if (url.length > 0) {
            console.log(typeof (suggestionLimiter[msg.author.id]));
            if (typeof (suggestionLimiter[msg.author.id]) === 'number') {
              if (suggestionLimiter[msg.author.id] >= 5) {
                console.log('User has been rate limited');
                return msg.delete()
                  .then(message => { if (!message.author.bot) message.author.send("The following message has been deleted from **#" + msg.channel.name + "** as you have been rate limited. Try again at the top of the next hour.\n```" + msg.content + "```") })
                  .catch(console.error())
              }
              scrapeURL()
            } else {
              console.log('Adding user limiter')
              suggestionLimiter[msg.author.id] = 0;
              scrapeURL()
            }
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

              let id = url.substring(url.indexOf('/tt') + 1, url.indexOf('/tt') + 10)
              console.log(id)

              imdb.getById(id, { apiKey: '254a67b0', timeout: '30000' }).then((response) => {
                console.log(response)

                let currentTime = new Date()

                if (response.year > currentTime.getFullYear()) {
                  futureRelease = true
                } else {
                  console.log('Trying to compare dates')
                  let releaseDate = new Date(datePublished)
                  if (releaseDate > currentTime) {
                    console.log("Hasn't been released yet")
                    futureRelease = true
                  }
                }

                if (response.year) {
                  console.log(`Movie is a future release, denying`)
                  msg.delete()
                    .then(msg => { if (!msg.author.bot) msg.author.send("The following message has been deleted from **#" + msg.channel.name + "** as it has not been released yet.\n```" + msg.content + "```") })
                    .catch(console.error);
                }

                if (!futureRelease) {
                  // Todo : Checks for items with slightly different titles
                  con.query(`SELECT * FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release} OR director="${results.director}" AND runtime=${results.runtime} AND releaseYear=${results.release}`, function (e, rows, fields) {
                    if (e) console.log(e);
                    if (rows.length == 0) {
                      console.log('Entry does not exist, inserting data into table')
                      con.query(`INSERT INTO suggested VALUES ("${results.title}", "${results.director}", ${results.release}, ${results.runtime}, ${results.genreOne ? `"${results.genreOne}"` : null}, ${results.genreTwo ? `"${results.genreTwo}"` : null}, ${results.rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
                        if (error) throw error;
                        console.log(`Success: affected rows: ${result.affectedRows}`);
                        suggestionLimiter[msg.author.id] += 1;
                        msg.reply(`got it! **${results.title}** was added to the database!`)
                      });
                    } else {
                      console.log('Entry exists, checking for duplicate user')
                      let duplicateUser = false;
                      for (let i = 0; i < rows.length; i++) {
                        if (rows[i].userTag === msg.author.id) {
                          duplicateUser = true;
                        }
                      }
                      if (!duplicateUser) {
                        console.log('No duplicate user, inserting data into table ')
                        con.query(`INSERT INTO suggested VALUES ("${rows[0].title}", "${rows[0].director}", ${rows[0].releaseYear}, ${rows[0].runtime}, ${rows[0].genreOne ? `"${rows[0].genreOne}"` : null}, ${rows[0].genreTwo ? `"${rows[0].genreTwo}"` : null}, ${rows[0].rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
                          if (error) throw error;
                          console.log(`Success: affected rows: ${result.affectedRows}`);
                          suggestionLimiter[msg.author.id] += 1
                          msg.reply(`got it! **${rows[0].title}** was added to the database!`);
                        });
                      } else {
                        console.log('User tried posting same film, deleting')
                        msg.delete()
                          .then(message => { if (!message.author.bot) msg.author.send("The following message has been deleted from **#" + message.channel.name + "** as it has already been recommended by you.\n```" + message.content + "```") })
                          .catch(console.error)
                      }
                    }
                  })
                }
              }).catch(console.error)
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
                  let $ = cheerio.load(html);

                  let title, director, release, runtime, genre, rating;
                  let futureRelease = false;
                  let genres = [];
                  let results = { title: "", director: "", runtime: "", genreOne: "", genreTwo: "", release: "", rating: "", url: url[0], user: msg.author.id };

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

                        con.query(`SELECT * FROM suggested WHERE title="${results.title}" AND releaseYear=${results.release} OR director="${results.director}" AND runtime=${results.runtime} AND releaseYear=${results.release}`, function (e, rows, fields) {
                          if (e) console.log(e);
                          if (rows.length == 0) {
                            console.log('Entry does not exist, inserting data into table ')
                            con.query(`INSERT INTO suggested VALUES ("${results.title}", "${results.director}", ${results.release}, ${results.runtime}, ${results.genreOne ? `"${results.genreOne}"` : null}, ${results.genreTwo ? `"${results.genreTwo}"` : null}, ${results.rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
                              if (error) throw error;
                              console.log(`Success: affected rows: ${result.affectedRows}`);
                              suggestionLimiter[msg.author.id] += 1
                              msg.reply(`got it! **${results.title}** was added to the database!`)
                            });
                          } else {
                            console.log('Entry exists, checking for duplicate user')
                            let duplicateUser = false;
                            for (let i = 0; i < rows.length; i++) {
                              if (rows[i].userTag === msg.author.id) {
                                duplicateUser = true;
                              }
                            }
                            setTimeout(() => {

                              if (!duplicateUser) {
                                console.log(rows)
                                console.log('No duplicate user, inserting data into table ')
                                con.query(`INSERT INTO suggested VALUES ("${rows[0].title}", "${rows[0].director}", ${rows[0].releaseYear}, ${rows[0].runtime}, ${rows[0].genreOne ? `"${rows[0].genreOne}"` : null}, ${rows[0].genreTwo ? `"${rows[0].genreTwo}"` : null}, ${rows[0].rating}, "${results.url}", "${results.user}")`, function (error, result, field) {
                                  if (error) throw error;
                                  console.log(`Success: affected rows: ${result.affectedRows}`);
                                  suggestionLimiter[msg.author.id] += 1;
                                  msg.reply(`got it! **${rows[0].title}** was added to the database!`);
                                });
                              } else {
                                console.log('User tried posting same film, deleting')
                                msg.delete()
                                  .then(message => { if (!message.author.bot) msg.author.send("The following message has been deleted from **#" + message.channel.name + "** as it has already been recommended by you.\n```" + message.content + "```") })
                                  .catch(console.error);
                              }
                            }, 1000)
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
    con.query('SELECT * FROM suggested WHERE (title, releaseYear) NOT IN (SELECT title, releaseYear FROM used) ORDER BY RAND() LIMIT 1', (e, r, f) => {
      if (e) throw e;
      if (r[0]) {
        console.log(`Random title selected:`);
        console.log(r[0]);
        let usersSuggested = [];
        con.query(`SELECT userTag FROM suggested WHERE title="${r[0].title}" AND releaseYear=${r[0].releaseYear}`, (err, rows, fields) => {
          if (!err) {
            usersSuggested = rows;
          }
        });
        let imageLink;

        if (r[0].url.includes('imdb.com')) {
          request(r[0].url, (error, response, html) => {
            if (!error) {
              let $ = cheerio.load(html);

              imageLink = $('.poster').find('img')[0].attribs.src;

              console.log('thumbnail url: ' + imageLink)
              saveEmbed(imageLink);
            } else console.log(error);
          })
        } else if (r[0].url.includes('letterboxd.com') || r[0].url.includes('boxd.it')) {
          request(r[0].url, (error, response, html) => {
            if (!error) {
              let $ = cheerio.load(html);

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
            if (usersSuggested.length > 1) {
              userString = `*Suggested by **${usersSuggested.length}** users*`
            } else {
              userString = `*Suggested by **${userRec.user.tag}***\n\n`
            }
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

          // Let user know their movie was picked
          let movieBoi;
          for (let i = 0; i < usersSuggested.length; i++) {
            movieBoi = recChannel.guild.members.get(usersSuggested[i].userTag);
            console.log(`Sending notification for ${movieBoi.user.tag}`)
            movieBoi.send(`Congratulations! **${r[0].title}** was picked as movie of the day!`, MOTD)
          }
          setTimeout(() => {
            console.log('Attempting to insert into data file')
            fs.writeFile('movie.json', JSON.stringify(MOTD), (err) => {
              if (err) throw (err);
              console.log(`Wrote movie to file successfully!`);
              console.log('Attempting to insert into used database')
              con.query(`INSERT INTO used VALUES ("${r[0].title}", "${r[0].director}", ${r[0].releaseYear}, ${r[0].runtime}, ${r[0].genreOne ? `"${r[0].genreOne}"` : null}, ${r[0].genreTwo ? `"${r[0].genreTwo}"` : null}, ${r[0].rating}, "${r[0].url}", "${r[0].userTag}")`, (error, results, fields) => {
                if (error) throw error;
                console.log(`Successfully entered into used DB, affected rows:  ${results.affectedRows}`);
              })
            })
          }, 1000)
        }
      } else {
        console.log('Used database is full, deleting rows')
        con.query('DELETE QUICK FROM used')
        getMovie()
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
    let temp = value.charCodeAt(0).toString(16).toUpperCase();
    if (temp.length > 2) {
      return '\\u' + temp;
    }
    return value;
  }).join('');
}

function ValidURL(str) {
  let regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
  return regexp.test(str);
}