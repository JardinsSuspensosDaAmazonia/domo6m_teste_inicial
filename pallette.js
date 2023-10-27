/*
 * Palette is the js class.
 *
 * Legalize Cannabis Licence
 */

Palette = function(hex){
	this.rgb = Palette.hex2rgb(hex);
}
.override({
	hl: function(inc) {
		this.rgb ||
			console.log('!this.rgb');
		this.rgb[0] += inc;
		this.rgb[1] += inc;
		this.rgb[2] += inc;
		return this;
	},
	color: function(){
		return Palette.rgb(this.rgb[0], this.rgb[1],this.rgb[2]);
	}
});

Palette.HEX = '0123456789ABCDEF';

Palette.hex2 = function(i){
	i = i < 0 ? 0 : i;
	i = i > 255 ? 255: i;
	var l = i % 16, h = (i - l) / 16;
	return '' + Palette.HEX[h] + Palette.HEX[l];
};

Palette.hex2int = function(hex){
	if (hex.length > 1)
		return Palette.hex2int(hex.substr(0, hex.length - 1)) * 16 + Palette.hex2int(hex.substr(hex.length - 1))
	for (var i = Palette.HEX.indexOf(hex.toUpperCase()); i >= 0;)
		return i;
	return console.log('Palette.hex2int(): unknown', hex);
};

Palette.hex2rgb = function(hex){
	var result = /^#?(\w\w?)(\w\w?)(\w\w?)$/.exec(hex);
	if (result)
		return [ Palette.hex2int(result[1]), Palette.hex2int(result[2]), Palette.hex2int(result[3]) ];
	return console.log('Palette.hex2rgb(): unknown', hex);
};

Palette.rgb = function(r, g, b){
	return '#' + Palette.hex2(r) + Palette.hex2(g) + Palette.hex2(b);
};



Palette.collections = {
	vertex: [],
	line: 
		[
      '#ddf20d',// A
      '#3211ee',// B
      '#f50a0c',// C
			"#000",// D
			"#0d934a",// E
			"#f50a0c",// F
			"#f50a0c",// G
			"#aa0dce",// H
			"#aa0dce",// I
			"#0d934a",// J
			"#f50a0c",// K
			"#e7a000",// L
			"#aa0dce",// M
			"#fa65c4",// N
		],
	face: []
};

(function(){
	var cube = function(dim, fn){
		var shifting = [], pos,
			collection = [];
		for (var steps = [], i = 0; i < dim; i++) {
			steps.push(255 - Math.floor((255 / dim) * i));
			i % 2 && shifting.push(i);
		}
		for (i = 0; i < dim; i++)
			i % 2 || shifting.push(i);
		for (var k = 0; k < steps.length; k++){
			var b = steps[shifting[k]];
			for (var j = 0; j < steps.length; j++){
				var g = steps[shifting[j]];
				for (i = 0; i < steps.length; i++){
					var r = steps[shifting[i]];
					fn(r, g, b, shifting[i], shifting[j], shifting[k], pos++);
				}
			}
		}
	}

	Palette._colors = [];
	var steps = 10;
	cube(steps, function(r, g, b, i, j, k, pos){
		if ((i + j + k) % 2 == 0 && (i + j + k) > 2 && (i + j + k) < steps * 3 - 2) {
			var rgb = Palette.rgb(r, g, b);
			Palette._colors.push(rgb);
			// collections
			var mod = (i + j + k) / 2;
			//mod = 
			if (mod % 3 == 2)
				Palette.collections.vertex.push(rgb);
			else if(mod % 2)
				Palette.collections.face.push(rgb);
			else
				Palette.collections.line.push(rgb);

		}
	});
})();

0&&$(function(){
	$.each(Palette.collections, function(key, colors){
		$(colors.length).prependTo('body');
		$(colors).each(function(){
			$('<span style="background-color:'+this+'">&nbsp;&nbsp;'+key+'&nbsp;&nbsp;</span> &nbsp; ').prependTo('body');
		});
		$('<br>').prependTo('body');
	});
});
