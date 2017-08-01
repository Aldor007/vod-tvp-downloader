# vod-tvp-downloader
Downloads mp4 files from vod.tvp.pl

## Installation
```bash
$ git clone https://github.com/Aldor007/vod-tvp-downloader.git && cd vod-tvp-downloader
$ npm install
```

## Usage

You can use it in two ways:

Download single file:
```bash
$ ./crawler.js -u http://vod.tvp.pl/audycje/wiedza/jak-to-dziala/wideo/historie-pewnych-wynalazkow-cz-2/20180764  
```
or

Download list of videos defined in file. (Urls have to be separated by newline character)

```bash
$ node crawler.js -f links.url
```

## Licence
MIT
