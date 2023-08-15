/**
 * Определение продукта многоугольник
 * 
 * @author   popitch [at yandex.ru]
 */

Product.Polygon = function(){
	Product.apply(this, arguments);
	// expected
	this.face || console.log('face not specified');
}
.inherits(Product)
.override({

	/** отдает вершины продуктового полигона
	 *  в сложном случае (например, Joint) вершины не совпадают с вершинами базовой фигуры, задающей форму купола
	 */
	realPoints: function(){
		var face = this.face;

		return this.cache.$reals = this.cache.$reals ||
			face.$sub.vertex.map(function(){
				var vertex = this,
					point = vertex.$points[0];

				var planes = $.map(face.bindedLines || face.$sub.line, function(line) {
						line = line.origin;
						return (line.$points[0] === point || line.$points[1] === point) ?
							line.product.getPlane() : null;
					});

				var sols = $( Solutions.twoPlanesAndSphere(planes[0], planes[1]) ).each(function(){
						this._offset = this.distance(point);
					});

				sols.length == 2 ||
					console.log('polygon unify(): sols.length=' + sols.length);
				
				var result = sols[0]._offset < sols[1]._offset ? sols[0] : sols[1];

				// ~
				result.scale( point.length() );

				result.vertex = vertex;
				vertex.real = result;
				return result;
			});
	},
	
	realCenter: function() {
		if (this.cache.realCenter)
			return this.cache.realCenter;
		var center = new Vector, $points = this.realPoints();
		$.map($points, function(p) {
			center.add(p);
		});
		return this.cache.realCenter = center.scale(1 / $points.length);
	}
});

