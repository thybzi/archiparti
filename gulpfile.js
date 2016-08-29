'use strict';
var gulp = require('gulp'),
    nodepath = require('path'),
    async = require('async'),
    sequence = require('run-sequence'),
    fs = require('fs-extra'),
    crypto = require('crypto'),
    less = require('gulp-less'),
    stripCssComments = require('gulp-strip-css-comments'),
    postcss = require('gulp-postcss'),
    url = require('postcss-url'),
    byebye = require('css-byebye'),
    autoprefixer = require('autoprefixer'),
    iconfont = require('gulp-iconfont'),
    consolidate = require('gulp-consolidate'),
    watch = require('gulp-watch'),
    rename = require('gulp-rename'),
    clean = require('gulp-clean'),
    plumber = require('gulp-plumber');

var OS_SLASH = nodepath.sep,
    CSS_SLASH = '/';

var fileHashes = {};

var srcDir = '_src/',
    destDir = 'assets/',
    cssSrcDir = srcDir,
    iconsSrcDir = cssSrcDir + 'main/_icon/',
    imgSrcDir = cssSrcDir,
    fontsSrcDir = cssSrcDir,
    cssDestDir = destDir + 'styles/',
    imgDestDir = destDir + 'images/',
    fontsDestDir = destDir + 'fonts/',
    cssSrcFiles = cssSrcDir + '**/*.less',
    iconsSrcFiles = iconsSrcDir + 'glyphs/*.svg',
    cssSrcRootFiles = cssSrcDir + '*.less',
    imgSrcFiles = imgSrcDir + '**/images/*.*',
    fontsSrcFiles = fontsSrcDir + '**/fonts/*.*';


gulp.task('css', ['clean-assets'], function (done) {
    return gulp.src(cssSrcRootFiles)
        .pipe(plumber())
        .pipe(less({
            relativeUrls: true
        }).on('error', function(err) {
            console.log(err.toString());
            this.emit('end');
        }))
        .pipe(stripCssComments())
        .pipe(postcss([
            url({
                url: cssUrl
            }),
            byebye({
                rulesToRemove: [/:markup-asset/]
            }),
            autoprefixer({
                cascade: false,
                remove: false,
                browsers: [
                    'Explorer >= 10',
                    'Edge >= 12',
                    'Opera >= 12',
                    'Firefox >= 22',
                    'Chrome >= 20',
                    'Safari >= 6',
                    'Android >= 4',
                    'iOS >= 7'
                ]
            })
        ]))
        .pipe(gulp.dest(cssDestDir));
});

gulp.task('icons', function (done) {
    var iconsStream = gulp.src(iconsSrcFiles)
        .pipe(plumber())
        .pipe(iconfont({
            fontName: 'icons',
            formats: ['ttf', 'woff'],
            normalize: true,
            fontHeight: 1001,
            timestamp: 0
        }));

    async.parallel([
        function handleGlyphs (cb) {
            iconsStream.on('glyphs', function (glyphs, options) {
                gulp.src(iconsSrcDir + 'templates/_icon__constants.less.ejs')
                    .pipe(plumber())
                    .pipe(consolidate('lodash', {
                        glyphs: glyphs.map(function (glyph) {
                            return {
                                name: glyph.name,
                                codepoint: glyph.unicode[0].charCodeAt(0)
                            }
                        }),
                        options: options
                    }))
                    .pipe(rename('_icon__constants.less'))
                    .pipe(gulp.dest(iconsSrcDir))
                    .on('finish', cb);
            });
        },
        function handleFonts (cb) {
            iconsStream
                .pipe(gulp.dest(iconsSrcDir + 'fonts/'))
                .on('finish', cb);
        }
    ], done);
});

gulp.task('clean-assets', function () {
    return gulp.src(destDir, {read: false})
        .pipe(clean());
});

gulp.task('clean', ['clean-assets']);

gulp.task('watch', ['default'], function () {
    gulp.watch(iconsSrcFiles, ['icons']);
    gulp.watch(cssSrcFiles, ['css']);
});

gulp.task('default',  function (done) {
    sequence('icons', 'css', done);
});


function cssUrl(srcPath, decl, from, srcFsDir) {

    if (isAbsoluteUrl(srcPath)) {
        return srcPath;
    }

    var destPath,
        srcParts = srcPath.split(CSS_SLASH),
        destParts,
        srcFsPath = nodepath.join(srcFsDir, srcPath),
        destFsPath,
        dir,
        component = srcParts[srcParts.length - 3],
        type = srcParts[srcParts.length - 2],
        asset = srcParts[srcParts.length - 1];

    switch (type) {
        case 'images':
            dir = osPathToCssPath(nodepath.relative(cssDestDir, imgDestDir));
            destParts = [dir, component, asset];
            break;
        case 'fonts':
            dir = osPathToCssPath(nodepath.relative(cssDestDir, fontsDestDir));
            destParts = [dir, asset];
            break;
    }

    if (destParts) {
        destPath = destParts.join(CSS_SLASH);
        destFsPath = nodepath.join('.', cssDestDir, destPath);
        try {
            fs.accessSync(destFsPath, fs.F_OK);
        } catch (ex) {
            fs.copySync(srcFsPath, destFsPath);
        }
        return destPath + '?v=' + getFileHash(destFsPath);
    } else {
        return srcPath;
    }
}

function getFileHash(fsPath) {
    if (!fileHashes.hasOwnProperty(fsPath)) {
        fileHashes[fsPath] = crypto.createHash('sha1').update(fs.readFileSync(fsPath)).digest('hex').substr(0, 16);
    }
    return fileHashes[fsPath];
}

function osPathToCssPath(path) {
    return path.split(OS_SLASH).join(CSS_SLASH);
}

function isAbsoluteUrl(url) {
    return /^\/|[a-z0-9]+:\/\//i.test(url);
}
