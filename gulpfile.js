var util = require('util'),
    gulp = require('gulp'),
    composer = require('gulp-composer'),
    run = require('gulp-run'),
    shell = require('gulp-shell'),
    prompt = require('gulp-prompt'),
    git = require('gulp-git'),
    randomstring = require("randomstring"),
    execSync = require('child_process').execSync,

    fs = require('fs'),
    config = JSON.parse(fs.readFileSync('./config.json'));

/*
 * Things to do:
 * 1. Download Latest WP -- DONE
 * 2. Download wp-cli -- DONE
 * 3. Get Theme based on .json config file -- DONE
 * 4. Install Plugins via WP or via Git
 * 5. Sync DB
 * 6. TEST
 */


/*
 * Download WP cli into tools/ folder
 * Callback to Download Latest WordPress
 */
gulp.task('get-wp-cli', function() {
    console.log('Download WP CLI');
    return run('mkdir tools | curl -o tools/wp-cli.phar https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar').exec(
        function() {
            console.log('Finished Download WP CLI');
            gulp.start('download-wp-latest');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

/*
 * Download WordPress Latest /or Version provided in config.json
 * Callback to Generate wp-config.php with WP cli
 */
gulp.task('download-wp-latest', function() {
    console.log('Download WordPress');
    return run('php tools/wp-cli.phar core download --path=wp-core --version='+config['wp-version']+' --force').exec(
        function() {
            console.log('Finished Download WordPress');
            gulp.start('check-wp-config');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

/*
 * Check if wp-config.php exists
 * If true remove then run wp-config.php Generate task
 * Else just run  Generate task
 * Callback to DB creation
 */
gulp.task('check-wp-config', function() {
    fs.stat('wp-core/wp-config.php', function(err, stat) {
        if(err == null) {
            console.log('wp-config.php -- File exists');
            console.log('Dropping Old DB');
            run('php tools/wp-cli.phar db query --path=wp-core/ < clean.sql').exec(
                function () {
                    console.log('Removing old wp-config.php');
                    run('rm -rf wp-core/wp-config.php').exec(
                        function() {
                            console.log('wp-config.php Removed');
                            gulp.start('wp-config');
                        }).on('error', errorHandler).pipe(gulp.dest('output'));
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('wp-config.php -- File does not exist');
            gulp.start('wp-config');
            //console.log(err.code);
        }
    });
});

gulp.task('wp-config', function() {
    console.log('Started Config for WordPress');
    var dbName = 'wp_'+randomstring.generate(7),
        dbUser = config['db-user'],
        dbPass = config['db-pass'];
    if(config['db-name'] && config['db-name'].trim().length != 0) {
        dbName = config['db-name'];
    }
    return run('php tools/wp-cli.phar core config --path=wp-core/ --dbname='+dbName+' --dbuser='+dbUser+'  --dbpass='+dbPass+'').exec(
        function() {
            console.log('Finished Config for WordPress');
            fs.writeFile('clean.sql', 'SET FOREIGN_KEY_CHECKS = 0; DROP DATABASE IF EXISTS `'+dbName+'`', function() {
                gulp.start('wp-create-db');
            });
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

/*
 * Create DB based on wp-config.php and config.json
 * Callback to ???
 */
gulp.task('wp-create-db', function(){
    console.log('Started DB Create');
    return run('php tools/wp-cli.phar db create --path=wp-core/').exec(
        function () {
            console.log('Finished DB Create');
            gulp.start('get-theme');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

/*
 * Git Clone Repo for theme from config.json
 * Callback to copy theme to wp-core
 */
gulp.task('get-theme', function() {
    console.log('Git Clone Theme - '+config['theme']['slug']);
    git.clone(config['theme']['git'], {args: 'git/'}, function(err) {
        if(err) return err;
        console.log('Git Clone Finished');
        gulp.start('copy-theme-to-wp');
    });
});

/*
 * Copy theme to wp-core
 * TODO change cp from path when theme has it's own repo
 * Callback to clean Git dir
 */
gulp.task('copy-theme-to-wp', function() {
    console.log('Copy Theme - '+config['theme']['slug']);
    return run('cp -R git/content/themes/'+config['theme']['slug']+' wp-core/wp-content/themes/'+config['theme']['slug']+'').exec(
        function () {
            console.log('Finished Copying Theme - '+config['theme']['slug']);
            gulp.start('clean-git-dir');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

gulp.task('clean-git-dir', function() {
    console.log('Clean Git Dir');
    fs.stat('git/', function(err, stat) {
        if(err == null) {
            run('rm -rf git').exec(
                function () {
                    console.log('Git Dir Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No Git Dir Found');
        }
    });
});

gulp.task('default');

function errorHandler (error) {
    console.log(error.toString());
    this.emit('end');
}