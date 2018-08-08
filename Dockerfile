#
# Dockerfile for compare-layouts
#
# docker build -t uwegerdes/compare-layouts .

FROM uwegerdes/nodejs

MAINTAINER Uwe Gerdes <entwicklung@uwegerdes.de>

USER root

ENV COMPARE_LAYOUTS_HTTP 8080
ENV GULP_LIVERELOAD_PORT 8081

COPY package.json ${NODE_HOME}/

WORKDIR ${NODE_HOME}

RUN apt-get update && \
	apt-get dist-upgrade -y && \
	apt-get install -y \
				graphviz \
				imagemagick \
				libpng-dev \
				software-properties-common \
				xvfb && \
	add-apt-repository -y ppa:mozillateam/ppa && \
	apt-get update && \
	apt-get install -y firefox-esr && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/* && \
	npm install -g \
				casperjs \
				gulp \
				nodemon && \
	npm install -g git+https://github.com/laurentj/slimerjs.git#v0.10 && \
	npm install && \
	chown -R ${USER_NAME}:${USER_NAME} ${NODE_HOME}

ENV SLIMERJSLAUNCHER '/usr/bin/firefox-esr'

COPY entrypoint.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

COPY . ${APP_HOME}

RUN chown -R ${USER_NAME}:${USER_NAME} ${APP_HOME}

WORKDIR ${APP_HOME}

USER ${USER_NAME}

VOLUME [ "${APP_HOME}" ]

EXPOSE ${COMPARE_LAYOUTS_HTTP} ${GULP_LIVERELOAD_PORT}

CMD [ "npm", "start" ]

