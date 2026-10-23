"""Shared MySQL connection settings for ETL and verification."""

import os

import pymysql

MYSQL_HOST = "yba-database.c30igyqguxod.us-west-1.rds.amazonaws.com"
MYSQL_USER = "admin"
MYSQL_DATABASE = "yba"


def create_mysql_connection():
    return pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=os.getenv("SECRETS_MANAGER_CONTRASENA"),
        database=MYSQL_DATABASE,
    )
