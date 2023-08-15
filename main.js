var form = (function() {
	// teach knockout to animate visibility toggling
	(function(visible){
		var originUpdate = visible.update;
		visible.update = function (element, valueAccessor) {
			if (!form.animate || !$(element).closest('.slow-toggle-visibility').length)
				return originUpdate.apply(this, arguments);
			var show = ko.utils.unwrapObservable(valueAccessor());
			show ?
				$(element).slideDown('fast') :
				$(element).slideUp('fast');
		}
	})(ko.bindingHandlers.visible);

	// teach knockout to plot product on canvas
	ko.bindingHandlers.plot = {
		update: function(canvas, valueAccessor) {
			// get bound callback (don't care about context, it's ready-to-use ref to function)
			var product = valueAccessor();

			if (_.isArray(product)) {
				var options = product[1];
				product = product[0];
			}

			// fire callback with new value of an observable bound via 'html' binding
			_.defer(_.bind(product.plot, product, canvas, options));
		}
	};
	
	
	// figure default params
	FigureOptionsVM.defaults = CONFIG.defaultFigure;
	
	
	const form = new FigureOptionsVM(function(state){
		form.trigger('change', state);
	});
	
	// used as dependency by reporting product statistics
	form.resultFigure = ko.observable();

	form.resultMeter = ko.computed(function() {
		var meter = new Meter,
			figure = form.resultFigure(),
			removed = form.removedList(); // depends

		if (!figure) return;

		meter.push(__('Sizes (units)'), _.reduce({
			face: 'Faces',
			line: 'Edges',
			vertex: 'Vertices'
		}, function(stat, title, type) {
			var sizes = 0, total = 0;

			_.chain(figure.$primitives)
				.where({ type: type, /*new important cond*/live: true, removed: false })
				.countBy('index')
				.each(function(count, index) {
					sizes += count > 0;
					total += count;
				});
			stat[__(title)] = sizes + ' (' + total + ')';

			return stat;
		}, {}));

		_.each(['vertex', 'line', 'face'], function(type) {
			_.chain(figure.$primitives)
				.where({ type: type, removed: false })
				.groupBy('index')
				.each(function(list, index) {
					_.each(list, function(figure) {
						meter.push(figure.product.meter());
					});
				});
		});

		return meter;
	}, null, { deferEvaluation: true });

	form.reportText = ko.computed(function() {
		var meter = form.resultMeter();

		return meter ? meter.reportText() : i18n('Please, wait...');
	}, null, { deferEvaluation: true });

	// set flag
	$('form.options').addClass('slow-toggle-visibility');
	
	// flag to animate form elements
	form.animate = true;

	form.update = function(data) {
		_.each(data, function(value, key) {
			if (ko.isObservable(form[key])) {
				form[key]( value );
			}
		});
	};

	return form;
	

	// view model of form
	function FigureOptionsVM(stateReceiver, timeout){
		// const
		this.FULLEREN_TYPE_LIST = ko.computed(function() {
			return [{
				id: 'inscribed',
				name: __('fulleren:Inscribed in')
			}, {
				id: 'described',
				name: __('fulleren:Described around')
			}];
		});
	
		const form = this;

		form.state = {}; // of current

		// manual/auto mode
		!function() {
			var forcibly = 0; // counter for non-manual value change detection

			form.forceBegin = function() { forcibly++ };
			form.forceEnd = function() { forcibly-- };
			form.isModeForcibly = function() { return !!forcibly };
		}();

		/**
		 * init observables from config defaults (with one nested level)
		 * & firing logic..
		 */
		_.each(FigureOptionsVM.defaults, function(value, key) {
			if (_.isObject(value) && !_.isArray(value)) {
				// simplify init of nested
				const subForm = form[key] = {},
					subState = form.state[key] = {};
				
				_.each(value, (subValue, subKey) => {
					subForm[subKey] = ko.observable();
					subForm[subKey].subscribe(function(value) {
						subState[subKey] = value;
						
						fireChange();
					});
				});
				
				return;
			}
			
			form[key] = ko.observable();
			form[key].subscribe(function(value) {
				form.state[key] = value;

				// protect the values of the change is not manually
				if (! form.isModeForcibly() && form[key])
					form[key].manual = value;

				fireChange();
			});
		});
		
		var	lastFiredState;

		// deferred state-change firer
		fireChange = _.wrap(fireChange, function(fire) {
			calcProc.then(fire);
		});
		fireChange = _.debounce(fireChange, 200);

		function fireChange() {
			const state = JSON.stringify(
				_.omit(form.state, 'tentNetAdvancedLineList', 'tentNetLineList', 'tentNetStaticLineList')
			);
			if (state != lastFiredState) {
				stateReceiver(form.state);
			}
			lastFiredState = state;
		}
		
		/**
		 * computed options lists
		 */
		_.each('connTypeList detailList partialList subdivClassList'.split(' '), function(key) {
			form[key] = ko.observable();
		});

		// true subdivMethodList
		this.subdivMethodList = ko.computed(function() {
			var options = [{
					id: 'Chords',
					name: __('method:Equal Chords')
				}].concat(
					form.subdivClass() == 'I' && form.detail() > 2 ? [
						{
							id: 'Arcs',
							name: __('method:Equal Arcs')
						}, {
							id: 'Mexican',
							name: __('method:Mexican')
						}
					] : []
				).concat(
					form.base() === 'Icosahedron' && form.subdivClass() === 'I' && /^(3|4)$/.test(form.detail()) ? [
						{
							id: 'Kruschke',
							name: __('method:Kruschke')
						}
					] : []
				);

			form.subdivMethod(maybe(form.subdivMethod.manual, _.pluck(options, 'id')));

			return options;
		}, this, { deferEvaluation: true });


		// option lists fresher
		function refreshList(what) {
			form.forceBegin();
			_.each(what.split(/\s+/), function(what) {
				refreshList[what]();
			});
			form.forceEnd();
		}

		_.extend(refreshList, {
			detail: function() {
				var list = form.fullerenType() ? _.range(1, 9) : _.range(1, 19);
				if (form.subdivClass() == 'II') {
					list = _.filter(list, function(v) {
						return v % 2 != 1;
					});
				}

				form.detailList(list);
				form.detail( luckyNumber(form.detail.manual, list) );
			},

			subdivClass: function() {
				var classes = [{ 
						id: 'I', 
						name: 'I' 
					}],
					V = form.detail();

				for (var p = 1, q = V - p; p < V / 2; p++, q--) {
					classes.push({
						id: 'III_' + p + ',' + q, 
						name: 'III ' + p + ',' + q
					});
				}

				if (V % 2 == 0) {
					classes.push({
						id: 'II',
						name: 'II'
					});
				}

				for (var p = Math.floor(V / 2 + 1), q = V - p; p < V; p++, q--) {
					classes.push({
						id: 'III_' + p + ',' + q,
						name: 'III ' + p + ',' + q
					});
				}

				form.subdivClassList(classes);
				form.subdivClass(maybe(form.subdivClass.manual, _.pluck(classes, 'id')));
			},

			partial: function() {
				if ('Icosahedron' == form.base()) {
					var partialList = partialList_ClassI(form.detail());
				}
				else if ('Octohedron' == form.base()) {
					partialList = partialList_Octohedron(form.detail());
				}

				form.partialList(partialList);
				form.partial(nearestRational(form.partial.manual, partialList));
			},

			connType: function() {
				var list = ['Piped', 'GoodKarma', 'Semicone'];

				if (form.fullerenType() || form.subdivClass() == 'II' || /^(Chords|Kruschke)$/.test(form.subdivMethod()))
					list.push('Cone');

				list.push(form.fullerenType() ? 'Nose' : 'Joint');

				form.connTypeList(list);
				form.connType(maybe(form.connType.manual, list));
			}
		});

		// lists binding
		form.base.subscribe(function() {
			refreshList('partial');
		});

		form.detail.subscribe(function() {
			refreshList('partial subdivClass');
		});

		form.fullerenType.subscribe(function() {
			refreshList('partial connType detail');
		});

		form.subdivClass.subscribe(function() {
			refreshList('detail');
		});

		form.subdivMethod.subscribe(function() {
			refreshList('connType');
		});
		
		/**
		 * advanced computes
		 */
		form.canAlignTheBase = ko.computed(function() {
			var can = 
				(form.subdivClass() == 'I')
				&& 'Kruschke' !== form.subdivMethod()
				&& ! form.fullerenType()
				&& ! /^1\/[12]$/.test( form.partial() )
				&& /Piped|Joint|GoodKarma|Semicone/.test( form.connType() );

			// force set align
			form.forceBegin();
			form.alignTheBase(can && form.alignTheBase.manual);
			form.forceEnd();

			return can;
		}, null, { deferEvaluation: true });

		// strut view state
		form.strutViewBySide = ko.observable( JSON.parse(localStorage.getItem('acidome.view-strut-by-side') || 'false') );
        form.strutViewBySide.subscribe(function(bySide) {
        	localStorage.setItem('acidome.view-strut-by-side', JSON.stringify(bySide));
		});
		
		/**
		 * clothier [deprecated]
		 */
		form.clothier = {
			width: ko.observable(),
			height: ko.observable(),

			onRun: ko.observable(false),
			onPause: ko.observable(false),

			run: function() {
				form.clothier.onRun(true);
				form.clothier.onPause(false);
			},
			pause: function() {
				form.clothier.onPause(true);
			},
			stop: function() {
				form.clothier.onPause(false);
				form.clothier.onRun(false);
			}
		};

		// removed figure entities (working in "Cover" mode)
		form.removedList = ko.observableArray([]);
		form.removedList.subscribe(function(list) {
			form.state.removedList = list;
			fireChange();
		});

		/**
		 * Tent calculation mode
		 */
		form.tentNetBeginFace = ko.observable(); // =>
		form.tentNetStaticLineList = ko.observableArray([]);
		
		// + texture
		form.tentNetTextureName = ko.observable();
		
		// + advanced separators
		form.tentNetAdvancedLineList = ko.observableArray([]);
		
		// = sum
		form.tentNetLineList = ko.computed(function() {
			var staticList = form.tentNetStaticLineList(),
				advancedList = form.tentNetAdvancedLineList(),
				commonList = staticList.concat(advancedList);
			
			form.state.tentNetLineList = commonList;
		
			return commonList;
		});
		
		// reset tent net
		form.resetTentNet = function() {
			form.tentNetBeginFace(null);
			form.tentNetStaticLineList([]);
			form.tentNetAdvancedLineList([]);
		};

		// auto init net by begin face
		form.tentNetBeginFace.subscribe(function(beginFaceIndex) {
			form.state.tentNetBeginFace = beginFaceIndex;
			
			if (beginFaceIndex) {
				form.initTentNet(beginFaceIndex);
			} else {
				form.tentNetStaticLineList([]);
			}
			
			fireChange();
		});
		
		form.tentNetTextureName.subscribe(function(textureName) {
			form.state.tentNetTextureName = textureName;
			
			fireChange();
		});
		
        form.tentNetStaticLineList.subscribe(function(list) {
            form.state.tentNetStaticLineList = list;
			
			// reset advanced, after static beginning
			form.tentNetAdvancedLineList([]);
			
			fireChange();
        });
		
        form.tentNetAdvancedLineList.subscribe(function(list) {
            form.state.tentNetAdvancedLineList = list;
			
			fireChange();
        });
		
		
		form.tentNetStamp = ko.computed(function() {
			var beginFace = form.tentNetBeginFace(),
				advancedLines = form.tentNetAdvancedLineList();
			
			return _.compact([
				beginFace,
				_.pluck(advancedLines, 'removeIndex').join('')
			]).join('+');
		});
		
        form.initTentNet = function(start) {
			if (!figure) {
				form.tentNetNeedUpdate = {
					start: start
				};
				return;
			}
		
			var separateLines = [],
				coupleLineList = figure.coupleLineList = [],

				all = figure.$primitives.get(),
				points = figure.$points.get(),
				lines = _.where(all, { type: 'line', removed: false }),
				faces = _.where(all, { type: 'face', removed: false });

			if ('string' === typeof start) {
				start = _.findWhere(faces, { removeIndex: start });
			}
			
			// top face starter, as default
			var wave = start ? [ start ] : [ 
					_.max(faces, function(face) { 
						return _.max( 
							_.pluck(face.$points.get(), AXIS) 
						);
					})
				],
				left = wave.slice(0);

			// save start
			start = wave[0];
			
			// walk up
			while (wave[0]) {
				var next = [];

				_.each(wave, function (waveFace) {
					var directionFaces = _.difference(
							faceSiblings(waveFace),
							left, next
						);

					next = next.concat(directionFaces);

                    coupleLineList = figure.coupleLineList = coupleLineList.concat(
                        _.intersection(
                            subLinesOf([ waveFace ]),
                            subLinesOf(directionFaces)
                        )
                    );
                });

				left = left.concat(next);
				wave = next;
			}

			separateLines = _.difference(subLinesOf(faces), coupleLineList);

			// set into figure
            form.tentNetStaticLineList(separateLines);

			// init into figure
			_.each(lines, function(line) {	
				if (_.contains(separateLines, line)) {
					line.separate();
				} else {
					line.connect();
				}
            });
			
			// no calc start (start only after tent view mode switching to "pattern")
			form.initTentCalculator();

			// helpers
			function subLinesOf(faces) {
				return _.chain(faces)
                    .pluck('$sub')
                    .pluck('line')
					.invoke('get')
                    .flatten()
					.unique()
                    .where({ removed: false, selvage: false })
                    .value()
            }

			function faceSiblings(face) {
				return _.chain(face.$sub.line)
					.pluck('$super')
					.pluck('face')
                    .invoke('get')
                    .flatten()
                    .unique()
                    .where({ removed: false })
					.difference([ face ])
					.value();
            }
		};
		
		// todo?
		form.stopToCalcTent = _.noop;
		
		form.initTentCalculator = function() {
			console.log('form.initTentCalculator()...');
			
			// stop logic
			form.stopToCalcTent();
			
			var stopToCalcTent;
			form.stopToCalcTent = function() {
				stopToCalcTent = true;
			};
		
			// basic entities
			var netStamp = form.tentNetStamp(),
			
				all = _.where(figure.$primitives.get(), { removed: false }),
				//points = figure.$points.get(),
				lines = _.where(all, { type: 'line' }),
				faces = _.where(all, { type: 'face' });

			// init tent-points (copy from face points)
			var tentFaces = _.map(faces, function(face) {
					face.tentPoints = _.map(face.$points.get(), function(point) {
						var clone = point.clone();
						clone._from = point._enum;
						//clone._source = point;
						return clone;
					});
					return face;
				});
			
			console.log('tentPoints', _.chain(tentFaces).pluck('tentPoints').flatten().unique().value().length);
			
			// union common tent-points from couple faces with common line
			_.each(figure.coupleLineList, function(line) {
				var faces = line.$super.face,
					crossPoints = _.intersection(faces[0].$points.get(), faces[1].$points.get());
				
				//console.log('crossPoints', crossPoints);

				var times = 0;
				
				for (var i = 0; i < 3; i++) {
					var face0_tentPoint = faces[0].tentPoints[i];
					
					if (_.contains(crossPoints, faces[0].$points[i])) {
						var face1_i = _.indexOf(faces[1].$points.get(), faces[0].$points[i]),
							face1_tentPoint = faces[1].tentPoints[face1_i];
						
						if (face1_tentPoint.tentSource || ! face0_tentPoint.tentSource) {
							faces[0].tentPoints[i] = face1_tentPoint;
							face1_tentPoint.tentSource = true;
						} else {
							faces[1].tentPoints[face1_i] = face0_tentPoint;
							face0_tentPoint.tentSource = true;
						}
						times++;
					}
				}
					
				times === 2
					|| console.warn('2 points expected, found', times);
				
				_.every(faces) // todo: assertions by .tentPoints
			});
			
			var tentPoints = figure.tentPoints
					= _.chain(tentFaces).pluck('tentPoints').flatten().unique().value();
			console.log('tentPoints (after couple)', tentPoints.length);
			
			// reduce 3d to 2d
			var OTHER_AXES = {
					x: ['y', 'z'],
					y: ['z', 'x'],
					z: ['x', 'y'],
				}[ AXIS ],
				
				//BOOST_STEP = .002,
				PLAIN_BOOST_STEP = .4,
				REDUCE_ACCURACY = 3e-9,
				accuracy,
				steps = form.lastTentSteps = _.reduce(faces, function(steps, face) {
					var facePoints = face.$points.get();
					
					_.each(face.$sub.line, function(line) {
						if (! line.separator && _.contains(_.pluck(steps, 'line'), line)) return;
					
						var linePoints = line.$points.get(),
							i = _.indexOf(facePoints, linePoints[0]),
							j = _.indexOf(facePoints, linePoints[1]);
						
						//if (linePoints[0]._enum < linePoints[1]._enum) return;
						
						var A = face.tentPoints[i],
							B = face.tentPoints[j];
						
						steps.push({
							line: line,
							A: A,
							B: B,
							targetLength: A.distance(B),
							//velocity: 0,
							boost: function() {
								var AB = this.B.clone().subtract(this.A);
							
								// AB current length
								this.currentLength = AB.length();
								
								// current length delta to target
								this.deltaLength = (this.targetLength - this.currentLength);
								
								this.deltaVectorHalf = AB.scale(
									this.deltaLength / this.currentLength 
									* (1 - PLAIN_BOOST_STEP)
									/ 2
								);
								
								// acceleration of velocity
								//this.velocity = deltaLength * BOOST_STEP;
								
								// return accuracy
								return Math.abs(this.deltaLength) / this.targetLength;
							},
							step: function() {
								if (accuracy > .03) {
									//this._accurateFixed
									//	&& console.error('already accurate fixed');
										
									this.deltaVectorHalf.scale( .03 / accuracy );
									//this._accurateFixed = true;
								}
								
								this.B.add(this.deltaVectorHalf);
								this.A.subtract(this.deltaVectorHalf);
							}
						});
					});
					
					return steps;
				}, []);
				
			var heightAngle = function(point) {
					for (var side = point.clone(); side[AXIS] = 0; );
					
					return Math.atan2(side.length(), point[AXIS]);
				},
				maxHeightAngle = _.max(_.map(tentPoints, heightAngle));
			
			// in first, all tent points in one plain
			_.each(tentPoints, function(point) {
				for (var side = point.clone(); side[AXIS] = 0; );
				
				var sideLength = side.length(),
					ha = Math.atan2(sideLength, point[AXIS]),
					sideRadius = ha / maxHeightAngle;
					//semiSphereHeightAngle = (ha / maxHeightAngle) * Math.PI / 2,
					//semiSphereRadius = Math.sin(semiSphereHeightAngle);
				
				side.scale(1 / sideLength);
				
				// grounded
				point[AXIS] = 0;
				point[OTHER_AXES[0]] = side[OTHER_AXES[0]] * ha;
				point[OTHER_AXES[1]] = side[OTHER_AXES[1]] * ha;
				
				var sideUV = side.scale(sideRadius);
				
				// calc uvs
				point.stratoUV = [
					.5 + sideUV[OTHER_AXES[0]] / 2,
					.5 + sideUV[OTHER_AXES[1]] / 2
				];
			});
			
				
			var step = 0;
			
			// return in `promise` style
			return form.tentCalculator = {
				start: function() {
					one(); // no param!
				},
				stop: function() {
					stopToCalcTent = true;
				}
			};
			
			function pack() {
				for (var i = 0; i < 64; i++)
					one(i);
			}
			
			function one(tail) {
				// plainer
				//_.each(uniquePoints, function(point) {
				//	point[AXIS] *= PLAIN_BOOST_STEP;
				//});
				
				// meter max accuracy
				accuracy = _.max([
					//_.max( _.pluck(uniquePoints, AXIS) ),
					_.max( _.invoke(steps, 'boost') )
				]);
				
				// apply step actions
				_.invoke(steps, 'step');
				
				if (step % 1500 === 0) {
					requestAnimationFrame(function() {
						viewer.flash(true);
						
						var progress = Math.round( - Math.log10(accuracy) * 10 ),
							progressEnd = Math.round( - Math.log10(REDUCE_ACCURACY) * 10 );
						
						viewer.pattern.progress(progress >= progressEnd ? null : progress / progressEnd);
						
						//console.log(step + '. boost accuracy max', accuracy, ' ' + progress + '/' + progressEnd);
					});
				}
				
				if (accuracy >= REDUCE_ACCURACY) {
					tail || stopToCalcTent ||
						_.delay(pack, 1);
				} else {
					if (! tail || stopToCalcTent) {
						console.log(step + '. accuracy reduce complete', accuracy);
						
						viewer.flash(true);
						viewer.pattern.progress(null);
						
						if (! stopToCalcTent) {
							// to remember last calc result for
							viewer.pattern.lastNetStamp = netStamp;
							
							viewer.trigger('tent-calc-success', {
								points: tentPoints
							});
						}
						
						viewer.trigger('tent-calc-complete');
					}
				}
				
				if (0 === step++) {
					viewer.trigger('tent-calc-start');
				}
			}
		}

		// figure budget
		form.budgetList = ko.observable();

		// set default values
		!function() {
			defaults(FigureOptionsVM.defaults, form);

			function defaults(object, subject) {
				_.each(object, function(value, key) {
					_.isObject(value) && !_.isArray(value) ?
						defaults(value, subject[key]) :
						subject[key](value);
				});
			}
		}();

		// events support
		_.extend(this, Backbone.Events);
	}


	// helpers
	function maybe(value, list) {
		return _.contains(list, value) ? value : list[0];
	}

	function luckyNumber(best, variants) {
		var lucky, quality = -1;
		_.each(variants, function(number){
			var distance = Math.abs(number - best);
			if (-1 == quality || distance < quality){
				lucky = number;
				quality = distance;
			}
		});
		return lucky;
	}

	function partialList_Octohedron(V) {
		console.log('partialList_Octohedron(' + V + ')');
		
		var V2 = V * V;

		for (var list = [], p = 1; p <= V; p++)
			list.push(rational(p * p, 2 * V2));
		
		for (var p2 = 0, p = V; p >= 1; p--) {
			p2 += (2 * p - 1);
			list.push(rational(V2 + p2, 2 * V2));
		}
		
		return list;
	}

	function partialList_ClassI(V) {
		//console.log('partialList_ClassI(' + V + ')');

		for (var list = [], p = V, q = V * 4; p <= V * 4; p += (p != V * 3) ? 2 : V)
			list.push(rational(p, q));
		
		return list;
	}

	/*
	function partialList_ClassII(V, symmetry) {
		console.log('partialList_ClassII(' + V + ', ', symmetry + ')');

		var v = V / 2,
			faceCount = 60 * v * v;

		switch (symmetry) {
			case 'Cross':
			case 'Triad':
			case 'Pentad':
		}
	}
	*/

	function rational(p, q) {
		var pp = p, qq = q;
		// simplify rational fraction
		for (var m = 2; m <= pp && m <= qq;)
			if (pp % m == 0 && qq % m == 0) {
				pp /= m;
				qq /= m;
			} else
				m++;
		return pp + '/' + qq;
	}

	function nearestRational(rational, list) {
		var result, lastValue,
			target = eval(rational);

		_.each(list, function(rational) {
			var value = eval(rational);
			if (!result || Math.abs(value - target) < Math.abs(lastValue - target)) {
				result = rational;
				lastValue = value;
			}
		});
		return result;
	}
})();