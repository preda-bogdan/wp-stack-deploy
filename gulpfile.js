var util = require('util'),
    gulp = require('gulp'),
    run = require('gulp-run'),
    git = require('gulp-git'),
    jsonToYaml = require('gulp-json-to-yaml'),
    rename = require("gulp-rename"),
    randomstring = require("randomstring"),
    execSync = require('child_process').execSync,

    fs = require('fs'),
    config = JSON.parse(fs.readFileSync('./config.json'));


    var dbName = 'wp_'+randomstring.generate(7),
        dbUser = config['db-user'],
        dbPass = config['db-pass'];
    if(config['db-name'] && config['db-name'].trim().length != 0) {
        dbName = config['db-name'];
    }

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
    console.log('1/15 -- Download WP CLI');
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
    console.log('2/15 -- Download WordPress');
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
    console.log('3/15 -- Checking Setup wp-config');
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
                            gulp.start('wp-cli-yml');
                        }).on('error', errorHandler).pipe(gulp.dest('output'));
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('wp-config.php -- File does not exist');
            gulp.start('wp-cli-yml');
            //console.log(err.code);
        }
    });
});

gulp.task('wp-cli-yml', function() {
    console.log('4/15 -- Creating wp-cli.yml');
    var wpCliSettings = {
        "path": 'wp-core',
        "url": config['url'],
        "user": 1,
        "color": false,
        "core config": {
            "dbname": dbName,
            "dbuser": dbUser,
            "dbpass": dbPass
        }
    };

    var jsonString = JSON.stringify(wpCliSettings);
    fs.writeFile('wp-cli.json', jsonString, function() {
        gulp.src('./wp-cli.json')
            .pipe(jsonToYaml())
            .pipe(gulp.dest('./')).on('end', function() {
            gulp.src('./wp-cli.yaml')
                .pipe(rename("wp-cli.yml"))
                .pipe(gulp.dest("./")).on('end', function() {
                    fs.stat('wp-cli.yaml', function(err, stat) {
                        if(err == null) {
                            run('rm -rf wp-cli.yaml').exec(
                                function () {
                                    console.log('Cleaning Files');
                                    gulp.start('wp-config');
                                }).on('error', errorHandler).pipe(gulp.dest('output'));
                        } else {
                            gulp.start('wp-config');
                        }
                    });
            });
        });
    });
});

