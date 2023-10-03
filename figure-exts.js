!function(){
	var __pointsEnum, __points, __faces, __lines;

	/**
	 * Dividing the faces of a figure (equal arcs)
	 * @return this
	 */
	Figure.prototype.splitFaces_EA = function(N) {
		var figure = this;

		// init
		__faces = [];
		__lines = {};
		__points = {};
		__pointsEnum = 0;

		// save prev points
		_.each(figure.$points, function(p){
			__points[p._enum = __pointsEnum++] = p;
		});

		var triIndex = 0;
		_.each(this.$primitives, function(p){
			if (p.type == 'face') {
				// init edge points
				var A = p.points[0], B = p.points[1], C = p.points[2];
				var AB = [A, B], BC = [B, C], CA = [C, A];
				_.each([AB, BC, CA], function(segment) {
					var a = segment[0], b = segment.pop();
					for (var i = 1; i < N; i++)
						segment.push(edgePoint(a, b, i, N));
					segment.push(b);
				});

				// main
				var up = [A], down;
				for (var n = 1; n <= N; n++) {
					down = [ CA[N - n] ];
					for (var i = 1; i < n; i++) {
						if (n == N) {
							down.push(BC[N - i]);
						} else {
							var point = findPoint(
								AB[n], CA[N - n],
								BC[N - i], AB[i],
								CA[N - n + i], BC[n - i],
								A, i
							);
							down.push(point);
						}
					}
					down.push(AB[ n ]);

					// collect faces
					for (i = 0; i < n; i++) {
						addFace(up[i], down[i + 1], down[i], [n, N - i, N - n + i + 1], triIndex);
						if (i > 0)
							addFace(down[i], up[i - 1], up[i], [n - 1, N - i, N - n + i], triIndex);
					}
					up = down;
				}
				triIndex++;
			}
		});

		__points = _.map(_.values(__points), function(point) {
			return new Figure({
				type: 'vertex',
				points: [point],
				center: point.center
			});
		});

		console.log('points', __points.length, 'lines', _.values(__lines).length, 'faces', __faces.length);

		this.$primitives = $( __points.concat(_.values(__lines)).concat(__faces) );

		return this;
	}

	Figure.prototype.splitFaces_EA_updateToMexican = function(N) {
		var lines = _.filter(this.$primitives, function(p){
				return (p.type == 'line') // && (2 <= p.sideDistance && p.sideDistance < N);
			});

		Figure.equalizeLineGroups(
			_.groupBy(lines, 'sideDistance')
		);

		return this;
	}

	Figure.prototype.splitFaces_updateToClassII = function() {
		console.time('Update to Class II');

		// prepare relations
		this.relations();

		// first wave
		var prevVertexWave = this.$primitives.map(function() {
			this.sideDistance = 0;
			this.underWave = (this.type == 'vertex') && this.$points[0].pptPoint;
			this.underLine = this.underWave ? 5 : 0;
			this.underLine1 = 0;
			return this.underWave ? this : null;
		});
		var lines = [];

		do {
			var vertexWave = [], lineWave = [];
			_.each(prevVertexWave, function(prevVertex) {
				var prevSideDistance = prevVertex.sideDistance;
				_.each(prevVertex.$super.line, function(line) {
					if (!line.underWave) {
						lineWave.push(line);
						_.each(line.$sub.vertex, function(vertex) {
							if (vertex != prevVertex && !vertex.lastWave) {
								if (!vertex.underLine)
									vertexWave.push(vertex);
								vertex.sideDistance += prevSideDistance;
								if (1 == prevSideDistance)
									vertex.underLine1++;
								vertex.underLine++;
							}
						});
						line.underWave = true;
					}
				});
			});

			_.each(vertexWave, function(vertex) {
				vertex.sideDistance /= vertex.underLine;
				if (vertex.underLine % 2)
					vertex.sideDistance++;
				else if (vertex.underLine == vertex.underLine1)
					vertex.sideDistance = 0;
				vertex.lastWave = true;
			});

			_.each(lineWave, function(line) {
				var lengths = _.pluck(line.$sub.vertex, 'sideDistance');
				if (lengths[0] == lengths[1] && lengths[0] == 1)
					line.sideDistance = 0;
				else
					line.sideDistance = lengths[0] + lengths[1];
			});

			lines = lines.concat(lineWave);

			prevVertexWave = vertexWave;
		} while (lineWave.length);

		console.log(_.groupBy(lines, 'sideDistance'));

		Figure.equalizeLineGroups(
			_.groupBy(lines, 'sideDistance')
		);

		// clean
		_.each(this.$primitives, function(f) {
			delete f.sideDistance;
			delete f.underLine;
			delete f.underWave;
			delete f.lastWave;
		});

		console.timeEnd('Update to Class II');

		return this;
	};

	Figure.prototype.splitFaces_updateToClassIII = function (M, N) {
		var figure = this,
			subdivisionScheme = [],
			pointsEnum = _.chain(this.$points).pluck('_enum').max().value();

		isNaN(pointsEnum) && console.error('points enum is', pointsEnum);

		M = Number(M);
		N = Number(N);
		var S = M * M + M * N + N * N;

		// prepare entities relation info
		this.relations();

		// make a Class III M,N subdivision scheme
		!function() {
			var base = [
					[-M - N, N, M], // n vector
					[-M, M + N, - N] // m vector
				],
				trio = [ [0, 0], [N, M], [M + N, -N] ],
				trioSquare = square.apply(null, trio);

			for (var y = -N; y < M; y++) {
				for (var x = 0; x < M + N; x++) {
					triangle([x, y], [x, y + 1], [x + 1, y]);
					triangle([x + 1, y + 1], [x + 1, y], [x, y + 1]);
				}
			}

			// assertions
			if (subdivisionScheme.length != S) {
				console.error('Class III: bad scheme with size', subdivisionScheme.length, 'expected', S);
			}
			var integer = _.chain(subdivisionScheme).map(function(f) {
					return _.map(f, roundS);
				}).value(),
				stat = _.chain(integer).flatten(true).map(function(p){ return _.sortBy(p).join() }).countBy().value();
			_.each(stat, function(count) {
				if (count % 3) {
					console.error('Class III: wrong symmetry on scheme', integer);
				}
			});
			// end

			function triangle(A, B, C) {
				var center = alter2base([ (A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3 ]),
					points = _.map([A, B, C], alter2base),
					inFace = _.countBy(points, function(p) { return _.all(p, positive) });

				if (
					_.all(center, positive) // center belongs to face
					|| (
						!_.some(center, negative) && // center belongs to edge of face
						inFace["true"] > inFace["false"] // inner vertices GT outer
					)
				) {
					subdivisionScheme.push(points);
					/*if (inFace["false"] == 2 || (!_.some(center, negative) && !_.all(center, positive))) {
						console.log(
							'scheme face: center', center, //_.map(center, function(c){ return Math.round(c*S*3) / 3 }),
							inFace, '=>', points
						);
					}*/
				}
			}

			// translate coords to face-based
			function alter2base(alter) {
				var coords = _.reduce(base, function(result, axis, axisIndex) {
						_.each(axis, function(axisCoord, axisCoordIndex) {
							result[axisCoordIndex] += axisCoord * alter[axisIndex] / S;
						});
						return result;
					}, [1, 0, 0]);

				// assertions
				Math.abs(_.reduce(coords, sum, 0) - 1) < 1e-9
					|| console.error('Class III: bad coords of subdivision point', coords);
				_.filter(coords, negative).length <= 1
					|| console.error('Class III: bad coords with greater than 1 negative', coords);

				return coords;
			}

			// 2d
			function diff(B, A) {
				return [B[0] - A[0], B[1] - A[1]];
			}
			function square(A, B, C) {
				A = diff(A, C);
				B = diff(B, C);
				return A[0] * B[1] - A[1] * B[0];
			}
		}();

		//console.log(_.map(faces, function(pp) { return _.map(pp, function(p) { return p[0] + p[1] + p[2] }) }));

		// subdivision each face by scheme
		!function() {
			var prevPrimitivesLength = figure.$primitives.length,
				addedLines = {};

			_.each(_.where(figure.$primitives, { type: 'vertex' }), function(vertex) {
				vertex.$points[0].vertex = vertex;
			});

			_.each(_.where(figure.$primitives, { type: 'face' }), function(face) {
				var facePoints = face.$points;

				_.each(subdivisionScheme, function(pointsCoords) {
					var points = _.map(pointsCoords, coords2point);

					figure.$primitives.push(new Figure({
						type: 'face',
						points: points
					}));
					//console.log('+ face');

					_.each([1, 2, 0], function(p1, p2) {
						var lineIndex = [points[p1].vertex._enum, points[p2].vertex._enum].sort().join();

						if (!addedLines[lineIndex]) {
							if (_.find(figure.$primitives, function(p) {
								return p.type == 'line' && (
									(points[p1] === p.$points[0] &&points[p2] === p.$points[1]) ||
									(points[p1] === p.$points[1] &&points[p2] === p.$points[0])
								);
							})) {
								console.error('doublet line detected for', points[p1], points[p2]);
							}
							figure.$primitives.push(new Figure({
								type: 'line',
								points: [ points[p1], points[p2] ],
								__enums: [points[p1].vertex._enum, points[p2].vertex._enum]
							}));
							addedLines[lineIndex] = true;
							//console.log('+ line');
						} else {
							//console.log('- decline line', points[p1].vertex._enum, points[p2].vertex._enum);
						}
					});
				});

				function coords2point(coords) {
					var baseIndex = _.indexOf(coords, 1);
					if (baseIndex != -1) {
						// PPT point
						//console.log('PPT point happens')
						return facePoints[baseIndex];
					}

					var negativeIndex = _.indexOf(coords, _.filter(coords, negative)[ 0 ]);
					if (negativeIndex != -1) {
						// point outside of the face
						var linePoints = _.filter(facePoints, function(point, index) {
								return index !== negativeIndex;
							}),
							negativeLine = _.find(face.$sub.line, function(line) {
								var points = line.$points;
								return 0
									|| (points[0] === linePoints[0] && points[1] === linePoints[1])
									|| (points[0] === linePoints[1] && points[1] === linePoints[0]);
							}),
							negativeFace = _.find(negativeLine.$super.face, function(f) { return f !== face }),
							negativePoint = _.difference(negativeFace.$points.get(), face.$points.get())[ 0 ],
							negativeOrdinate = coords[ negativeIndex ],
							base = [];

						/**
						 * Translate coordinates to other face by negative ordinate
						 *
						 *  (A, B, C) * (a, b, c) === (A, B, A + B - C) * (x, y, z)
						 * =>
						 *  z = -c
						 *  y = b + c
						 *  x = a + c
						 * where
						 *  (A + B - C)  new base ordinate
						 */
						coords = _.map(coords, function(coord, index) {
							base[index] = (negativeIndex === index) ? negativePoint : facePoints[index];
							return (negativeIndex === index) ? - coord : coord + negativeOrdinate;
						});

						// assert
						Math.abs(_.reduce(coords, sum, 0) - 1) < 1e-9
							|| console.error('Class III: bad coords for negative face', coords);
					}

					// find or calc new point
					return (function(face, base) {
						face.classIIIPoints = face.classIIIPoints || [];

						// make stamp of face-based coordinates of point
						var stamp = _.map(base, function(point, index) {
								return {
									order: point.vertex._enum,
									value: coords[index]
								};
							});
						stamp = _.pluck(_.sortBy(stamp, 'order'), 'value');

						// try to find similar class III point produced previous to
						var found = _.find(face.classIIIPoints, function(memo) {
								return _.all(memo.stamp, function(memoOrdinate, index) {
									return Math.abs(memoOrdinate - stamp[index]) < 1e-9;
								});
							});
						if (found) {
							//console.log('memoized point happens')
							return found.point;
						}

						// else calc new point
						var point = _.reduce(base, function(absolute, axis, index) {
								absolute.x += axis.x * coords[index];
								absolute.y += axis.y * coords[index];
								absolute.z += axis.z * coords[index];
								return absolute;
							}, new Vector);

						// memoize
						face.classIIIPoints.push({
							stamp: stamp,
							coords: coords,
							point: point
						});

						// new vertex promitive
						point.vertex = new Figure({
							type: 'vertex',
							points: [ point.normalize() ],
							negative: !!negativeFace
						});
						figure.$primitives.push(point.vertex);
						//console.log('+ vertex');

						point._enum = ++pointsEnum;

						return point;
					})(negativeIndex != -1 ? negativeFace : face, negativeIndex != -1 ? base : facePoints);
				}
			});

			// remove previous primitives
			figure.$primitives = $(
				_.filter(figure.$primitives, function(primitive, index) {
					// clear points memo
					delete primitive.classIIIPoints;

					return index >= prevPrimitivesLength ||
						primitive.type == 'vertex'; // save PPT points only
				})
			);

			// figure points
			figure.$points = $(
				_.chain(figure.$primitives).pluck('$points').invoke('get').flatten().uniq().value()
			);
		}();

		return this;

		// any helpers
		function positive(v) { return v > 1e-9 }
		function negative(v) { return v < -1e-9 }
		function zero(v) { return Math.abs(v) < 1e-9 }
		function sum(a, b) { return a + b }
		function roundS(p) { return _.map(p, function(c) { return Math.round(c*S) }) }
	};


	/**
	 * Lines length equalizer
	 * @static
	 * @return undefined
	 */
	Figure.equalizeLineGroups = function(lineGroups, diffPrecision, stepLimit) {
		console.time('Lengths equalizer');

		diffPrecision = diffPrecision || 1e-12;
		stepLimit = stepLimit || 300;

		var usedPoints = _.chain(lineGroups).flatten().pluck('$points').invoke('get').flatten().uniq().value();

		var step = 0;
		do {
			var delta = 0;
			// prepare
			_.each(lineGroups, function(lines, group) {
				_.each(lines, function(line) {
					line.__dirs = [
						Vector.subtract(line.$points[0], line.$points[1]),
						Vector.subtract(line.$points[1], line.$points[0])
					];
					line.length = line.__dirs[0].length();
				});
			});
			// change
			_.each(lineGroups, function(lines, group) {
				var lengths = _.pluck(lines, 'length'),
					diff = _.max(lengths) - _.min(lengths);

				if (diff < diffPrecision) return;
				delta = Math.max(delta, diff);

				var avgLength = _.reduce(lengths, function(a, l){ return a + l }, 0) / lengths.length;

				// try to move points
				_.each(lines, function(line) {
					var q = (avgLength - line.length) / line.length / 4;
					_.each(line.$points, function(point, i) {
						point.add(Vector.scale( line.__dirs[i], q ) );
					});
				});
			});
			// normalize
			_.each(usedPoints, function(point) {
				point.normalize();
			});
		} while (delta && ++step < stepLimit);

		// clean
		_.each(lineGroups, function(lines, group) {
			_.each(lines, function(line) {
				delete line.__dirs;
			});
		});

		console.log('Lengths equalizer: lines reduced by', step, 'steps, final delta', delta);
		console.timeEnd('Lengths equalizer');
	}

	// private helpers
	function findPoint(a1, a2, b1, b2, c1, c2, control, step) {
		var planes = _.map([ [a1, a2], [b1, b2], [c1, c2] ], function(pair) {
			var normal = Vector.crossProduct(pair[0], pair[1]).normalize();
			return new Plane(normal, 0);
		});

		var ABC = [];
		for (var i = 0, j = 2; i < 3; j = i, i++) {
			var vars = $.map(Solutions.twoPlanesAndSphere(planes[i], planes[j]), function(v) {
				return Vector.dotProduct(v, control) > 0 ? v : null;
			});
			if (vars.length != 1)
				console.log('super bug');
			ABC.push(vars[0]);
		}

		// todo: calc triangle's center point optionally (Euler set)

		// 1) in-center +normalize
		//var point = incenter.apply(this, ABC).normalize();

		// 2) in-center3d
		var point = incenter3d(planes[0], planes[1], planes[2], control);

		// 3) centeroid + normalize
		//	V6 {vertex: 11, line: 10, face: 12}
		//var point = ABC[0].add(ABC[1]).add(ABC[2]).scale(1/3).normalize();

		// 4) out-center3d
//		var pl = [];
//		for (var i = 0, j = 2; i < 3; j = i++) {
//			var ACmid = Vector.add(ABC[i], ABC[j]).scale(1/2);
//			var ACnorm = Vector.subtract(ABC[i], ABC[j]).normalize();
//			pl.push( new Plane(ACnorm, ACmid).normalize() );
//		}
//
//		var solpp = [];
//		for (var i = 0, j = 2; i < 3; j = i++) {
//			var vars = $.map(Solutions.twoPlanesAndSphere(pl[i], pl[j]), function(v) {
//				return Vector.dotProduct(v, control) > 0 ? v : null;
//			});
//			if (vars.length != 1)
//				console.log('super bug');
//			solpp.push( vars[0] );
//		}
		//var point = solpp[0];

		// equals distances assertion
		//var testDist = _.map(planes, function(pl) { return pl.result(point) });
		//console.log( testDist, _.max(testDist) - _.min(testDist) );

		point._enum = __pointsEnum++;
		var key = [ a1._enum, a2._enum, step ].join();
		__points[key] = point;
		//console.log(key)

		return point;
	}

	function edgePoint(A, B, i, N, key) {
		key = key || (
			A._enum < B._enum ?
				[A._enum, B._enum, i].join() :
				[B._enum, A._enum, N - i].join()
			);

		if (i * 2 > N) return edgePoint(B, A, N - i, N, key);

		if (__points[key]) return __points[key];

		var cos = A.cosWith(B);
		var Y = Vector.subtract(B, A.clone().scale(cos)).normalize();
		var angle = Math.acos(cos) * i / N;
		var point = Y.scale(Math.sin(angle)).add( A.clone().scale(Math.cos(angle)) );

		point._enum = __pointsEnum++;
		point.triSide = true;
		__points[key] = point;
		//console.log(key)

		return point;
	}

	function addFace(A, B, C, sideDistances, triIndex) {
		__faces.push(new Figure({
			type: 'face',
			points: [A, B, C]
		}));
		_.each([ [B, C], [C, A], [A, B] ], function(pair, i) {
			var key = _.pluck(pair, '_enum').sort().join();
			//console.log(key);
			__lines[key] = __lines[key] || new Figure({
				type: 'line',
				points: pair,
				sideDistance: sideDistances[i],
				sideIndex: i,
				triIndex: triIndex
			});
		});
	}

	// plain incenter
	function incenter(A, B, C) {
		var AB = Vector.subtract(B, A);
		var AC = Vector.subtract(C, A);
		var BC = Vector.subtract(C, B);
		var Ab = AB.clone().normalize().add( AC.clone().normalize() );
		var angle = AB.angleWith(AC);
		var l = [AB.length(), AC.length(), BC.length()];
		var p = (l[0] + l[1] + l[2]) / 2
		var S = Math.sqrt( p * (p - l[0]) * (p - l[1]) * (p - l[2]) );
		var r = S / p;
		var incenter = Ab.scale(
			(r / Math.sin(angle / 2)) / Ab.length()
		).add(A);

		// assertion
		var a = Vector.distance(B, C), b = Vector.distance(A, C), c = Vector.distance(A, B);
		_.each([ [A,B,C], [B,C,A], [C,A,B] ], function(test) {
			var v1 = Vector.subtract(test[0], test[1]);
			var v2 = Vector.subtract(test[2], test[1]);
			var bisect = v1.clone().normalize().add( v2.clone().normalize() );
			var angle = v1.angleWith(v2);
			var a1 = v1.angleWith(bisect);
			var a2 = v2.angleWith(bisect);

			if (Math.abs(a1 + a2 - angle) > 1e-13)
				console.warn('a1 + a2 != angle');
			if (Math.abs(a1 - a2) > 1e-13)
				console.warn('a1 != a2');
		});

		return incenter;
	}

	// spherically incenter
	function incenter3d(p1, p2, p3, control) {
		var bisect1 = new Plane(p1.A - p2.A, p1.B - p2.B, p1.C - p2.C, p1.D - p2.D);
		var bisect2 = new Plane(p3.A - p2.A, p3.B - p2.B, p3.C - p2.C, p3.D - p2.D);

		var vars = $.map(Solutions.twoPlanesAndSphere(bisect1, bisect2), function(v) {
			return Vector.dotProduct(v, control) > 0 ? v : null;
		});
		if (vars.length != 1)
			console.error('incenter3d bug');
		return vars[0];
	}
}();

