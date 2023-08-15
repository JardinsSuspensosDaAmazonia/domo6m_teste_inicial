/**
 * Определение продукта "ребро"
 * 
 * @author   popitch [at yandex.ru]
 */

Product.Rib = function() {
	Product.apply(this, arguments);

	// expected
	this.line || console.log('no line specified');

	// init plane cache
	this.cache.plane = {};
}
.inherits(Product)
.override({
	// отдает плоскость, рассекающую ребро пополам и проходящую через центры радиусов вершин
	getPlane: function(useBindedFace) {
		if (this.cache.plane[useBindedFace])
			return this.cache.plane[useBindedFace];

		var line = this.line,
			vv = line.origin.$subsets.get(),
		    pp = [ vv[0].$points[0], vv[1].$points[0] ],
		    center = line.origin.center || pp[0].center || Vector(0);// ? pp[1].center ? pp[0].center.equals(pp[1].center) ? pp[0].center :
		/**
		 * 1) A*cx + B*cy + C*cz + D = 0
		 * 2) A*x0 + B*y0 + C*z0 + D = d0
		 * 3) A*x1 + B*y1 + C*z1 + D = -d1
		 * 4) A*A  + B*B  + C*C      = 1
		 */
		// если line на краю, либо данный конец на краю, то смещение 0
		var d0 =  vv[0].product.ribPlaneOffset(line),
			d1 = -vv[1].product.ribPlaneOffset(line);
		var sols = Solutions.twoPlanesAndSphere(
				new Plane(Vector.subtract(pp[0], center), -d0),
				new Plane(Vector.subtract(pp[1], center), -d1)
			);
		sols.length ||
			console.log('no plane no cry');

		var lineNormal = Vector.crossProduct(Vector.subtract(pp[0], center), Vector.subtract(pp[1], center));

		for (var i = 0; i < sols.length; i++) {
			var n = sols[i],
				D = -Vector.dotProduct(n, center); // 1) D
			var pl = sols[i] = new Plane(n, D);
			pl.sign = n.cosWith(lineNormal) > 0 ? 1 : -1;
			
			// debug
			pl.reflect = vv[i].reflection;
			pl.mapi = n.mapi;
			pl.solutions = n.solutions;
			
			/** tests
			 * 1) A*cx + B*cy + C*cz + D = 0
			 * 2) A*x0 + B*y0 + C*z0 + D = d0
			 * 3) A*x1 + B*y1 + C*z1 + D = -d1
			 */
			var testc = pl.A*center.x + pl.B*center.y + pl.C*center.z + pl.D;
			var test0 = pl.A*pp[0].x + pl.B*pp[0].y + pl.C*pp[0].z + pl.D;
			var test1 = pl.A*pp[1].x + pl.B*pp[1].y + pl.C*pp[1].z + pl.D;
			if (testc != 0)
				console.warn('!' + testc);
			if (Math.abs(d0 - test0) > 1e-6)
				console.warn('d0:' + d0 + ' != ' + test0);
			if (Math.abs(d1 - test1) > 1e-6)
				console.warn('d1:' + d1 + ' != ' + test1);
		}
		
		if (sols.length == 2 && sols[0].sign == sols[1].sign)
			console.log({ sols: sols, lineNormal: lineNormal });
		
		// выбор решения
		var plane = ( sols.length == 2 ? sols[0].sign == 1 ? sols[0] : sols[1] : sols[0] ).normalize();

		// Good Karma's (+Semicone) workaround
		if (useBindedFace === true && line.bindedFace) {
			// move plane to side of binded face
			var testPoint = _.filter(line.bindedFace.$sub.vertex, function(vertex) {
					return !_.contains(line.origin.$vertexes, vertex);
				})[0].$points[0];
			plane.D += (plane.result(testPoint) < 0 ? 1 : -1) * this.thickness / 2;
		}

		return this.cache.plane[useBindedFace] = plane;
	},
	
	// отдает конфигурацию оконцовок
	/*final*/ getTails: function(){
		var line = this.line;

		if (this.cache.tails)
			return this.cache.tails;

		// 1. get tails separately
		var tails = line.origin.$vertexes.map(function() {
				var vertex = this,
					tail = vertex.product.getTail(line);

				tail.product = vertex.product;
				return tail;
			});

		// 2. common calculator
		tails = this.afterGetTails(tails);

		// 3. separate again
		tails = tails.map(function(i){
			if (!this.iwas){
				this.product.afterTailsGiven(this, i, line);
				this.iwas = 1;
			}
			return this;
		});

		return this.cache.tails = tails;
	},
	
	afterGetTails: function(tails){
		return tails;
	},
	
	getOuterPlane: function(){
		// !! допущения:
		// 1. both centers is (0,0,0)

		var A = this.line.$points[0], a = A.length(),
		    B = this.line.$points[1], b = B.length(),
			AB = B.clone().subtract(A).normalize();
		//var doubleSquare = Vector.crossProduct(A, B);

		var comp = Vector.dotProduct(A, AB);
		var P = AB.scale(-comp).add(A);

		return new Plane(P, P);
	},

	// максимальная длина продукта,
	maxLength: function(){}
});

