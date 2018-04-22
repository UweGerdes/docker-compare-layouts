#!/bin/bash

# fix for installation failures on nodejs 8.11.1
export PATH=$PATH:/home/node/bin
if ! [ -x "$(command -v phantomjs)" ]; then
	echo "initial install phantomjs"
	cd "${NODE_HOME}"
	export NODE_TLS_REJECT_UNAUTHORIZED=0
	npm install phantomjs-prebuilt
	mkdir -p /home/node/bin/
	cp /home/node/node_modules/phantomjs-prebuilt/lib/phantom/bin/phantomjs /home/node/bin/
	cd "${APP_HOME}"
fi

if [ ! -w "${APP_HOME}/" ]; then
	echo "ERROR: ${APP_HOME}/ cannot write"
	exit 1
fi

cd "${APP_HOME}"
exec "$@"
