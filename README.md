[![Build Status](https://travis-ci.org/UweGerdes/docker-compare-layouts.svg?branch=master)](https://travis-ci.org/UweGerdes/docker-compare-layouts)

# Docker for compare-layouts

Regression testing for frontend developement

## Use Scenarios

You have a development web server running on your computer - perhaps in a virtual machine or another docker.

You want to make sure that only the layouts / elements change you expect to change.

You want to keep track of responsiveness.

This should be available with easy to use config files.

## Use Cases

You are styling a block on a web page. You have a layout to improve and want to check the progress.

You want to see the changes compared to a previous version.

You want to check different screen widths.

## Integrated Server

You get a web ui to start the grabbing and show the results.

Differences between the old and new layout are highlighted, mouse moves should change the opacity.

Other page elements should not change, you are informed if they do.

## Config File

The configuration file defines urls, viewport widths and page elements and how to compare them.

## Docker Build

Build the docker image with:

```bash
$ docker build -t uwegerdes/compare-layouts .
```

## Development / Self Test

For the development time a gulpfile.js is included to generate css from less and restart the server.

```bash
$ docker run -it \
	-v $(pwd):/home/node/app \
	--name compare-layouts-dev \
	uwegerdes/compare-layouts \
	bash
```

Run `gulp` or `npm test` in the container.

To restart the container use:

```bash
$ docker start -ai compare-layouts-dev
```

## Usage

Start the docker container in your project test directory (with tests/compare-layouts directory):

```bash
$ docker run -d \
	-v $(pwd)/modules:/home/node/app/config/modules \
	--name compare-layouts \
	uwegerdes/compare-layouts
```

The container starts in background, you might want to use some of these commands:

```bash
$ docker exec -it compare-layouts bash
$ docker logs -f compare-layouts
```

To restart the container use:

```bash
$ docker start -ai compare-layouts
```

Open the server address listed in the output. Read content.

To use a virtual hostname with ip in the config file you should map it to the container with `--add-host apphostname:192.168.1.10`. Perhaps allow firewall rule for docker ip network.

You may experience different behaviour if the result subdirectories are created:

- because gulp knows nothing about the new index.json - it will not livereload
- the default task app-slimerjs-cached-slimerjs will succeed the first time and fail if result cache is filled

Just restart gulp to have the full experience.

## Self Test

Start the docker container in directory with a `./results/` directory:

```bash
$ docker run -it --rm \
	-v $(pwd)/results:/home/node/app/results \
	uwegerdes/compare-layouts \
	npm test
```

You will find a lot of files (the cache for the server app) in a subdirectory of `./results/`.

## Changelog

0.5.4: use firefox-esr and slimerjs v0.10

0.5.3: bug fixing, better logging, integration in other project

0.5.2: refactoring
