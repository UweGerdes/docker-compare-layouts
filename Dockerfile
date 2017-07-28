#
# Dockerfile for compare-layouts
#
# docker build -t uwegerdes/compare-layouts .

FROM uwegerdes/nodejs

MAINTAINER Uwe Gerdes <entwicklung@uwegerdes.de>

RUN apt-get update && \
	apt-get dist-upgrade -y && \
	apt-get install -y \
				firefox \
				xvfb && \
	rm -rf /var/lib/apt/lists/*

ENV NODE_ENV development
ENV HOME ${NODE_HOME}
ENV APP_HOME ${NODE_HOME}/app
ENV COMPARE_LAYOUTS_HTTP 3000
ENV GULP_LIVERELOAD 5082

COPY package.json ${NODE_HOME}/

RUN chown -R ${USER_NAME}:${USER_NAME} ${NODE_HOME}/package.json && \
	npm ${NPM_LOGLEVEL} ${NPM_PROXY} install -g \
				casperjs \
				gulp \
				phantomjs-prebuilt \
				slimerjs && \
	sed -i -e "s/MaxVersion=52\.\*/MaxVersion=54.*/" /usr/lib/node_modules/slimerjs/src/application.ini && \
	npm cache clean

WORKDIR ${NODE_HOME}

RUN npm ${NPM_LOGLEVEL} ${NPM_PROXY} install && \
	npm cache clean

COPY . ${APP_HOME}

RUN chown -R ${USER_NAME}:${USER_NAME} ${APP_HOME}

WORKDIR ${APP_HOME}

USER ${USER_NAME}

VOLUME [ "${APP_HOME}", "${APP_HOME}/config", "${APP_HOME}/results" ]

EXPOSE ${COMPARE_LAYOUTS_HTTP} ${GULP_LIVERELOAD}

#CMD [ "npm", "start" ]

CMD [ "/bin/bash" ]

