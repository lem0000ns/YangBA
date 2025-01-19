# YangBA

Welcome to the YangBA! This site provide data-driven insights into different facets of the NBA, including a player ranking system and individual player statistics given a set of criteria. Unique player profiles are also featured, containing information such as each player's career awards, teams played on, body measurements, and more.

There are currently three different types of functionalities that the YangBA supports: Stats, Games, and Rank.

1. The "Stats" component retrives a single stat from an individual player, such as "Most 3PM Stephen Curry has made in 2017" or "What is the least amount of assists Lebron James had in a game where he scored more than 40 points?"
2. The "Games" component returns a series of statlines that fit within a certain criteria, given by the user. For example, it can show all statlines of players in which they've scored more than 50 points, or all games from a specific player in which they had more than 10 threes.
3. The "Rank" component ranks a series of players based on a certain criteria, given by the user. For example, if the user wanted to know the top 10 players based on free-throw efficiency or the worst 10 players in terms of points per game, they would choose this component.

Additionally, there is a custom bonus stat called "OPI" (Offensive Performance Index) that was created to place a single value for a particular player's statline. Factors that contribute to OPI include points, efficiency, assists, turnovers, minutes played, and total points scored by the team. OPI values were normalized such that all values fall between 0 to 1.

## Images

### Home page, examples page

![ezgif com-speed](https://github.com/user-attachments/assets/690b0e02-57b1-46db-b7bc-f1b16196c381)

### Stephen Curry's average points per game in 2017 (includes all games)

![ezgif com-speed](https://github.com/user-attachments/assets/b4681013-9f44-4313-ae83-4050a5281798)

### Player profile for Immanuel Quickley

![ezgif com-speed (1)](https://github.com/user-attachments/assets/2d7d2ae2-93eb-4a96-a804-f6069406e4e5)

## Backend + Frontend Development

All player/game data are retrieved from the NBA API. Python scripts were written to automate this process every 24 hours, ensuring its access and scope to the most recent information available. Player information from Wikipedia, which is later used to implement the player profile component in the frontend, is also webscraped on an automated process. API routes are handled by AWS API Gateway, in which it reads a series of query string parameters and returns a result based on those parameters.

React.js and HTML/CSS were primarily used in frontend development. When a user first opens the website, there is a home page that introduces each of 3 separate "paths" or tools that the user can choose to query a specific type of stat. Specifically, there is the "Stats," "Games," and "Rank" component that queries a specific stat from an individual player, lists out different statlines that satisfy given criteria, and ranks players based on given criteria, respectively.

## Tech Stack

Bootstrap, Axios, NPM, JSON, MySQL, Boto3, Beautiful Soup, AWS (Lambda, S3, API Gateway, Cloudfront, RDS, EC2), Threading
