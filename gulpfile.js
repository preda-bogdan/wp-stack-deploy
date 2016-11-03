var util = require('util'),
    gulp = require('gulp'),
    composer = require('gulp-composer'),
    run = require('gulp-run'),
    shell = require('gulp-shell'),
    prompt = require('gulp-prompt'),
    git = require('gulp-git'),
    randomstring = require("randomstring"),
    execSync = require('child_process').execSync;

//TODO refactor gulpfile from revivesocial-automatic
/*
 * Things to do:
 * 1. Download Latest WP
 * 2. Download wp-cli
 * 3. Get Theme based on .json config file
 * 4. Install Plugins via WP or via Git
 * 5. Sync DB
 * 6. TEST
 */
gulp.task('default');

function errorHandler (error) {
    console.log(error.toString());
    this.emit('end');
}