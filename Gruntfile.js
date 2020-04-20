
module.exports = function(grunt) {

    require('jit-grunt')(grunt);

    grunt.initConfig({

        watch: {
            css: {
                files: ['src/css/**/*'],
                tasks: ['sass'],
            }
        },

        clean: {
            build: ['build']
        },

        nodemon: {
            dev: {
                script: './src/cli.js',
                options: {
                    exec: ['./node_modules/.bin/babel-node --harmony'],
                    env: { PORT: '4000' }
                }
            }
        },

        sass: {
            options: {
                sourceMap: true
            },
            interactive: {
                files: {
                    'build/main.css': 'src/css/main.scss'
                }
            }
        },

        concurrent: {
            www: ['nodemon', 'watch'],
            options: {
                logConcurrentOutput: true
            }
        }
    });

    grunt.registerTask('build', ['clean', 'sass'])
    grunt.registerTask('default', ['build', 'concurrent:www']);
}
