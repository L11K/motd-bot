CREATE DATABASE movies;

USE movies;

CREATE TABLE suggested (title VARCHAR(255), director VARCHAR(255), releaseYear INT, runtime INT, genreOne VARCHAR(255), genreTwo VARCHAR(255), rating FLOAT(4, 2), url VARCHAR(255), userTag VARCHAR(255));

CREATE TABLE used (title VARCHAR(255), director VARCHAR(255), releaseYear INT, runtime INT, genreOne VARCHAR(255), genreTwo VARCHAR(255), rating FLOAT(4, 2), url VARCHAR(255), userTag VARCHAR(255));