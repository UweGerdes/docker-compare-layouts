# Docker for compare-layouts

Regression testing for frontend developement

## Use Scenarios

You have a development web server running on your computer - perhaps in a virtual machine or another docker.

You want to make sure that only the layouts / elements change you expect to change.

You want to keep track of responsiveness.

This should be available with easy to use config files.

## Use Cases

You are styling a block on a web page. You have a style that should become better.

You want to see the changes compared to a previous version.

You want to check different screen widths.

You get a web ui to start the grabbing and show the results.

Differences between the old and new layout are highlighted, mouse moves should change the opacity.

Other page elements should not change, you are informed if they do.

Perhaps I can figure out how to configure a livereload to trigger an automatic start.

## Config File

The configuration file defines urls, viewport widths and page elements and how to compare them.

## Docker Build

Build the docker image with:

```bash
$ docker build -t uwegerdes/compare-layouts .
```

## Development

For the development time a gulpfile.js is included to generate css from less and restart the server.

```bash
$ docker run -it --rm \
	-v $(pwd):/home/node/dev \
	-p 3001:3000 \
	--name compare-layouts \
	uwegerdes/compare-layouts \
	bash
```

## Self Test

Start the docker container in this directory (with config and results directory):

```bash
$ docker run -it --rm \
	-v $(pwd):/home/node/app/config \
	-v $(pwd)/results:/home/node/app/results \
	-p 3001:3000 \
	--name compare-layouts \
	uwegerdes/compare-layouts \
	bash
```

## SlimerJS vs. Firefox

sudo vi /usr/lib/node_modules/slimerjs/src/application.ini

replace s/MaxVersion=52\.\*/MaxVersion=54.*/

