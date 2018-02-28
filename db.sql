CREATE DATABASE movies;

USE movies;

CREATE TABLE suggested (title VARCHAR(255), director VARCHAR(255), releaseYear INT, rating FLOAT(4, 2), url VARCHAR(255), userTag VARCHAR(255));

CREATE TABLE used (title VARCHAR(255), director VARCHAR(255), releaseYear INT, rating FLOAT(4, 2), url VARCHAR(255), userTag VARCHAR(255));