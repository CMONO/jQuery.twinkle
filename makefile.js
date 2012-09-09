/*jshint node: true */
'use strict';


var path = require('path'),
	child_process = require('child_process');


var pkg = require('./package.json'),

	root = path.resolve(__dirname),
	src = path.resolve(root, 'src'),
	build = path.resolve(root, 'build'),

	jshint = {
		// Enforcing Options
		bitwise: true,
		curly: true,
		eqeqeq: true,
		forin: true,
		latedef: true,
		newcap: true,
		noempty: true,
		plusplus: true,
		trailing: true,
		undef: true,

		// Environments
		browser: true,

		// Globals
		predef: [
			'jQuery', '$', 'modplug', 'Objects'
		]
	},

	mapperRoot = function (blob) {

		return blob.source.replace(root, build);
	};


module.exports = function (make) {

	var Event = make.Event,
		$ = make.fQuery,
		moment = make.moment,
		stamp, replacements;


	make.defaults('release');


	make.before(function () {

		stamp = moment();

		replacements = {
			pkg: pkg,
			stamp: stamp.format('YYYY-MM-DD HH:mm:ss')
		};

		Event.info({ method: 'before', message: pkg.version + ' ' + replacements.stamp });
	});


	make.target('git-hash', [], 'get git hash tag')
		.async(function (done, fail) {

			if (!/-dev$/.test(pkg.version)) {
				done();
				return;
			}

			var hash = '',
				cmd = 'git',
				args = ['rev-parse', '--short', 'HEAD'],
				options = {},
				proc = child_process.spawn(cmd, args, options);

			proc.stdout.on('data', function (data) {
				hash += ('' + data).replace(/\s*/g, '');
			});
			proc.on('exit', function (code) {
				if (code) {
					Event.error({ method: 'git-hash', message: cmd + ' exit code ' + code });
					fail();
				} else {
					pkg.version += '-' + hash;
					Event.ok({ method: 'git-hash', message: 'version is now ' + pkg.version });
					done();
				}
			});
		});


	make.target('clean', [], 'delete build folder')
		.sync(function () {

			$.rmfr($.I_AM_SURE, build);
		});


	make.target('lint', [], 'lint all JavaScript files with JSHint')
		.sync(function () {

			$(src + ': **/*.js, ! inc/lib/**')
				.jshint(jshint);
		});


	make.target('build', ['clean', 'git-hash'], 'build all updated files')
		.sync(function () {

			var scriptName = pkg.name;

			$(src + ': ' + scriptName + '.js')
				.includify()
				.handlebars(replacements)
				.write($.OVERWRITE, path.join(build, scriptName + '-' + pkg.version + '.js'))
				.uglifyjs()
				.write($.OVERWRITE, path.join(build, scriptName + '-' + pkg.version + '.min.js'));

			$(root + ': README*, LICENSE*')
				.write($.OVERWRITE, mapperRoot);
		});


	make.target('release', ['clean', 'build'], 'create a zipball')
		.async(function (done, fail) {

			var target = path.join(build, pkg.name + '-' + pkg.version + '.zip'),
				cmd = 'zip',
				args = ['-ro', target, '.'],
				options = { cwd: build },
				proc = child_process.spawn(cmd, args, options);

			Event.info({ method: 'exec', message: cmd + ' ' + args.join(' ') });

			proc.stderr.on('data', function (data) {
				process.stderr.write(data);
			});
			proc.on('exit', function (code) {
				if (code) {
					Event.error({ method: 'exec', message: cmd + ' exit code ' + code });
					fail();
				} else {
					Event.ok({ method: 'exec', message: 'created zipball ' + target });
					done();
				}
			});
		});
};
