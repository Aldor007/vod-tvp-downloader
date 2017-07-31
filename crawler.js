#!/usr/bin/env node
var Crawler = require('crawler');
var http = require('http');
var https = require('https');
var fs = require('fs');
var ProgressBar = require('progress');
var yargs = require('yargs')
    .usage('Usage $0 ')
    .alias('u', 'url')
    .string('u')
    .describe('u', 'link to vod.tvp.pl')

    .alias('f', 'file')
    .string('f')
    .nargs('file', 1)
    .describe('f', 'file with links to download')
    .help('h')
    .epilog('Have fun');
var argv = yargs.argv;

var URL_REGEXP = /(http|ftp|https):\/\/[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:\/~+#-]*[\w@?^=%&amp;\/~+#-])?/

var urls = [];

if (argv.url) {
    urls.push(argv.url);
} else if (argv.file) {
    var buf =   fs.readFileSync(argv.file, 'utf-8');
    var tmp = buf.split('\n');
    for (var i = 0; i < tmp.length; i++) {
        if(tmp[i] != '') {
            urls.push(tmp[i]);
        }
    }

} else {
    yargs.showHelp();
    process.exit(1);
}

// validate url
for (var i = 0, len = urls.length; i < len; ++i) {
    if (!urls[i].match(URL_REGEXP) || urls[i].indexOf('vod.tvp.pl') == -1) {
        console.error('Unsupported url %s!', urls[i]);
        process.exit(123);
    }
}

var LinkGetter = function  (options) {
    options = options ||  {};

    this._options = options;
    this._options.userAgent = options.userAgent || 'crawler';
};

/**
 * @brief Get links to video
 *
 * @param links {array} Array with links to parse
 * @param callback {function} callback
 *
 * @return [description]
 */
LinkGetter.prototype.run = function (links, callback) {
    var movieLinks = [];
    var that = this;
    var c = new Crawler({
        'maxConnections': 5,
        'callback': function (error, res, done) {
            var $ = res.$;
            if (error) {
                    return console.error('StrimsAPI/getContentOfStrims crawler error', error);
                }

            console.info('Status code', res.statusCode)
            $('iframe.fit-height').each(function(index, data) {
                console.log('Found link')
                movieLinks.push($(data).attr('src'))

            });
            done();
        },
        'userAgent': that._options.userAgent
        });

    c.on('drain',  function() {
            console.info('End of getting links to video');
            that._getMovieLinks(movieLinks, callback);
    });
    c.queue(links);
};

/**
 * @brief Get link to video file and title
 *
 * @param links {array} links from iframe
 * @param callback {function} callback
 *
 */
LinkGetter.prototype._getMovieLinks = function (links, callback) {
    var that = this;
    var videoLinks = [];
    console.info('LinkGetter/_getMovieLinks getting', links);
    var c = new Crawler({
        'maxConnections': 5,
        'callback': function (error, res, done) {
            if (error) {
                console.error('LinksGetter crawler error', error);
                return callback(error);
            }
            var $ = res.$;
            videoLinks.push(that._parseVideoLink(res, $));
            done();
        },
        'userAgent': that._options.userAgent
    });

    c.on('drain', function() {
        console.info('Video linkts', videoLinks)
        callback(null, videoLinks)
    });

    var vodLink = 'https://vod.tvp.pl/sess/tvplayer.php?object_id='
    for (var i = 0, len = links.length; i < len; i++) {

        var pathSplit = links[i].split('/')
        c.queue(vodLink + pathSplit.pop());
    };

};
/**
 * @brief Parse html and link to mp4 video
 *
 * @param result {object}
 * @param $ jQuery
 */
LinkGetter.prototype._parseVideoLink = function (res, $) {
    var body = res.body;
    var result = body.search(/1:\{src:\'[a-zA-Z0-9\.\-\:\/]+\',/);
    var link = '';
    var counter = 0;
    for (var i = result; i < body.length; i++) {
        if (body[i] == "'") {
            counter++;
        }
        if (counter == 1 && body[i] != '\'') {
            link = link + body[i];
        } else if (counter == 2) {
            break;
        }

    }
    var title = $('title').text();
    console.info('link = %s title = %s', link, title);
    return [link, title];

};

/**
 * @brief Download file and save as dest
 *
 * @param url {string}
 * @param dest {string}
 * @param cb   {function}
 */
var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var proto = http;
  if (url.indexOf('https://') > -1) {
    proto = https;
  }

  var request = proto.get(url, function(response) {
    console.info('Downloading', url, dest);
    var len = parseInt(response.headers['content-length'], 10);
    console.info();
    var bar = new ProgressBar('  downloading '+ dest +' [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: len
    });
    response.pipe(file);
    response.on('data', function (chunk) {
        bar.tick(chunk.length);
    });
    file.on('finish', function() {
        console.info('\nSaved %s as %s \n', url, dest);
        file.close(cb);  // close() is async, call cb after close completes.
    });
  });
}

/**
 * @brief Download list of files
 * @details [long description]
 *
 * @param links {array}
 * @param callback {function}
 */
var downloadList = function (links, callback) {
    var counter = 0;
    for (var i = 0, len = links.length; i < len; i++) {
        download(links[i][0], links[i][1] + '.mp4', function () {
            if (counter == links.length - 1) {
                console.info('Files downloaded');
                return callback();
            }
            counter++;
        });
    }
};

var vod = new LinkGetter({
    'userAgent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2427.7 Safari/537.36'
});

vod.run(urls, function (err, links) {
    if (err) {
        console.error('Error ', err);
        process.exit(12);
    }
    downloadList(links, function() {
        console.info('Job end!');
        process.exit(0);
    })

});
