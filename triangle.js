/**
 * Product definition triangle
 * 
 * @author   popitch [at yandex.ru]
 */

Product.Triangle = {};

Product.Triangle.Simple = function(face, params){
	// parent()
	Product.Polygon.Simple.call(this, face, $.extend({
		type: 'Triangle',
		title: 'Треугольник'
	}, params || {}));
}
.inherits(Product.Polygon.Simple)
.override({
	unify: function() {
		var product = this;
		var unifier = Product.Polygon.Simple.prototype.unify.call(this, 'without radius, brother');

		/* stats */
		var $reals = this.realPoints();
		
		// lengths of sides a, b, c
		var abc = this.abc = new Array(3);
		var lines = this.lines = new Array(3);
		// для углов
		var abcEdges = this.abcEdges = new Array(3);
		var n = Vector.crossProduct(
				$reals[0].clone().subtract($reals[1]),
				$reals[2].clone().subtract($reals[1])
			);
		$reals.each(function(i){
			var A = this, B = $reals[(i + 1) % 3];
			abc[(i + 2) % 3] = product.R * A.distance(B);
			lines[(i + 2) % 3] = _.find(product.face.bindedLines || product.face.$sub.line, function(line) {
				var vv = line.origin.$sub.vertex;
				return 0 ||
					(vv[0] == A.vertex && vv[1] == B.vertex) ||
					(vv[1] == A.vertex && vv[0] == B.vertex);
			});
			// angle between the plane of the triangle and the plane looking at the center
			var r = A.vertex.points[0].clone().add(B.vertex.points[0]).scale(.5);
			abcEdges[(i + 2) % 3] = Math.asin(Math.abs(r.cosWith(n)));
		});

		// Heron's formula allows you to calculate the area of ​​a triangle (S) based on its sides
		this.p = (abc[0] + abc[1] + abc[2]) / 2;
		this.S = Metrics.triangleHeronArea(abc[0], abc[1], abc[2]);

		// angles
		this.angles = new Array(3);
		for (var a = 0; a < 3; a++) {
			var b = (a + 1) % 3, c = (a + 2) % 3;
			product.angles[a] = Math.acos( (abc[b]*abc[b] + abc[c]*abc[c] - abc[a]*abc[a]) / (2 * abc[b] * abc[c]) );
		}

		// S = abc/4R
		this.triR = abc[0] * abc[1] * abc[2] / (4 * this.S);
		/* end for stats */
		
		return unifier;
	},

	model: function(onExport) {
		if (!onExport)
			return // console.error(this, 'on export only');

		var face = this.face.$points.get();

		// todo: resolve std orientation
		face = face.reverse();//[face[2], face[1], face[0]];

		// one reverted face
		return [face];
	},

	plot: function(canvas) {
		var product = this;

		new Plotter.Triangle(canvas, {
			$points: this.realPoints(),
			$vertexes: product.face.$sub.vertex,
			$lines: this.lines,
			R: this.R,
			angles: this.angles,
			radiuses: [this.triR, this.triR, this.triR],
			abcEdges: this.abcEdges,
			textZoom: 2
		})
		.triangle()
		.vertexes();
	},
	
	meter: function(){
		var meter = {};

		meter[__('Coverage area, m2')] = this.S;
		meter[__('Triangles')] = {};
		meter[__('Triangles')]['range:' + __('Min. height, mm')] = Product.lengthUnify(
			_.min([
				2 * this.S / this.abc[0],
				2 * this.S / this.abc[1],
				2 * this.S / this.abc[2]
			])
		);
		meter[__('Triangles')]['range:' + __('Max. side, mm')] = Product.lengthUnify(
			_.max(this.abc)
		);

		return meter;
	}
});