/**
 * Брус
 * @param Figure line
 * @param {} params
 */
Product.Rib.Beam = function(params) {
	Product.Rib.apply(this, [
		$.extend({
			type: 'Beam',
			title: 'Брус',
			width: 0,     // ширина бруса (в радиусах) - параллельна радиусу
			thickness: 0, // толщина
			R: 0          // радиус сферы должен быть известен!
		}, params || {})
	]);
	
	// габариты приводим к долям радиуса, а получаем в неких единицах измерения
	this.width *= (this.measure || 1) / this.R;
	this.thickness *= (this.measure || 1) / this.R;
}
.inherits(Product.Rib)
.override({
	afterGetTails: function(tails) {
		var product = this;
		var outerPlane = this.getOuterPlane();
		var plane = this.getPlane(true);

		return tails.each(function(i){
			var dir = Vector.subtract(tails[1-i].outer, this.outer);
			
			// save for given
			this.backDir = dir.clone();
			
			// .outer принадлежат срединной плоскости (ориентирующей продукт)
			// .inner считаем
			var vect = Vector.crossProduct(plane.normal(), this.wall.normal());
			vect.scale(
				Vector.dotProduct(Vector.subtract(this.outer, this.center), vect) > 0 ? -1 : 1
			);
			var cos = vect.cosWith(dir),
				sin = Math.sqrt(1 - cos*cos);
			vect.normalize().scale(product.width / sin);
			this.inner = Vector.add(this.outer, vect);
			
			// для определения отреза требуются вектора отклонения вершин от этой плоскости к бокам бруса
			this.walkers = [ Vector.crossProduct(this.wall.normal(), outerPlane.normal()) ];
			this.walkers[0].normalize();
			this.walkers[0].scale(0.5 * product.thickness / plane.normal().cosWith(this.walkers[0]));
			this.walkers[1] = this.walkers[0].clone().scale(-1);
			
			if (this.coneAngle){
				// Cone this
				dir.normalize().scale( product.thickness / 2 / Math.tan(this.coneAngle) / sin );
				this.walkers[0].add(dir);
				this.walkers[1].add(dir);
			}
		});
	},
	
	unify: function(){
		var product = this;
		var tails = this.getTails();

		var unifiers = tails.map(function(i){
			var tail = this;
			var dir = Vector.subtract(tails[1-i].outer, this.outer).normalize();
			var hOI = Vector.subtract(this.inner, this.outer).scale(.5);
			this.middle = Vector.add(tail.outer, hOI);

			var direct = Vector.dotProduct(Vector.crossProduct(this.walkers[0], hOI), dir) > 0;

			// [left, right] bevels
			this.bevelSides = [
				Vector.component(this.walkers[ direct ? 0 : 1 ], dir),
				Vector.component(this.walkers[ direct ? 1 : 0 ], dir)
			];

			// если меньше градуса отклонение, то считаем что его нет
			for (var j = 0; j < 2; j++){
				if (Math.abs(this.bevelSides[j] * 50) < product.thickness / 2)
					this.bevelSides[j] = 0;
			}

			// left = right = 0
			this.bevelZero = !this.bevelSides[0] && !this.bevelSides[1];
			// left + right = 0
			this.bevelStraight = Math.abs(this.bevelSides[0] + this.bevelSides[1]) < 1e-6;
			// left = right
			this.bevelsEquals = Math.abs(this.bevelSides[0] - this.bevelSides[1]) < 1e-6;
			// else
			this.bevelChaos = !this.bevelZero && !this.bevelStraight && !this.bevelsEquals;

			// inner bevel (outer bevel = 0)
			this.bevelInner = Vector.component(hOI, dir);

			var PI2 = Math.PI / 2;
			var inner = Math.atan2(this.bevelInner, product.width / 2);
			var left = Math.atan2(this.bevelSides[0], product.thickness / 2);
			var right = Math.atan2(this.bevelSides[1], product.thickness / 2);

			return ( !Math.round(inner*500) ? 'T' : (inner < PI2 ? 'A' : 'B') + Product.angleUnify(inner < PI2 ? PI2 - inner : inner - PI2) ) +
				(this.bevelZero ?
					'Piped' :
				(this.bevelStraight ?
					'Joint/GoodKarma/Semicone' + (left > 0 ? 'L' : 'R') + Product.angleUnify(left > 0 ? left : -left) :
				(this.coneAngle ?
					'Cone' + Product.angleUnify(this.coneAngle)
				: // Nose only
					(Math.round(left*500) ? '-L' + Product.angleUnify(left) + dihedralMark(left, inner) : '') + 
					(Math.round(right*500) ? '-R' + Product.angleUnify(right) + dihedralMark(right, inner) : '')
				))) +
				'(' + tail.vertex.index + ')';

			function dihedralMark(side, inner){
				var normalOuter = new Vector(0, 0, 1);
				var byOuter = new Vector(Math.sin(side), Math.cos(side), 0);
				var toInner = new Vector(Math.sin(inner), 0, Math.cos(inner));
				var normalCut = Vector.crossProduct(toInner, byOuter);
				var dihedral = normalCut.angleWith(normalOuter);
				var mark = Product.angleUnify(PI2 - dihedral);
				return mark == 0 ? '' : '-I' + mark;
			}
		});
		unifiers.sort();

		// for calc min/max
		this.midLength = tails[0].middle.distance(tails[1].middle);

		return 'Length' + Product.lengthUnify(this.maxLength() * product.R) +
						' ' + unifiers.get().join(' ');
	},
	
	maxLength: function(){
		var maxLength = this.midLength;
		this.getTails().each(function(){
			if (_.contains(['Joint', 'GoodKarma', 'Semicone'], this.vertex.product.type))
				maxLength += Math.abs(this.bevelSides[0]);
			//if (this.bevelInner < 0)
				maxLength += Math.abs(this.bevelInner);
		});
		return maxLength;
	},

	minLength: function(){
		var minLength = this.midLength;
		this.getTails().each(function(){
			if (_.contains(['Joint', 'GoodKarma', 'Semicone'], this.vertex.product.type))
				minLength -= Math.abs(this.bevelSides[0]);
			//if (this.bevelInner > 0)
				minLength -= Math.abs(this.bevelInner);
		});
		return minLength;
	},

	model: function(onExport){
		var product = this;
		var tails = this.getTails();
		
		var pp = [];
		$([tails[0].outer, tails[0].inner, tails[1].inner, tails[1].outer]).each(function(i){
			var tail = tails[i >> 1];
			
			if (isNaN(tail.walkers[0].x) || isNaN(tail.inner.x) || isNaN(tail.outer.x))
				console.log('isNaN(tail.walker.x) || isNaN(tail.inner.x) || isNaN(tail.outer.x)');
			
			pp.push(this.clone().add(tail.walkers[0]));
			pp.push(this.clone());
			pp.push(this.clone().add(tail.walkers[1]));
		});
		
		var faces = [
			[ pp[1], pp[0], pp[3], pp[4] ], // one tail sides
			[ pp[2], pp[1], pp[4], pp[5] ],
			[ pp[10], pp[11], pp[8], pp[7] ], // second tail sides
			[ pp[9], pp[10], pp[7], pp[6] ],
			[ pp[4], pp[3], pp[6], pp[7], pp[8], pp[5]], // inner face
			[ pp[0], pp[9], pp[6], pp[3] ], // side
			[ pp[2], pp[5], pp[8], pp[11] ], // side
			[ pp[1], pp[2], pp[11], pp[10], pp[9], pp[0] ], // outer face
		];
		
		// model on export
		if (onExport){
			return faces;
		}
		
		var cont = new Figure.Container({
				figures: $([
						faces.pop() // outer only
					]).map(function(){
						// ориентация полигона
						var polypp = this, outerp;
						
						$(pp).each(function(){
								if (-1 == $.inArray(this, polypp))
									outerp = this;
							});
						
						var normal = Vector.crossProduct(
								Vector.subtract(polypp[1], polypp[0]),
								Vector.subtract(polypp[2], polypp[0]));
						if (Vector.dotProduct(Vector.subtract(outerp, polypp[0]), normal) < 0){
							var reverted = [], p;
							while (p = polypp.shift())
								reverted.push(p);
							polypp = reverted;
						}
						
						return new Figure({
							type: 'polygon',
							points: polypp
						});
					}),
				points: pp,
				source: this.line
			});
		cont.$primitives.each(function(){
			this.figure = product.line.figure;
		});
		return cont;
	},

	// draw product scheme on canvas
	// @param DomElement canvas
	// @param Object options  plotter options
	plot: function(canvas, options){
		var product = this;
		var tails = this.getTails();
		var sizeOfTail = _.map(tails, function(tail) {
				return 2 * _.max(_.map(tail.bevelSides, Math.abs)) + Math.abs(tail.bevelInner);
			}),
			xGaps = [];

		var margin = 20, // px
			milkRight = 20, // px
			xyRatio = ( $(canvas).width() - 2 * margin - milkRight ) / ( $(canvas).height() - 2 * margin ),
			maxLength = product.maxLength(),
			maxVisibleLength = xyRatio * product.thickness,
			gapVisibleWidth = product.thickness / 4;

		if (product._xGaps) {
			xGaps = product._xGaps;
		}
		else
		if (maxLength > maxVisibleLength) {
			var productDelta = product.maxOuterLength - product.minOuterLength;

			if (productDelta) {
				var visibleProductLength = maxVisibleLength * (.6 + .4 * (maxLength - product.minOuterLength) / productDelta),
					gapDelta = maxLength - visibleProductLength;
			} else {
				var gapDelta = maxLength - maxVisibleLength;
			}

			var gapStart = sizeOfTail[0] + (maxLength - sizeOfTail[0] - sizeOfTail[1]) / 2 - gapDelta / 2;

			if (gapStart > sizeOfTail[0]) {
				xGaps.push({
					x: gapStart,
					from: gapDelta + gapVisibleWidth,
					to: gapVisibleWidth
				});
			} else {
				gapDelta = maxLength - sizeOfTail[0] - sizeOfTail[1];
				xGaps.push({
					x: sizeOfTail[0],
					from: gapDelta + gapVisibleWidth,
					to: gapVisibleWidth
				});
			}

			//console.log(product.line.index, maxVisibleLength, maxLength, xGaps[0])

			// store for single gaps style for both side- and front- scheme views
			product._xGaps = xGaps;
		}

        options = options || {};

		if (options.sideView) {
			// rotate tails to swap
			_.each(tails, function(tail) {
				var bi = tail.__bevelInner = tail.bevelInner,
					bs = (tail.__bevelSides = tail.bevelSides)[0];

                tail.bevelInner = Math.abs(bs);
                tail.bevelSides = Math.sign(bs) > 0 ? [-bi, bi] : [bi, -bi];
			});

            var plotter = new Plotter.Beam(canvas, $.extend(options, {
					depth: this.thickness,
					width: this.maxOuterLength,
					length: this.maxLength(),
					height: this.width, // ширина доски (бруса)
					margin: margin,
					milkRight: milkRight,
					resize: false,
					R: this.R,
					xGaps:  xGaps,
					textZoom: 2,
					fixOutXProportion: true
				}))
                .ydivision(0, 'left', 'top')
                .ydivision(this.width, 'left', 'bottom')
                .start(this, tails[0])
                .tail(tails[0], false, 'left', this)
                .offset({ x: this.midLength })
                .tail(tails[1], true, 'right', this)
                .end();

            // return tails from swap
            _.each(tails, function(tail) {
                tail.bevelInner = tail.__bevelInner;
				tail.bevelSides = tail.__bevelSides;
            });

			return;
		}

		var plotter = new Plotter.Beam(canvas, $.extend(options, {
				depth: this.width,
				width: this.maxOuterLength,
				length: this.maxLength(),
				height: this.thickness, // толщина доски (бруса) рисуется в высоту
				margin: margin,
				milkRight: milkRight,
				resize: false,
				R: this.R,
				xGaps:  xGaps,
				textZoom: 2,
				fixOutXProportion: true
			}))
			.ydivision(0, 'left', 'top')
			.ydivision(this.thickness, 'left', 'bottom')
			.start(this, tails[0])
			.tail(tails[0], false, 'left', this)
			.offset({ x: this.midLength })
			.tail(tails[1], true, 'right', this)
			.end();
		
		// side angles of face
		var line = this.line;
		var byLineNormal = Vector.crossProduct( tails[0].vertex.$points[0], tails[1].vertex.$points[0] );
		
		$.each(line.origin.$super.face, function(i, face){
			if (line.bindedFace && line.bindedFace !== face) return;

			var a = Product.angleUnify( face.product.normal.angleWith(byLineNormal) ) / 10;
			a = (a > 90) ? 180 - a : a; // figure is convex
			var outer = face.$points.not(line.$points)[0];

			var y = (outer.cosWith(byLineNormal) <= 0) ? product.thickness : 0;

			plotter.textByLine(
				'∟' + a + '°',
				{y: y, x: 0},
				{y: y, x: xGaps[0] ? xGaps[0].x + product.thickness * 3 : product.thickness * 5},
				{
					otherSide: !y
				}
			);
		});
	},
	
	materialName: function(){
		return __('Beams') + ' ' +
			Math.round(this.width * this.R / .001) + 'x' + 
			Math.round(this.thickness * this.R / .001)  + __('mm');
	},
	
	meter: function(){
		const mat = this.materialName(),
			meter = {};
		
		// площадь основания (допущение: срез был по оси Y)
		if (1 === this.line.origin.$super.face.length){
			const facePoints = this.line.origin.$super.face[0].$points.get();
			var pp = this.line.$points.get();
			
			// orient line's pp as in his face
			const ppIndex = pp.map(p => facePoints.indexOf(p));
			if ((ppIndex[0] + 1) % facePoints.length !== ppIndex[1]) {
				pp = pp.reverse();
			}
			
			//pp = pp.map(p => (p = p.clone(), p.y = 0, p));
			
			// partial area
			meter[__('Base area, m2')] = (pp[0].x * pp[1].z - pp[1].x * pp[0].z) / 2 * this.R * this.R;
		}
		
		meter[mat] = {};
		meter[mat][__('Total length of beams, m')] = this.maxLength() * this.R;
		meter[mat][__('Total volume of beams, m3')] = this.midLength * this.width * this.thickness * this.R * this.R * this.R;
		meter[mat]['range:' + __('Beam length, mm')] = Product.lengthUnify(this.maxLength() * this.R);
		//meter[mat]['max:' + __('Max. beam length, mm')] = Product.lengthUnify( this.maxLength() * this.R );
		
		// угол сопряжения граней
		var $faces = this.line.origin.$super.face;
		var $normals = $faces.length == 2 ? $faces.map(function(){
				return Vector.crossProduct(
					Vector.subtract(this.$points[0], this.$points[1]),
					Vector.subtract(this.$points[2], this.$points[1])
				);
			}) : false;
		var edgel = $normals ? $normals[0].angleWith($normals[1]) : false;
		if (edgel) {
			meter[mat]['range:' + __('Angle between faces, °')] = 180 - 180 * edgel / Math.PI;
		}
		
		return meter;
	}
});
