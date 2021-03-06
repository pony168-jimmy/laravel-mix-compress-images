const fs = require('fs');
const RawSource = require('webpack-sources/lib/RawSource');
const minimatch = require('minimatch');
let compress_images = require('compress-images');

class CompressImagesPlugin {

	constructor(patterns = {}, output = {}, compressParameters = {}) {
		this.patterns = patterns;
		this.output = output.trim() ? `/${output}` : '';
		this.compressParameters = {
			...{
				jpg: {
					engine: 'mozjpeg',
					command: ['-quality', '60']
				},
				png: {
					engine: 'pngquant',
					command: ['--quality=20-50']
				},
				svg: {
					engine: 'svgo',
					command: '--multipass'
				},
				gif: {
					engine: 'gifsicle',
					command: ['--colors', '64', '--use-col=web']
				},
			},
			...compressParameters
		};
	}

	apply(compiler) {
		// Access the assets once they have been assembled
		const onEmit = async (compilation, callback) => {

			try {
				// Filter assets that matches current pattern.
				const assets = Object.keys(compilation.assets).filter(item => {
					return this.patterns.filter(pattern => {
						return minimatch(item, pattern);
					}).length > 0;
				});
				// Process each input file.
				await Promise.all(
					assets.map(path => this.processOneFile(path, compilation))
				);

				// When all files are done.
				callback();

			} catch (err) {
				callback(err)
			}
		}

		// Check if the webpack 4 plugin API is available
		if (compiler.hooks) {
			// Register emit event listener for webpack 4
			compiler.hooks.emit.tapAsync(this.constructor.name, onEmit)
		} else {
			// Register emit event listener for older webpack versions
			compiler.plugin('emit', onEmit)
		}
	}

	/**
	 * Process only one file
	 *
	 * @param path
	 * @param compilation
	 * @returns {Promise<any>}
	 */
	processOneFile(path, compilation) {
		const rules = /\.(jpg|JPG|jpeg|JPEG|png|svg)$/;
		const callback = (resolve) => {
			let destination = path.split('/');
			// Forget the filename.
			let filename = destination.pop();
			// As we use this.output, we delete the first rep.
			let del = (destination.length > 0 ?  destination.join('/') : '') + '/';
			destination = destination.splice(1);
			destination = (destination.length > 0 ? '/' + destination.join('/') : '') + '/';	
			destination = this.compressParameters.destination + this.output + destination;
			
			// if file can not be compiled, copt origin file to destination
			if(!filename.match(rules)){
				if (!fs.existsSync(destination)){
					fs.mkdirSync(destination, { recursive: true });
				}		
				fs.copyFile(path, destination+filename, (err) => {
					if (err) throw err;					
					let data = fs.readFileSync(del + filename);
					if (data) {
						delete compilation.assets[path];
						compilation.assets['../' + del + filename] = new RawSource(data);
					}					
				});
				resolve();
			}

			compress_images(
				path,
				destination,
				{
					compress_force: true,
					statistic: true,
					autoupdate: true,
				},
				false,
				{
					jpg: this.compressParameters.jpg
				},
				{
					png: this.compressParameters.png
				},
				{
					svg: this.compressParameters.svg
				},
				{
					gif: this.compressParameters.gif
				},
				(error, completed, statistic) => {									
					if (completed) {
						let data = fs.readFileSync(del + filename);
						if (data) {
							delete compilation.assets[path];
							compilation.assets['../' + del + filename] = new RawSource(data);
						}
					}
					resolve();
				});
		}
		return new Promise(callback);
	}
}

module.exports = CompressImagesPlugin;
