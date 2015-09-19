module.exports = function(grunt) {


	grunt.initConfig({
		express: {
			dev: {
				options: {
					script: 'app.js'
				}
			}
		},
		watch: {
			scripts: {
				files: ['**/*.less'],
				tasks: ['less'],
				options: {
					spawn: false
				}
			}
		},
		less: {
			development: {
				options: {
					compress: true,
					yuicompress: true,
					optimization: 2
				},
				files: {
					"public/stylesheets/app.css": "public/stylesheets/style.less" // destination file and source file
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-express-server');

	grunt.registerTask('default', ['express:dev', 'watch']);
};