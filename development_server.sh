#!/bin/sh

PHP_CLI_SERVER_WORKERS=16 php -S 0.0.0.0:8000 -d upload_max_filesize=200M -d post_max_size=200M