gulp.task('wp-config', function() {
    console.log('5/15 -- Started Config for WordPress');
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
    console.log('6/15 -- Started DB Create');
    return run('php tools/wp-cli.phar db create --path=wp-core/').exec(
        function () {
            console.log('Finished DB Create');
           // gulp.start('curl-db-sql');
            gulp.start('wp-install');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

gulp.task('wp-install', function(){
    console.log('7/15 -- Started WordPress Install');
    return run('php tools/wp-cli.phar core install --path=wp-core/ --url='+config['url']+' --title=Core --admin_user=codeinwp --admin_password=codeinwp123 --admin_email=codeinwp@themeisle.com').exec(
        function () {
            console.log('Finished WordPress Install');
            gulp.start('get-theme');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

/*
 * Git Clone Repo for theme from config.json
 * Callback to copy theme to wp-core
 */
gulp.task('get-theme', function() {
    console.log('8/15 -- Git Clone Theme - '+config['theme']['slug']);
    git.clone(config['theme']['git'], {args: 'git/'+config['theme']['slug']}, function(err) {
        if(err) return err;
        console.log('Git Clone Finished');
        gulp.start('copy-theme-to-wp');
    });
});

/*
 * Copy theme to wp-core
 * Callback to clean Git dir
 */
gulp.task('copy-theme-to-wp', function() {
    console.log('9/15 -- Copy Theme - '+config['theme']['slug']);
    return run('cp -R git/'+config['theme']['slug']+' wp-core/wp-content/themes/').exec(
        function () {
            console.log('Finished Copying Theme - '+config['theme']['slug']);
            gulp.start('clean-git-dir');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

gulp.task('clean-git-dir', function() {
    console.log('10/15 -- Clean Git Dir');
    fs.stat('git/', function(err, stat) {
        if(err == null) {
            run('rm -rf git').exec(
                function () {
                    console.log('Git Dir Removed');
                    gulp.start('get-codeinwp-plugins-stack');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No Git Dir Found');
            gulp.start('get-codeinwp-plugins-stack');
        }
    });
});

gulp.task('get-codeinwp-plugins-stack', function() {
    console.log('11/15 -- Git Clone Plugin Stack Codeinwp');
    git.clone('git@github.com:preda-bogdan/themeisle-plugin-stack.git', {args: 'git/Codeinwp'}, function(err) {
        if(err) return err;
        console.log('Git Clone Finished');
        gulp.start('check-theme-plugins');
    });
});

gulp.task('check-theme-plugins', function() {
    console.log('12/15 -- Checking '+config['theme']['slug']+' plugins.json');
    fs.stat('wp-core/wp-content/themes/'+config['theme']['slug']+'/plugins.json', function(err, stat) {
        if(err == null) {
            console.log('Loading plugins.json');
            plugins = JSON.parse(fs.readFileSync('wp-core/wp-content/themes/'+config['theme']['slug']+'/plugins.json'));
            console.log(plugins);
            var plugins_count = Object.keys(plugins).length,
                count = 0;
            for (var key in plugins) {
                count++;
                console.log(count);
                console.log(plugins_count);
                console.log(key);
                console.log(plugins[key]['git']);
                console.log(plugins[key]['ver']);
                var useVersion = '';
                if (plugins[key]['ver'] != 'master') {
                    useVersion = ' --version=' + plugins[key]['ver'];
                }
                if (plugins[key]['git'] == 'Codeinwp') {
                    console.log('Copying plugin from Codeinwp plugins stack');
                    run('cp -r git/Codeinwp/plugins/' + key + '/' + plugins[key]['ver'] + ' wp-core/wp-content/plugins/'+key).exec(
                        function () {
                            if (count == plugins_count) {
                                gulp.start('curl-db-sql');
                            }
                        }).on('error', errorHandler).pipe(gulp.dest('output'));
                } else {
                    var checkWP = execSync('php tools/wp-cli.phar plugin search ' + key + ' --path=wp-core/ --format=count --quiet').toString();
                    if (checkWP == 0) {
                        console.log('No plugin found');
                        console.log('Git Clone ' + key + ' Plugin from repo ' + plugins[key]['git']);
                        git.clone(plugins[key]['git'], {args: 'git/plugins/' + key}, function (err) {
                            if (err) return err;
                            console.log('Git Clone Finished');
                            run('cp -R git/plugins/' + key + ' /wp-core/wp-content/plugins/' + key).exec(
                                function () {
                                    if (count == plugins_count) {
                                        gulp.start('curl-db-sql');
                                    }
                                }).on('error', errorHandler).pipe(gulp.dest('output'));
                        });
                    } else {
                        console.log('Plugin found: ' + checkWP);
                        run('php tools/wp-cli.phar plugin install ' + key + ' --path=wp-core/').exec(function () {
                            if (count == plugins_count) {
                                gulp.start('curl-db-sql');
                            }
                        }).on('error', errorHandler).pipe(gulp.dest('output'));
                        console.log('Installed from WordPress');
                    }
                }
            }
            console.log('Finished Installing Plugins');
        } else {
            console.log('No plugins.json Found');
        }
    });
});

gulp.task('curl-db-sql', function(){
    console.log('13/15 -- Get Theme SQL Dump');
    // TODO change the curlURI
    // http://network.themeisle.com/wp-json/database/theme-slug > theme-slug-db.sql
    var curlURI = 'http://network.themeisle.com/wp-json/rop/database/download';
    return run('curl -U themeisle:r5LEpnv2 -x proxy.themeisle.com:3128 --proxy-digest -L '+curlURI+' > '+config['theme']['slug']+'.sql').exec(
        function() {
            console.log('Finished cUrl '+config['theme']['slug']+'.sql');
            gulp.start('wp-import-db-settings');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

gulp.task('wp-import-db-settings', function() {
    console.log('14/15 -- Importing '+config['theme']['slug']+'.sql');
    return run('wp db import '+config['theme']['slug']+'.sql --path=wp-core/').exec(
        function() {
            console.log('Import Complete');
            gulp.start('wp-update-user-options');
        }).on('error', errorHandler).pipe(gulp.dest('output'));
});

gulp.task('wp-update-user-options', function() {
    console.log('15/15 -- Updating WP User and Options');
    var cmdSeries = {
        "user_update": 'php tools/wp-cli.phar user update 1 --display_name=CodeinWP --user_nicename=codeinwp --user_email=codeinwp@themeisle.com --user_pass=codeinwp123 --path=wp-core/',
        "siteurl_update": 'php tools/wp-cli.phar option update siteurl "'+config['url']+'/wp-core" --path=wp-core/',
        "home_update": 'php tools/wp-cli.phar option update  home "'+config['url']+'"  --path=wp-core/'
    };
    for(var key in cmdSeries) {
        console.log(key);
        run(cmdSeries[key]).exec(function() {
            if(key == 'home_update') {
                //gulp.start('get-theme');
                console.log('Finished install check: '+config['url']);
            }
        }).on('error', errorHandler).pipe(gulp.dest('output'));
    }
});

gulp.task('clean', function() {
    console.log('Starting Clean');

    console.log('Dropping DB');
    run('php tools/wp-cli.phar db query --path=wp-core/ < clean.sql').exec(function() {
        console.log('Cleaning clean.sql');
        fs.stat('clean.sql', function(err, stat) {
            if(err == null) {
                run('rm -rf clean.sql').exec(
                    function () {
                        console.log('clean.sql Removed');
                    }).on('error', errorHandler).pipe(gulp.dest('output'));
            } else {
                console.log('No clean.sql Found');
            }
        });

        console.log('Cleaning tools');
        fs.stat('tools/', function(err, stat) {
            if(err == null) {
                run('rm -rf tools').exec(
                    function () {
                        console.log('tools Dir Removed');
                    }).on('error', errorHandler).pipe(gulp.dest('output'));
            } else {
                console.log('No tools Dir Found');
            }
        });
    }).on('error', errorHandler).pipe(gulp.dest('output'));

    console.log('Cleaning git');
    fs.stat('git/', function(err, stat) {
        if(err == null) {
            run('rm -rf git').exec(
                function () {
                    console.log('git Dir Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No git Dir Found');
        }
    });

    console.log('Cleaning wp-core');
    fs.stat('wp-core/', function(err, stat) {
        if(err == null) {
            run('rm -rf wp-core').exec(
                function () {
                    console.log('wp-core Dir Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No wp-core Dir Found');
        }
    });

    console.log('Cleaning '+config['theme']['slug']+'.sql');
    fs.stat(''+config['theme']['slug']+'.sql', function(err, stat) {
        if(err == null) {
            run('rm -rf '+config['theme']['slug']+'.sql').exec(
                function () {
                    console.log(''+config['theme']['slug']+'.sql Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No '+config['theme']['slug']+'.sql Found');
        }
    });

    console.log('Cleaning wp-cli.json');
    fs.stat('wp-cli.json', function(err, stat) {
        if(err == null) {
            run('rm -rf wp-cli.json').exec(
                function () {
                    console.log('wp-cli.json Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No wp-cli.json Found');
        }
    });

    console.log('Cleaning wp-cli.yaml');
    fs.stat('wp-cli.yaml', function(err, stat) {
        if(err == null) {
            run('rm -rf wp-cli.yaml').exec(
                function () {
                    console.log('wp-cli.yaml Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No wp-cli.yaml Found');
        }
    });

    console.log('Cleaning wp-cli.yml');
    fs.stat('wp-cli.yml', function(err, stat) {
        if(err == null) {
            run('rm -rf wp-cli.yml').exec(
                function () {
                    console.log('wp-cli.yml Removed');
                }).on('error', errorHandler).pipe(gulp.dest('output'));
        } else {
            console.log('No wp-cli.yml Found');
        }
    });
});

gulp.task('default', ['get-wp-cli']);

function errorHandler (error) {
    console.log(error.toString());
    this.emit('end');
}