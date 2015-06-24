#!/usr/bin/env node
var Crawler = require('crawler');
var http = require('http');
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


var urls = [];

if (argv.url) {
    urls = argv.url;

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
        'callback': function (error, result, $) {
            if (error) {
                    return console.error('StrimsAPI/getContentOfStrims crawler error', error);
                }
            $('#desc > div.movieWrapper > iframe').each(function(index, data) {
                movieLinks.push($(data).attr('src'))

            });

            },
            'onDrain': function() {
                console.info('End of getting links to video');
                that._getMovieLinks(movieLinks, callback);
            },
            'userAgent': that._options.userAgent
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
        'callback': function (error, result, $) {
            if (error) {
                console.error('LinksGetter crawler error', error);
                return callback(error);
            }
            videoLinks.push(that._parseVideoLink(result, $));

            },
            'onDrain': function() {
                callback(null, videoLinks)
            },
            'userAgent': that._options.userAgent
    });
    for (var i = 0, len = links.length; i < len; i++) {
        c.queue(links[i]);
    };


};
/**
 * @brief Parse html and link to mp4 video
 * 
 * @param result {object} 
 * @param $ jQuery 
 */
LinkGetter.prototype._parseVideoLink = function (result, $) {
    var body = result.body;
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
  var request = http.get(url, function(response) {
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

        })
    }

}



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