Product.Polygon.Simple = function(face, params){
	// parent()
	Product.Polygon.apply(this, [$.extend({
		type: 'Polygon',
		title: 'Многоугольник',
		bilateral: false,
		face: face
	}, params || {})]);
}
.inherits(Product.Polygon)
.override({
	unify: function(accum) {
		const product = this,
			face = product.face,
			$reals = product.realPoints();

		if (face._protoPoint) {
			var center// = face._protoPoint; // with him wrong unification! O_o
		} else {
			center = new Vector;
			$reals.each(function(){
				center.add(this);
			});
			center.scale( 1 / $reals.length );
		}
		
		// product normal
		product.normal = Vector.crossProduct(
			Vector.subtract($reals[0], center),
			Vector.subtract($reals[1], center)
		);
		if (Vector.dotProduct(product.normal, $reals[0]) < 0)
			product.normal.scale(-1);
		
		var prevRealPoint = $reals[$reals.length - 1],
			prevVertex = product.face.$sub.vertex[$reals.length - 1],
			chain = [];
		
		var angleSum = 0;
		
		product.maxR = 0;
		
		$reals.each(function(/*vertexIter*/) {
			var realPoint = this,
				vertex = realPoint.vertex, //product.face.$sub.vertex[ vertexIter ];
				vertexPoint = vertex.$points[0],
				prevVertexPoint = prevVertex.$points[0];
		
			// vertex raduis
			var R = prevRealPoint.distance(center) * product.R;
			chain.push({
				value: R,
				vertex: prevVertex,
				center: center,
				mark: 'R',
				cuttingMatter: prevVertex._cuttingPoint && 'Cutting' && null // disable deprecated! face.cuttingLine
			});
			
			var line = _.findWhere(product.face.bindedLines || product.face.$sub.line, {
					origin: vertex.$super.line.map(function(){
						return this.$vertexes[0] === prevVertex ||
							   this.$vertexes[1] === prevVertex ? this : null;
					})[ 0 ]
				}),
				lineCuttingMatter = line._cuttingMatters &&
					line._cuttingMatters[
						line.$points[0] === vertex.$points[0] ? 1 : 0
					];
			
			// side angle
			var prevAngle = Vector.subtract(realPoint, center).angleWith(Vector.subtract(prevRealPoint, center));
			chain.push({
				dontStart: true,
				value: prevAngle,
				mark: 'A',
				cuttingMatter: lineCuttingMatter && null // disable deprecated! face.cuttingLine
			});
			
			// test
			angleSum += prevAngle;
			
			// max R
			product.maxR = Math.max(product.maxR, R);
			
			// side length
			chain.push({
				sortIgnore: true,
				dontStart: true,
				vertex: vertex,
				value: realPoint.distance(prevRealPoint) * product.R,
				line: line,
				mark: 'L'
			});

			if (! line) {
				console.warn('binded line not found');
			}
			
			prevVertex = vertex;
			prevRealPoint = realPoint;
		});
		
		// assert: polygon on plane
		if (Math.abs(angleSum - 2 * Math.PI) > 1e-3){
			console.log('Polygon.unify(): sum of polygon angles is not equal full circle (' + angleSum + ' != 2*PI)');
		}
		
		// select chain
		product.chain = Product.selectChain(
			chain,
			function(i, all, forward) {
				var adv = this.cuttingMatter && null; // disable deprecated! face.cuttingLine
				
				return this.value //* 1e+3 + // disable deprecated! face.cuttingLine
					//(isNaN(adv) ? (adv ? 1 : 0) : (forward ? adv : 1 - adv))
			},
			true,
			product.bilateral
		);
		
		return $.map(product.chain, node => {
			if (node.mark == 'L') return null;
			
			var adv = node.cuttingMatter && null; // disable deprecated! face.cuttingLine
			
			return node.mark + 
				(adv ? '[' + (isNaN(adv) ? adv : Math.round((node.forward ? adv : 1 - adv) * 1000)) + ']' : '') + 
				Product.lengthUnify(node.value); // 1/1000 of meter/radian precision
		}).join('-');
	},

	model: function(onExport) {
		if (!onExport)
			return // console.error(this, 'on export only');

		if (this.face.protoConvexFaces) {
			return this.face.protoConvexFaces.flatMap(face => [ face.$points.get().reverse() ]);
		}
		
		var face = this.face.$points.get();

		// todo: resolve std orientation
		var reverted = face.reverse();
		
		// one reverted face
		return [reverted];
	},
	
	plot: function(canvas){
		var product = this;
		var R = this.maxR;
		var plotter = new Plotter(canvas, {
				width: 2 * R,
				height: 2 * R,
				margin: 20, // px
				resize: true,
				offset: {x: R, y: R}
			});
		//plotter.circle({x: 0, y: 0}, R, ['gray']);
		
		// plotter point by angle & R
		function pos(a, r) {
			return {
				x: r * Math.cos(a),
				y: r * Math.sin(a)
			};
		}
		
		function middle(A, B, ratio) {
			return {
				x: A.x * (1 - ratio) + B.x * ratio,
				y: A.y * (1 - ratio) + B.y * ratio
			};
		}
		
		var cuttingBegin;
		function cuttingPoint(p) {
			if (cuttingBegin) {
				plotter.line(cuttingBegin, p, 'dashed');
				cuttingBegin = null;
			}
			else {
				cuttingBegin = p;
			}
		}
		
		var center = {x: 0, y: 0};
		
		// draw polygon
		var a = Math.PI / 2, prev = {};
		
		// previous (last) segment data
		for (var i = 1; i <= 3; i++) {
			var match = this.chain[this.chain.length - i];
			prev[match.mark] = match.line || match.value;
					
			// cutting
			if (match.mark === 'R' && match.cuttingMatter) {
				cuttingPoint(pos(a, match.value));
			}
			else if (match.mark === 'A' && match.cuttingMatter) {
				prev.lineCuttingMatter = match.forward ? match.cuttingMatter : 1 - match.cuttingMatter;
			}
		}
		// set last plotter-point as previous
		prev.point = pos(a - prev.A, prev.R);
		
		$(this.chain).each(function(){
			switch(this.mark){
				case 'L':
					prev.L = this.line;
					break;
					
				case 'A':
					a += this.value;
					
					// cutting
					if (this.cuttingMatter) {
						prev.lineCuttingMatter = this.forward ? this.cuttingMatter : 1 - this.cuttingMatter;
					}
					
					break;
					
				case 'R':
					var point = pos(a, this.value);
					var worldPoints = $.map(prev.L.origin.$sub.vertex, v => v.$points[0]);
					
					// cutting
					if (prev.lineCuttingMatter) {
						cuttingPoint(
							middle(prev.point, point, prev.lineCuttingMatter)
						);
						prev.lineCuttingMatter = null;
					}
					
					if (this.cuttingMatter) {
						cuttingPoint(point);
					}
					
					// side
					var length = Product.lengthUnify( plotter.distance(point, prev.point) );
					var basedOnLineNormal = worldPoints[1] && Vector.crossProduct(worldPoints[0], worldPoints[1]);
					var segmentNormal = worldPoints[1] && Vector.crossProduct(
							Vector.subtract(worldPoints[0], product.realCenter()),
							Vector.subtract(worldPoints[1], product.realCenter())
						);
					
					var byLineAngle = basedOnLineNormal && Math.round( segmentNormal.angleWith(basedOnLineNormal) * 1800 / Math.PI ) / 10;
					// basedOnLineNormal orientation unknown
					byLineAngle = (byLineAngle > 90) ? 180 - byLineAngle : byLineAngle;
					
					plotter.line(prev.point, point, {
						strokeStyle: "black",
						lineWidth: 3,
						strokeStyle: (productPalette.line[prev.L.order] || { css: '#000' }).css
					});
					plotter.textByLine(
						length +
							(prev.L.index ? ' (' + prev.L.index + ')' : '') +
							(byLineAngle ? ' ∟' + byLineAngle + '°' : ''),
						point, 
						prev.point, {
							fontSize: 1.2,
							fillStyle: (productPalette.line[prev.L.order] || { css: '#000' }).css
						}
					);
					
					// R
					plotter.line(center, point, 'division');
					plotter.textByLine(Product.lengthUnify(plotter.distance(point, center)),
							point, center, { fontSize: 1 });
					
					// vertex label
					var vertex = this.vertex;
					setTimeout(function(){
						plotter.vertexLabel(vertex.index, point, vertex.$super.line.length);
					});
					
					prev.point = point;
					break;
			}
		});
	},
	
	meter: function(){
		const product = this,
			R = product.R, R2 = R * R,
			meter = {},
			points = product.face.$points.get(),
			sides = points.map((p, i) => p.distance(points[i + 1] || points[0]));
		
		meter[__('Polygons')] = {};
		
		meter[__('Polygons')][__('Coverage area, m2')] =
			R2 * sides.slice(1, -1).reduce((sum, side, i) => {
				const A = points[i + 1], B = points[i + 2];
				
				return sum + Metrics.triangleHeronArea(side, points[0].distance(A), points[0].distance(B));
			}, 0);
		
		meter[__('Polygons')][__('Sum of perimeters, m')] =
			R * _.reduce(sides, (S, P) => S + P, 0);
		
		return meter;
	}
});
