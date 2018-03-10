# MOTD-Bot
Discord bot aimed towards collecting user suggested films to suggest a new movie.

## About
The bot collects IMDB and Letterboxd film suggestions from users and recommends a random film from the database.

* **Film collection:**

![alt text](https://i.gyazo.com/1cebebe830f181531536f3447910ae12.png "Collecting user entry")


* **Movie suggestion:**

![alt text](https://i.gyazo.com/50e8608127c12228b4d17c43981ac653.png "Giving movie of the day")


* **Random suggestion:**

![alt text](https://i.gyazo.com/b265ac7b93cb3785f209371f4558679a.png "Suggesting random movie")


## Install Prerequisites

#### Install Git
1. Download Git for your system from the [Git website](https://git-scm.com/downloads).
2. Run the installer file and follow the instructions.
3. Verify your git install by opening a terminal and typing `git --version`.
4. Done for now! You can continue to the next section.

#### Install Node.js and NPM
1. Download the current Node.js and NPM bundle for your system from the [Node.js website](https://git-scm.com/downloads).
2. Run the installer file and follow the instructions.
3. Verify your Node.js and NPM install by typing `node -v` and `npm -v`, respectively.
4. Done for now! You can continue to the next section.

#### Install MySQL
1. Download the MySQL Community server from the [MySQL website](https://dev.mysql.com/downloads/mysql/).
2. Run the installer file and follow the instructions.
3. Copy the temp password at the last prompt, you will need this.
4. Run the command `mysql -u root -p` and enter the password you copied from the installer.
5. Once logged in to the root user, run `CREATE USER 'your_username' IDENTIFIED BY 'your_password';`

## Setup
1. Clone the repository to your machine using `git clone https://github.com/jnwarner/motd-bot.git`
2. Open the directory in a terminal and use the command `npm install` to install dependencies.
3. Log into the MySQL account made when installing mysql using the command `mysql -u your_username -p`
4. Run the db.sql file using `mysql -u your_username -p < /path/to/db.sql`, creating the tables for the bot.
5. Grant permissions to user using the command `GRANT PRIVILEGES ON movies.* TO 'your_username'@'localhost' IDENTIFIED BY 'your_password';`
6. Insert the necessary data in a file named tokens.json (reference can be found in tokens.example.json)
7. Done! You can start your bot using `node index.js` or use a process management service such as [PM2](http://pm2.keymetrics.io/) to run the bot!
