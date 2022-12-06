
module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-concurrent')
    grunt.loadNpmTasks('grunt-contrib-clean')
    grunt.loadNpmTasks('grunt-contrib-watch')
    grunt.loadNpmTasks('grunt-dart-sass')
    grunt.loadNpmTasks('grunt-nodemon')

    grunt.initConfig({

        watch: {
            css: {
                files: ['src/css/**/*'],
                tasks: ['dart-sass'],
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

        'dart-sass': {
            dist: {
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

    grunt.registerTask('build', ['clean', 'dart-sass'])
    grunt.registerTask('default', ['build', 'concurrent:www']);
}
