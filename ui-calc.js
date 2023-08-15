/**
 * Helper for usage url's #fragment as source of params.
 *
 * @license  Legalize Cannabis License
 * @author   popitch ya ru
 */

function Stringifier(options){
	this.options = options = $.extend(true, {
		// format: string,
		// mapping: hashmap
	}, options);
	
	var format = (options.format instanceof Array) ? options.format.join('') : options.format;
	this._compile(format);
	
	// Backbone.Events
	_.extend(this, Backbone.Events);
}

(function(root, _, $, undefined){
	Stringifier.prototype = {
		fromString: function(string){
			var matches = this.fullRegexp.exec(string);
			if (!matches) return {};
		
			var params = {};
			var options = this.options, i = 1;
			$.each(this.compiled, function(j, chunk){
				if (typeof chunk == 'string') return;
				
				var mapper = options.mapping[chunk.name];
				if (mapper)
					value = mapper.value.apply(params, matches.slice(i, i + chunk.argc + 1));
				else
					value = matches[i];
				i += chunk.argc + 1;
				if (typeof value == 'object')
					params = $.extend(true, params, value);
				else
					params[chunk.name] = value;
			});

			// fire event
			var moreArgs = [].slice.call(arguments, 1);
			this.trigger.apply(this, ['params', params].concat(moreArgs));
			
			return params;
		},
		
		fromParams: function(params){
			var options = this.options;
			var string = _.map(this.compiled, function(chunk){
				if (typeof chunk == 'string') return chunk;
				
				var mapper = options.mapping[chunk.name];
				return mapper ? 
					mapper.string.call(params, params[chunk.name])
					: params[chunk.name] || '';
			}).join('');

			// fire event
			var moreArgs = [].slice.call(arguments, 1);
			this.trigger.apply(this, ['string', string].concat(moreArgs));
			
			return string;
		},
	
		_compile: function(formatString){
			// reg exp helpers
			function rescape(str){
				return str.replace(/[\\\/\.\-+*?^$|{}\[\]]/g, '\\$&');
			}
			var reGroups = /\([^?][^\)]*\)/g;
		
			var compiled = this.compiled = [], pose = 1;
		
			// make chain
			formatString.replace(/([^<]+)|<([\w.]+):([^>]+)>/g,
				function(frag, simple, name, find){
					if (simple){
						compiled.push(simple);
						return;
					}
					var argc = find.split(reGroups).length - 1;
					compiled.push({
						name: name,
						find: find,
						produce: function(argv){
							var i = 0;
							return find.replace(reGroups, function(){
								return argv[i++];
							});
						},
						argc: argc,
						pose: pose + 1
					});
					pose += argc + 1;
				}
			);
		
			// make full string regexp
			this.fullRegexp = new RegExp('^' +
				$.map(this.compiled, function(frag){
					return (typeof frag == 'string') ? rescape(frag) : '(' + frag.find + ')';
				}).join('') +
			'$');
		
			return compiled;
		}
	};
})(this, _, jQuery);
