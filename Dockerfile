#
# Dockerfile for compare-layouts
#
# docker build -t uwegerdes/compare-layouts .

FROM uwegerdes/nodejs

MAINTAINER Uwe Gerdes <entwicklung@uwegerdes.de>

USER root

RUN apt-get update && \
	apt-get dist-upgrade -y && \
	apt-get install -y \
				firefox \
				graphviz \
				imagemagick \
				libpng-dev \
				xvfb && \
	rm -rf /var/lib/apt/lists/*

ENV NODE_ENV development
ENV HOME ${NODE_HOME}
ENV APP_HOME ${NODE_HOME}/app
ENV COMPARE_LAYOUTS_HTTP 3000
ENV GULP_LIVERELOAD 5082

COPY package.json ${NODE_HOME}/

RUN chown -R ${USER_NAME}:${USER_NAME} ${NODE_HOME}/package.json && \
	npm install -g \
				casperjs \
				gulp \
				phantomjs-prebuilt \
				slimerjs && \
	echo "changing slimerjs MaxVersion to $(firefox --version | sed -r "s/[^0-9.]+([0-9]+)\..+/\1/").*" && \
	sed -i -e "s/MaxVersion=5.\.\*/MaxVersion=$(firefox --version | sed -r "s/[^0-9.]+([0-9]+)\..+/\1/").*/" /usr/lib/node_modules/slimerjs/src/application.ini && \
	npm cache clean

WORKDIR ${NODE_HOME}

RUN npm install && \
	chown -R node:node ${NODE_HOME} && \
	npm cache clean

COPY . ${APP_HOME}

RUN chown -R ${USER_NAME}:${USER_NAME} ${APP_HOME}

RUN ls -l ${APP_HOME}

WORKDIR ${APP_HOME}

USER ${USER_NAME}

VOLUME [ "${APP_HOME}", "${APP_HOME}/config", "${APP_HOME}/results" ]

EXPOSE ${COMPARE_LAYOUTS_HTTP} ${GULP_LIVERELOAD}

CMD [ "npm", "start" ]

