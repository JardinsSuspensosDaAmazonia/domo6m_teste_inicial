$('body').toggleClass('offline', IS_OFFLINE);

// iframe version
$('body').toggleClass('iframe', IS_IFRAME);
if (IS_IFRAME) {
  $('html').css({ overflow: 'hidden' });
  $('.geodesic').height($(window).height());
}

// download
!function () {
  var downloadUrl;

  $('.download').on('click', function () {
    downloadUrl = downloadUrl || $(this).attr('href')
    $(this).attr('href',
      downloadUrl + '?figure=' + encodeURIComponent(fragmentRouter.fromParams(form.state, 'prevent #hash update'))
    );
  });
}();

// product color palettes
const productPalette = _.reduce(Palette.collections, function (palette, colors, type) {
  palette[type] = _.map(/*colors*/Palette.collections.line, function (cssColor) {
    return {
      integer: (new Function('return 0x' + cssColor.substr(1)))(),
      css: cssColor
    };
  });
  return palette;
}, {});

// const
const CALC_PATH = document.location.pathname;
const DEFAULT_SYMMETRY_BY_CLASS = { I: 'Pentad', II: 'Cross', III: 'Pentad' };

/**
 * url#fragment router                                           * * *         url#fragment
 */
const fragmentRouter = new Stringifier({
  format: [
    '<base:|(Icosahedron|Oct[oa]hedron)_>',
    '<alignTheBase:ground_|[Aa]lign_|[Ff]lat_|>',

    '<partial:@Float(>0)|@Natural/@Natural|1>_',

    '<subdivClass:|Class_(II)_|Class_III_(\\d+),(\\d+)_>',
    '<subdivMethod:|(Chords|Arcs|Mexican|Kruschke)_>',
    '<symmetry:|(Pentad|Cross|Triad)_>',
    '<fullerenType:|(Described_|Inscribed_|)Fuller(?:ene?)?_(?:with|in|on|of|smoke)_>',
    '<connType:(?:Piped|Cone)_D@Float(>=0)|(?:Joint|Nose|GoodKarma)(?:_back|_counter)?|Cone|Semicone|>_',
    '<detail:@Natural>V',

    '<radius:|_R@Float(>=0)>',
    '<material:|_beams_?(@Float(>0))x(@Float(>0))>',
  ].concat(

    _.map(CONFIG.router && CONFIG.router.beforeRemovedList, conf => conf.route) // doorGroup eg.etc.

  ).concat([
    '<removedList:|~(?:rm-)?([vlf]\\d+)+>',

    '<tentNetBeginFace:|~tent\\+(f\\d+)(?:\\+([a-zA-Z]{2}[\\w\\.]*))?>',
    '<tentNetAdvancedLineList:|\\+(l\\d+)+>'
  ]).map(template => {
    return _.reduce({
      "@Float(>=0)": '(?:0|[1-9]\\d*)(?:\\.\\d+)?',
      "@Float(>0)": '(?:[1-9]\\d*)(?:\\.\\d+)?|0\\.\\d+',
      "@Floating": '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?',
      "@Natural": '[1-9]\\d*',
      "@Integer": '0|-?[1-9]\\d*'
    }, (template, replace, search) => template.split(search).join('(?:' + replace + ')'), template);
  }),

  mapping: _.chain(CONFIG.router)
    .reduce((mapping, extenders, hookName) => {
      _.each(extenders, ext => {
        _.extend(mapping, ext.mapping);
      });
      return mapping;
    }, {})
    .extend({
      base: {
        value: function (figureAs, base) {
          return base || 'Icosahedron';
        },
        string: function (base) {
          return base == 'Icosahedron' ? '' : base + '_';
        }
      },
      alignTheBase: {
        value: function (align) {
          return !!align;
        },
        string: function (align) {
          return align && this.partial != '1/1' && this.partial != '1/2' ? 'Flat_'/*'Align_'*/ : '';
        }
      },

      partial: {
        value: function (string) {
          const isModeHeight = /^\d+(\.\d+)?$/.test(string);

          return {
            partialMode: isModeHeight ? 'height' : 'faces',
            partial: string,
            partialHeight: isModeHeight ? string : eval(string).toFixed(5)
          };
        },
        string: function (partial) {
          return {
            faces: partial,
            height: this.partialHeight
          }[this.partialMode];
        }
      },

      subdivClass: {
        value: function (string, II, III_M, III_N) {
          return III_M ? {
            subdivClass: 'III_' + III_M + ',' + III_N,
            M: III_M,
            N: III_N
          } : {
            subdivClass: II || 'I'
          };
        },
        string: function (klass) {
          var all = klass.split(/_|,/),
            subdivClass = all[0];
          switch (subdivClass) {
            case 'I': return '';
            case 'II': return 'Class_II_';
            case 'III': return 'Class_III_' + all[1] + ',' + all[2] + '_';
          }
          console.error('unknown subdivision class', klass);
        }
      },
      subdivMethod: {
        value: function (string, method) {
          return method || 'Chords';
        },
        string: function (method) {
          return method == 'Chords' ? '' : method + '_';
        }
      },
      symmetry: {
        value: function (string, symmetry) {
          var subdivClass = this.subdivClass.split('_')[0];
          return symmetry || DEFAULT_SYMMETRY_BY_CLASS[subdivClass];
        },
        string: function (symmetry) {
          var subdivClass = this.subdivClass.split('_')[0];
          return symmetry != DEFAULT_SYMMETRY_BY_CLASS[subdivClass] ? symmetry + '_' : '';
        }
      },
      // partial is simple
      fullerenType: {
        value: function (fulleren, type) {
          return fulleren ? type.match(/^descr/i) ? 'described' : 'inscribed' : false;
        },
        string: function (type) {
          if (type)
            return (type == 'inscribed' ? 'Inscribed_' : 'Described_') + 'Fulleren_on_';
          return '';
        }
      },
      connType: {
        value: function (string) {
          var matches = /^(Piped|Joint|Cone|Semicone|Nose|GoodKarma|)(.*)?$/.exec(string);
          var value = {
            connType: matches[1]
          };

          if (/^(Piped|Cone)$/.test(value.connType) && matches[2]) {
            //if (value.connType == 'Piped') {
            //debugger;
            value.pipeD = matches[2].replace(/^_D/g, '');
          }
          else if (/^(Joint|Nose|GoodKarma)$/.test(value.connType)) {
            value.clockwise = !matches[2];
          }
          return value;
        },
        string: function (connType) {
          switch (connType) {
            case 'Piped':
            case 'Cone':
              connType += '_D' + this.pipeD;
              break;
            case 'Joint':
            case 'Nose':
            case 'GoodKarma':
              connType += this.clockwise ? '' : '_counter';
              break;
          }
          return connType;
        }
      },
      // detail is simple
      radius: {
        value: function (string) {
          return new Number(string.substr(2)).valueOf() || 69;
        },
        string: function (value) {
          return '_R' + value;
        }
      },
      material: {
        value: function (string, width, height) {
          return {
            beamsWidth: width,
            beamsThickness: height
          };
        },
        string: function () {
          return '_beams_' + this.beamsWidth + 'x' + this.beamsThickness;
        }
      },

      removedList: {
        value: function (string, rm) { // wtf: into rm last member only received O_o
          if (!rm) return [];

          var list = [];

          string.replace(/[vlf]\d+/g, function (index) {
            list.push(index);
          });

          return {
            removedList: list
          };
        },
        string: function (list) {
          if (!figure) {
            return _.isEmpty(list) ? '' : '~rm-' + list.join('');
          }

          // pack (compress) a list
          var removing = _.pluck(_.where(figure.$primitives, { removed: true, type: 'face' }), 'removeIndex'),
            groups = _.reduce(figure.$primitives, function (memo, item) {
              if (item.removed && (item.type == 'face' || _.all(item.$super.face, _.property('removed')))) {
                memo.push({
                  index: item.removeIndex,
                  faces: item.type == 'face' ? [item.removeIndex] : _.pluck(item.$super.face, 'removeIndex')
                });
              }
              return memo;
            }, []),
            packed = [],
            removed = [];

          while (removing.length > 0) {
            var group = _.reduce(groups, function (best, group) {
              return (best && best.faces.length >= group.faces.length) ? best : group;
            }, null),
              removedFaces = group.faces;

            // filter groups
            groups = _.filter(groups, function (group) {
              return _.all(group.faces, function (face) {
                return !_.contains(removedFaces, face);
              });
            });

            // release removed
            removing = _.difference(removing, removedFaces);

            packed.push(group.index);
          }

          return _.isEmpty(list) ? '' : '~rm-' + packed.join('')
        }
      },
      tentNetBeginFace: {
        value: function (string, beginFaceIndex, textureName) {
          if (!string) return null;

          return {
            tentNetBeginFace: beginFaceIndex,
            tentNetTextureName: textureName,
          };
        },
        string: function (beginFaceIndex) {
          var face = _.isEmpty(beginFaceIndex) ? '' : '+' + beginFaceIndex,
            texture = _.isEmpty(this.tentNetTextureName) ? '' : '+' + this.tentNetTextureName;

          return face ? '~tent' + face + texture : '';
        }
      },
      tentNetAdvancedLineList: {
        value: function (string, indexes) {
          if (!string) return [];

          var list = [];

          indexes.replace(/l\d+/g, function (index) {
            list.push(index);
          });

          return {
            tentNetAdvancedLineList: list
          };
        },
        string: function (list) {
          return _.isEmpty(list) ? '' : '+' + _.pluck(list, 'removeIndex').join('');
        }
      }
    })
    .value()
});


// binding url fragment with form                                  * * *
$(window).on('popstate', function (e) {
  if (CALC_PATH == document.location.pathname) {
    var string = document.location.hash.substr(1);

    // try to restore figure configuration from file:path
    if (!string && IS_OFFLINE) {
      document.location.pathname.replace(/^.*\$(\d+)_([^$/]+)(?:\$([^ %/]+))?(?:(?: |%20)\(\d+\))?\.html$/, function (pathname, numerator, more, removed) {
        string = numerator + '/' + more + (removed && '~' + removed);
      });
    }

    fragmentRouter.fromString(string);

    // auto map params correction to url #fragment
    string = fragmentRouter.fromParams(form.state);

    // update page title
    updateTitle(string);
    return false;
  }
});

// router params => form state
fragmentRouter.on('params', function (state) {
  form.animate = false;

  // mark values as setted manually
  _.each(state, function (value, key) {
    if (form[key]) {
      form[key].manual = value;
    }
  });

  // set form values
  _.each(state, function (value, key) {
    if (!_.isFunction(form[key]) && _.isObject(value)) {
      _.each(value, (subValue, subKey) => {
        // second level
        form[key][subKey](subValue);
      });
    } else {
      // first level
      form[key](value);
    }
  });

  // lame-force, todo: resolve depends in any way
  form.partial(state.partial);

  form.animate = true;
});

form.urlFragment = ko.observable('');
form.figureUrl = ko.computed(function () {
  return '//acidome.com/lab/calc/' + (form.urlFragment() ? '#' + form.urlFragment() : '');
});
form.figureName = ko.computed(function () {
  return form.urlFragment().replace(/_/g, ' ');
});

form.on('change', function (state) {
  // form state => router string
  var string = fragmentRouter.fromParams(state);
  form.urlFragment(string);
});

// router string => url fragment
fragmentRouter.on('string', function (string) {
  var currFragment = document.location.hash.substr(1);

  if (currFragment == string) {
    // prevent history repeating
    return;
  }

  // update history
  if (!IS_OFFLINE) {
    history.pushState('data', 'title', '#' + string);
    console.log('* push(!) state with', string);
  }

  // update page title
  updateTitle(string);
});

// page title helper
var initialTitle = $('head title').text();
function updateTitle(spec) {
  if (!spec) return;
  var hasRemoved = /~/.test(spec),
    title = spec.split('~')[0].replace(/_/g, ' ') + (hasRemoved ? ' (' + __('modified') + ')' : '');
  $('head title').text([title, initialTitle].join(' - '));

  // update figure dowload name
  var $link = $('#js-download-link');
  $link.attr({
    href: $link.data('href-base') + '?figure=' + encodeURIComponent(spec)
  });
}


// init form params from url fragment
// called before form been bounded with figure calculation process
$(window).trigger('popstate');


// figure calculator
var AXIS = 'y',
  AXIS_VECTOR3 = new THREE.Vector3(
    AXIS === 'x' ? 1 : 0,
    AXIS === 'y' ? 1 : 0,
    AXIS === 'z' ? 1 : 0
  ),

  CENTER = new Vector,
  figure;

form._lastState = {};
form.on('change', onFormChange);

form.removedList.subscribe(function () {
  if (form._listsDebounce) return;
  onFormChange();
});
form.tentNetLineList.subscribe(function () {
  if (form._listsDebounce) return;
  onFormChange();
});

function onFormChange() {
  // fix state.fullerenType
  form.state.fullerenType = _.contains(['none', null, false, undefined], form.state.fullerenType)
    ? false : form.state.fullerenType;
  // fix detail type
  form.state.detail = String(form.state.detail);


  var METRIC_OPTIONS = ['radius', 'connType' /* =) */, 'pipeD', 'beamsWidth', 'beamsThickness'],

    TENT_OPTIONS = ['tentNetBeginFace', 'tentNetTextureName', 'tentNetStaticLineList',
      'tentNetAdvancedLineList', 'tentNetLineList'],

    IGNORE_FORM_OPTIONS = METRIC_OPTIONS.concat(TENT_OPTIONS);

  if (!_.isEmpty(form._lastState) &&
    !_.isEqual(
      _.omit(form.state, IGNORE_FORM_OPTIONS, 'removedList'),
      _.omit(form._lastState, IGNORE_FORM_OPTIONS, 'removedList')
    ) &&
    !_.isEmpty(form.state.removedList)
  ) {
    console.warn('reset removed_list, if figure-form (option) was changed');

    // reset removed on figure form option was changed
    form._listsDebounce = true;
    form.removedList([]);
    delete form._listsDebounce;
  }

  if (!_.isEmpty(form._lastState) &&
    !_.isEqual(
      _.omit(form.state, IGNORE_FORM_OPTIONS),
      _.omit(form._lastState, IGNORE_FORM_OPTIONS)
    ) &&
    !_.isEmpty(form.state.tentNetLineList)
  ) {
    console.warn('reset tent net, if figure-form/removed was changed');

    // reset tent-separators
    form._listsDebounce = true;
    form.resetTentNet();
    delete form._listsDebounce;

    // switch to Cover mode, if now is Tent (and figure form changed)
    if (viewer.mode() === "tent") {
      viewer.mode("cover");
    }
  }

  // break, if figure form options has no change
  if (_.isEqual(
    _.omit(form.state, 'removedList', TENT_OPTIONS),
    _.omit(form._lastState, 'removedList', TENT_OPTIONS)
  )) return;

  // init view mode
  if (_.isEmpty(form._lastState)) {
    var MODES = ['base', 'carcass', 'schema', 'cover', 'tent'],
      modeIndex = _.indexOf(MODES, viewer.mode());

    if (modeIndex < _.indexOf(MODES, "cover")
      && !_.isEmpty(form.removedList())
    ) {
      viewer.mode("cover");
    }

    if (modeIndex < _.indexOf(MODES, "tent")
      && !!form.tentNetBeginFace()
    ) {
      viewer.mode("tent");
    }

    form.TENT_TEXTURE_SAMPLE_DIR = './tent/pattern-samples';
    if (form.tentNetTextureName()) {

      viewer.drivers.tent.N.content.image.src =
        form.TENT_TEXTURE_SAMPLE_DIR + '/' + form.tentNetTextureName();
    }
  }

  // calc subj
  var state = _.clone(form.state);
  var mm = (1 / 1000); // state.radius; // mm/R
  var calcStartedAt = +new Date;

  // fix none-value
  if (state.fullerenType === 'none') {
    state.fullerenType = null;
  }

  calcProc.start(_.compact([
    {
      name: 'reset',
      process: function () {
        Figure.__enum = 0;
        //console.clear();

        return true;
      }
    }, {
      name: 'base figure',
      process: function () {
        if ('II' == state.subdivClass) {
          figure = new Figure["Octohedron" == state.base ? "TetrakisHexahedron" : "PentakisDodecahedron"]({
            axis: AXIS,
            symmetry: state.symmetry
          });
        }
        else {
          figure = new Figure["Octohedron" == state.base ? "Octohedron" : "Icosahedron"]({
            axis: AXIS,
            symmetry: state.symmetry
          });
        }

        return figure;
      }
    }, {
      name: 'subdivision',
      process: function (figure) {
        var V = state.detail,
          subdivAll = state.subdivClass.split(/_|,/),
          subdivClass = subdivAll[0];

        switch (subdivClass) {
          case 'I':
            switch (state.subdivMethod) {
              case 'Chords':
                return figure.splitFaces(V);

              case 'Arcs':
                return figure.splitFaces_EA(V);

              case 'Mexican':
                return figure.splitFaces_EA(V)
                  .splitFaces_EA_updateToMexican(V);

              case 'Kruschke':
                figure.splitFaces(V);

                // Kruschke magic...
                if (3 == V) {
                  var MAGIC_FIX_RATIO = 0.9442890204731844;
                }
                else if (4 == V) {
                  // //www.domerama.com/calculators/4v-geodesic-dome-calculator/4v-712-kruschke-geodesic-dome-calculator/
                  // F target = 0.22219
                  var MAGIC_FIX_RATIO = 0.22219
                    / 0.253185 // V4 Chords F
                    * 0.9983958444733023; // ~fix

                  /*
                  //// testing Kruschke Mod M-1 .... not good ////
                  var all = figure.$primitives.get(),
                  	
                    vertices = all.filter(f => f.type === 'vertex'),
                    pptVertices = vertices.filter(v => v.$points[0].pptPoint),
                    pptPoints = pptVertices.map(v => v.$points[0]),
                  	
                    lines = all.filter(f => f.type === 'line'),
                    pptLines = lines.filter(l => l.$points[0].pptPoint || l.$points[1].pptPoint),
                  	
                    pptWallPoints = _.chain(pptLines)
                      .map(line => line.$points.get())
                      .flatten()
                      .unique()
                      .value(),
                    notWallVertices = vertices.filter(vertex => {
                      return ! _.contains(pptWallPoints, vertex.$points[0]);
                    });
                	
                  var MAGIC = .125941802282; // Kruschke M-1 =)
              	
                  m60 = notWallVertices
                    .map(vertex => {
                      var point = vertex.$points[0],
                        pptGroup = _.chain(pptPoints)
                          .map(ppt => {
                            return {
                              distance: Math.round(999 * ppt.distance(point)),
                              ppt: ppt
                            };
                          })
                          .groupBy('distance')
                          .values()
                          .sortBy(g => g[0].distance)
                          .value()[ 0 ]
                          .map(x => x.ppt),
                        ppt = (pptGroup.length === 1) && pptGroup[0];
                    	
                      return ppt && point
                        .scale(1 + MAGIC)
                        .subtract( ppt.clone().scale(MAGIC) )
                        .normalize();
                    })
                    .filter(_.identity)
                	
                  console.log(
                    _.unique(vertices
                      .map(v => v.$points[0])
                      .map(p => p.y > 0 && p.y.toFixed(14))
                      .filter(y => y)
                    ).sort().slice(0, 6)
                  );
                	
                  return figure;
                  */
                }
                else {
                  //throw ['Wrong V', V];
                  return figure;
                }

                _.chain(figure.$primitives.get())
                  .filter(f => f.type === 'line')
                  .filter(l => l.$points[0].pptPoint || l.$points[1].pptPoint)
                  .each(line => {
                    var points = line.$points,
                      E = points[points[0].pptPoint ? 0 : 1], // PPT
                      S = points[points[0].pptPoint ? 1 : 0];

                    var mr = MAGIC_FIX_RATIO,
                      T = E.clone().scale(1 - mr).add(S.clone().scale(mr)).normalize();

                    S.x = T.x;
                    S.y = T.y;
                    S.z = T.z;

                    /*
                    // calc MAGIC_FIX_RATIO Kruschke constant
                    var range = [0, 1],
                      TARGET = 0.32970647; // thanks https://groups.google.com/d/msg/geodesichelp/L55V-KCFje0/A7IhFisIa2AJ
                  	
                    while (range[1] - range[0] > 1e-15) {
                      var mr = (range[1] + range[0]) / 2,
                        T = E.clone().scale(1 - mr).add(S.clone().scale(mr)).normalize(),
                        l = E.distance(T);
                    	
                      range[l < TARGET ? 0 : 1] = mr;
                    }
                  	
                    console.log('PPT -> ', mr, 'source =', l);
                    */
                  });

                return figure;

              default:
                throw 'Unknown subdivision method: ' + state.subdivMethod;
            }

          case 'II':
            //debugger;
            figure.splitFaces(V / 2);

            if ("Octohedron" == state.base) { // splitFaces_updateToClassII() not for Octo
              return figure;
            }

            return figure.splitFaces_updateToClassII();

          case 'III':
            return figure.splitFaces_updateToClassIII(subdivAll[1], subdivAll[2]);

          default:
            throw 'Unknown subdivision class: ' + state.subdivClass;
        }
      }
    }, {
      name: 'primitive relations',
      process: function (figure) {
        // figure primitives initial
        figure.$primitives.each(function () {
          // radius-center of points
          this.center = CENTER;
          this.$points.each(function () {
            this.center = CENTER;
          });
        });
        return figure.relations();
      }
    },
    (state.fullerenType) && {
      name: 'transmutation figure to fulleren', // if required
      process: function (figure) {
        switch (state.fullerenType) {
          case 'inscribed':
            figure.fulleren();
            break;
          case 'described':
            figure.prepareUnify();
            figure.outerFulleren();
            break;
          default:
            console.error('strange fulleren type:', state.fullerenType);
        }

        // recalc relations
        figure.relations();

        // assert faces vertexes has common plane
        var badFactor = 0;
        _.each(figure.subs('face'), function (face) {
          var points = face.$points,
            bad = _.filter(
              _.map(points, function (a, i) {
                var b = points[(i - 1 + points.length) % points.length],
                  c = points[(i + 2) % points.length],
                  normal = Vector.crossProduct(
                    Vector.subtract(b, a),
                    Vector.subtract(c, a)
                  ),
                  plane = new Plane(normal, a).normalize();

                plane.badMax = _.max(_.map(points, function (point) {
                  var result = Math.abs(plane.result(point));
                  return result < 1e-9 ? 0 : result;
                }));
                return plane;
              }),
              function (plane) {
                return plane.badMax;
              }
            );
          if (!_.isEmpty(bad)) {
            //console.error('bad face');
            badFactor = Math.max(badFactor, _.min(_.compact(_.pluck(bad, 'badMax'))));
          }
        });
        if (badFactor) {
          console.error('bad factor', badFactor * state.radius * 1000 .toFixed(2), 'mm');
        }

        return figure;
      }
    }, {
      name: 'set items remove indexes',
      process: function (figure) {
        // set items remove indexes
        _.each(_.groupBy(figure.$primitives, 'type'), function (collection, type) {
          var typeIndex = type.substr(0, 1).toLowerCase();
          _.each(collection, function (figure, index) {
            figure.removeIndex = typeIndex + index;
          });
        });
        return figure;
      }
    }, {
      name: 'pre-slice',
      process: function (figure) {
        if ('height' === state.partialMode) {
          // in first, all primitives matter
          _.each(figure.$primitives, function (f) {
            f.live = true;
          });

          const
            ZERO_DIR = 270,
            directionAngleFn = deltaDegrees => {
              return Math.PI / 180 * (ZERO_DIR - Number(state.doorGroup.direction) + deltaDegrees);
            },
            horizVector = deltaDegrees => {
              var angle = directionAngleFn(deltaDegrees);

              //return new Vector(Math.cos(angle), 0, Math.sin(angle));
              return Vector.rotate(new Vector(1, 0, 0), - angle, 'y');
            },
            baseY = 1 - 2 * Number(state.partialHeight),
            doorHeight = state.doorGroup.height / 1000 / state.radius,
            doorWidth = state.doorGroup.width / 1000 / state.radius,

            forwardControlPlane = new Plane(horizVector(0), 0),

            basePlane = new Plane(0, 1, 0, - baseY),

            topY = baseY + doorHeight,
            //topPlane   = new Plane(0, -1, 0, topY),
            // through the center
            topDirLength = Math.sqrt(1 - doorWidth * doorWidth / 4),
            topDirHorizComponent = Math.sqrt(topDirLength * topDirLength - topY * topY),
            topPlane = new Plane(
              _.extend(
                horizVector(0).scale(
                  - topY
                ), {
                y: - topDirHorizComponent
              }
              ).normalize(),
              0),

            leftPlane = new Plane(horizVector(-90), + doorWidth / 2),
            rightPlane = new Plane(horizVector(+90), + doorWidth / 2);

          //console.log(topPlane, horizVector(0));

          //console.log(_.countBy(figure.$primitives, 'type'), figure.$points.length)

          console.time('Cutting cross & sew');

          const baseDoorCL = figure.CuttingLine('base & door')
            .begin()

            .stage('base')
            .crossPlane(basePlane)
            .cutFigure(true)
            .relations();

          (0 !== doorWidth) && baseDoorCL
            .stage('top')
            .crossPlane(topPlane)
            .cutFigure(true)
            .relations()

            .stage('left')
            .crossPlane(leftPlane)
            .cutFigure(true)
            .relations()

            .stage('right')
            .crossPlane(rightPlane)
            .cutFigure(true)
            .relations()

            .whereMark({ base: 1, left: 1, right: 1, top: 1 }, face => {
              // forward side only
              if (forwardControlPlane.result(face.$points[0]) < 0) {
                //face.live = false;
                figure.safeRemoveMember(face);
              }
            });

          baseDoorCL
            .whereMark({ base: -1 }, face => {
              //face.live = false;
              figure.safeRemoveMember(face);
            });

          (0 !== doorWidth) && baseDoorCL
            .stage('common')
            .sewBack()
            .relations();

          baseDoorCL
            .end();

          console.timeEnd('Cutting cross & sew');

          // vertical cut plane
          if (form.state.vertical.howMany < 1) {
            const vertCutPlane = new Plane(
              horizVector(180 + form.state.vertical.direction),
              2 * form.state.vertical.howMany - 1
            );

            figure.CuttingLine('vertical cut')
              .begin()

              .stage('vertical')
              .crossPlane(vertCutPlane)
              .cutFigure(false)
              .relations()

              .whereMark({ vertical: -1 }, face => {
                figure.safeRemoveMember(face);
              })

              .end();
          }

          // assert
          figure.testRelationship();

          // end for no door
          if (0 === doorWidth) {
            form.doorGroup.sides([]);
            return figure;
          }

          // catch left/right points
          const PRECISION_THRESHOLD_REL = 2.5 / 1000 / form.state.radius,
            dirAngle = Math.PI / 180 * (ZERO_DIR - Number(state.doorGroup.direction)),

            pointsByPlane = (plane, indoorFilter) => {
              return _.chain(figure.$points)
                .filter(p => Math.abs(plane.result(p)) < PRECISION_THRESHOLD_REL)
                .filter(p => (p._sides = []) &&
                  (false === indoorFilter)
                  || forwardControlPlane.result(p) < 0
                )
                .map(p => {
                  return _.all({
                    top: topPlane,
                    left: leftPlane,
                    right: rightPlane
                  }, (plane, side) => {
                    if (Math.abs(plane.result(p)) < PRECISION_THRESHOLD_REL) {
                      p._sides.push(side);
                    }
                    return (false === indoorFilter)
                      || plane.result(p) > - PRECISION_THRESHOLD_REL
                  })
                    && _.extend(Vector.rotate(p, dirAngle, 'y'), {
                      _sides: p._sides
                    });
                })
                .compact()
                .invoke('scale', form.state.radius);
            },

            pointsBySide = {
              base: pointsByPlane(basePlane, false)
                .each(p => {
                  p.copy(Vector.rotate(p, - Math.PI / 2, 'x')); // (x,z) => (x,y)
                })
                .sortBy(p => {
                  var radial = Math.atan2(p.y, - p.x);
                  if (radial < 0) {
                    radial += Math.PI * 2;
                  }
                  return radial;
                })
                .each(p => {
                  p.x *= -1;
                })
                .value(),

              left: pointsByPlane(leftPlane)
                .each(p => {
                  p.z -= (state.doorGroup.width / 1000) / 2;
                })
                .sortBy(p => - p.y)
                .value(),

              top: pointsByPlane(topPlane)
                .each(p => {
                  p.copy(Vector.rotate(p, - Math.acos(Math.abs(topPlane.B)), 'z')); // if(!) door's top > 0
                  p.copy(Vector.rotate(p, - Math.PI / 2, 'x')); // (x,z) => (x,y)
                })
                .sortBy(p => - p.y)
                .value(),

              right: pointsByPlane(rightPlane)
                .each(p => {
                  p.z += (state.doorGroup.width / 1000) / 2;
                })
                .sortBy(p => - p.y)
                .value(),
            };

          form.doorGroup.sides(
            _.map(pointsBySide, (points, side) => {
              const
                PIPE_WIDTH = 25 / 1000,
                HOLE_DIAMETER = form.state.polygon.holeDiameter / 1000,
                MAX_HOLES_INDENT = form.state.polygon.maxHolesIndent / 1000,
                SCALE_PX_IN_M = 8503.94 / 3;

              const range = ['x', 'y', 'z']
                .reduce((range, comp) => {
                  range[comp] = {
                    min: _.min(_.pluck(points, comp)),
                    max: _.max(_.pluck(points, comp)),
                  };
                  range[comp].size = range[comp].max - range[comp].min;
                  return range;
                }, {});

              _.each(points, p => {
                p.x -= range.x.min;
                p.y -= range.y.min;
                p.z -= range.z.min;
                p.z += (PIPE_WIDTH - range.z.size) / 2; // middlenoid
              });

              // points => hole- (circle) points
              const circleList =
                points.slice(1).flatMap((B, index) => {
                  const A = points[index],
                    sideLength = A.distance(B),
                    holeCount = Math.max(Math.ceil(sideLength / MAX_HOLES_INDENT), 1);

                  return _.range(0, holeCount)
                    .map(i => {
                      return A.clone().scale((holeCount - i) / holeCount)
                        .add(B.clone().scale(i / holeCount));
                    });
                })
                  .concat([
                    _.last(points)
                  ]);

              // z/l coords
              circleList[0].l = 0;
              _.each(circleList.slice(1), (B, index) => {
                const A = circleList[index],
                  d = Vector.subtract(A, B);

                B.l = A.l + Math.sqrt(d.x * d.x + d.y * d.y);
              });

              //console.log(side, points);
              //console.log(side, 'circles', circleList);

              return {
                SCALE_PX_IN_M: SCALE_PX_IN_M,
                HOLE_DIAMETER: HOLE_DIAMETER,
                PIPE_WIDTH: PIPE_WIDTH,
                side: side,// + ' (from inside, from top to bottom)',
                points: points
                  .concat(/top|base/.test(side) ? [] : [
                    _.extend(_.last(points).clone(), {
                      x: points[0].x
                    })
                  ])
                  .concat([
                    points[0]
                  ]),
                range: range,

                circleList: circleList, // from top to down
                maxL: _.max(circleList, 'l').l
              };
            })
          );

          console.log('pre-stat', _.countBy(figure.$primitives, 'type'), figure.$points.length);
        }
        else if (state.subdivClass == 'I' && !state.fullerenType && state.symmetry == 'Pentad') {
          var upper = _.sortBy(figure.subs('vertex'), function (v) {
            return v.$points[0][AXIS];
          }).pop();
          //console.log(upper);
          // wrong: .sliceByFraction() call .relations() too
          figure.sliceByFraction(upper, state.partial, false);
        }
        else if (state.partialMode === 'faces') {
          figure.sliceByAxis(AXIS, state.partial, false);
        }
        else {
          debugger;
          throw ['what to do? state of partialMode:', state.partialMode];
        }

        return figure.detectSelvage('sliced');
      }
    },
    state.alignTheBase && { // if required
      name: 'flat base',
      process: function (figure) {
        figure.groundSliced(AXIS);
        return figure;
      }
    }, {
      name: 'init product objects',
      process: function (figure) {
        var Connector = Product.Connector[state.connType],
          Rib = Product.Rib["Beam"],
          Triangle = Product["Triangle"]["Simple"],
          Face = Product[state.fullerenType ? 'Polygon' : 'Triangle']["Simple"];

        figure.$primitives = $(_.flatten(_.map(figure.$primitives, function (primitive) {
          switch (primitive.type) {
            case 'vertex':
              primitive.product = new Connector(primitive, {
                R: state.radius,
                Dpipe: state.pipeD * mm,
                whirlAsClock: state.clockwise
              });
              break;

            case 'line':
              if (Connector.lineSeparatelyForFaces) {
                // GoodKarma, Semicone
                var lineData = {
                  $points: primitive.$points,
                  origin: primitive
                };

                primitive = _.map(primitive.$super.face, function (face, i) {
                  if (i > 0) {
                    // clone primitive related to origin
                    primitive = new Figure(lineData);
                  }
                  primitive.bindedFace = face;
                  primitive.live = face.live;
                  primitive.product = new Rib({
                    R: state.radius,
                    width: state.beamsWidth * mm,
                    thickness: state.beamsThickness * mm,
                    line: primitive
                  });

                  face.bindedLines = face.bindedLines || [];
                  face.bindedLines.push(primitive);

                  return primitive;
                });
              }
              else {
                primitive.product = new Rib({
                  R: state.radius,
                  width: state.beamsWidth * mm,
                  thickness: state.beamsThickness * mm,
                  line: primitive
                });
              }
              break;

            case 'face':
              primitive.product = new (primitive.$points.length === 3 && false ? Triangle : Face)(primitive, {
                R: state.radius,
                bilateral: _.contains(['GoodKarma', 'Semicone'], state.connType)
              });
              break;

            default:
              throw 'Product type unknown: ' + primitive.type;
          }
          return primitive;
        })));

        return figure;
      }
    }, {
      name: 'preparing to unify',
      process: function (figure) {
        figure.prepareUnify();
        return figure;
      }
    }, {
      name: 'unification',
      process: function (figure) {
        figure.unify();
        return figure;
      }
    }, {
      name: 'slice',
      process: function (figure) {
        /*
        figure.$points = $([]);
        figure.$primitives = figure.$primitives.filter(function() {
          if (this.type == 'vertex' && this.live) {
            figure.$points.push( this.$points[0] );
          }
          return this.bindedFace ? this.bindedFace.live : this.live;
        });
        figure.relations();
        */
        _.chain(figure.$primitives)
          .map(prim => {
            var face = prim.bindedFace || (prim.type === 'face' && prim);

            return face && !face.live && face;
          })
          .compact()
          .unique()
          .each(face => {
            figure.safeRemoveMember(face);
          });

        // GoodKarma/Semicone workaround, slice dark-side clones binded to removed face
        if (state.connType == 'GoodKarma' || state.connType == 'Semicone') {
          // filter lines binded to removed face
          var faces = _.filter(figure.$primitives, function (prim) {
            return !prim.removed && prim.type === 'face';
          });

          figure.$primitives = figure.$primitives.filter(function () {
            return 0
              || this.type != 'line'
              || _.contains(faces, this.bindedFace);
          });
        }

        return figure.detectSelvage('sliced');
      }
    }, {
      name: 'statistics',
      process: function (figure) {
        // remove items
        _.each(figure.$primitives, function (figure, index) {
          if (_.contains(state.removedList, figure.removeIndex)) {
            figure.remove();
          }
          //if (_.contains(state.removedList, figure.removeIndex)) {
          //	figure.remove();
          //}
        });

        // apply tent net, if needed
        if (form.tentNetNeedUpdate) {
          form.initTentNet(form.tentNetNeedUpdate.start);
          form.tentNetNeedUpdate = false;
        }

        _.each(figure.$primitives.get(), function (line) {
          if (line.type === 'line') {
            if (_.contains(state.tentNetLineList, line.removeIndex)) {
              line.separate();
            } else {
              line.connect();
            }
          }
        });

        // translate figure value to start compute report
        form.resultFigure(figure);

        return figure;
      }
    }, {
      name: 'plot product',
      process: function (figure) {
        // по типам
        var productAreaWidth = $('.budget-list').width() - 10;

        form.budgetList(_.compact(_.map([
          { type: 'line', canvasAttr: { width: productAreaWidth, height: state.connType == 'Semicone' ? 150 : 220 } },
          {
            type: 'face', canvasAttr: {
              width: productAreaWidth / CONFIG.view.drawings.face.cols,
              height: productAreaWidth / CONFIG.view.drawings.face.cols
            }
          },
          { type: 'vertex', canvasAttr: { width: productAreaWidth / 3 } }
        ], function (budget) {
          budget.units = ko.computed(function () {
            var dependsFrom = form.removedList();
            return _.where(figure.$primitives, { type: budget.type, removed: false });
          });
          budget.sizeList = _.compact(_.map(figure.stat[budget.type], function (size) {
            /*_.chain(size.collect) todo: implement plot for fullfilled instances (wrong lines plot)
                .sortBy(function(inst) {
                  return inst.$subsets.length + inst.$supersets.length;
                })
                .last()
                .value()*/

            switch (budget.type) {
              case 'vertex':
                var sample = _.sortBy(size.collect, function (one) {
                  return - // find with max count of live lines around
                    _.chain(one.product.$hedgehog)
                      .pluck('source')
                      .where({ live: true })
                      .value().length;
                })[0];
                break;
              default:
                sample = size.collect[0];
            }

            var product = sample.product;

            if (product.plot) {
              return {
                index: size.index,
                color: productPalette[budget.type][size.order].css,
                product: product,
                units: ko.computed(function () {
                  return _.filter(budget.units(), function (unit) {
                    return unit.index === size.index;
                  });
                })
              };
            }
          }));
          return _.isEmpty(budget.sizeList) ? null : budget;
        })));

        return figure;
      }
    }, {
      name: 'render scene',
      process: function (figure) {
        viewer.trigger('render', figure);

        const getMemberParams = (steelCrossSection) => [
          200000000000,
          steelCrossSection,
          275000000,
          78000,
        ]

        const coerce = ({ x, y, z }) => ({
          x: parseFloat((x).toFixed(100)),
          y: parseFloat((y).toFixed(100)),
          z: parseFloat((z).toFixed(100)),
        });

        const vectorId = ({ x, y, z }) => `${x}-${y}-${z}`;

        const coercedPoints = Object.fromEntries(
          figure.origin.$points.toArray()
            .map(({ x, y, z }) => {
              return [
                vectorId({ x, y, z }),
                coerce({ x, y, z }),
              ];
            })
        );

        const rawElements = figure.$primitives.toArray()
          .filter(({ type, removed }) => type === 'line' && !removed)
          .map(({ $points }) => $points.toArray())
          .map(([a, b]) => {
            const aId = vectorId(coerce(a));
            const bId = vectorId(coerce(b));

            const lowestY = Math.min(a.y, b.y);
            const lowestPoint = a.y < b.y ? aId : bId;

            return {
              aId,
              bId,
              lowestY,
              lowestPoint,
            };
          });

        const indexedPoints = Object.fromEntries(
          Object.entries(
            rawElements
              .reduce(
                (all, { aId, bId }) => {
                  return {
                    ...all,
                    [aId]: coercedPoints[aId],
                    [bId]: coercedPoints[bId],
                  };
                },
                {},
              )
          )
            .sort(([, a], [, b]) => b.y - a.y)
            .map(
              ([id, point], index) => ([
                id,
                {
                  ...point,
                  index: index + 1,
                }
              ])
            )
        );

        const calculateElements = () => {
          const defaultCrossSection = 0.00006876;

          const inputSteelCrossSection = parseFloat(
            window.prompt('Type the steel cross section area', defaultCrossSection)
          );

          const steelCrossSection = isNaN(inputSteelCrossSection) ? defaultCrossSection : inputSteelCrossSection;

          return rawElements
            .map(({ aId, bId }) => {
              return [
                indexedPoints[aId].index,
                indexedPoints[bId].index,
              ];
            })
            .map((arr, index) => [
              index + 1,
              ...arr,
              ...getMemberParams(steelCrossSection)
            ].join('\t')).join('\n');
        };

        const classifiedElements = Object.entries(
          Object.values(rawElements)
            .reduce((all, { a, b, lowestY, lowestPoint }) => ({
              ...all,
              [lowestPoint]: {
                a,
                b,
                lowestY,
              }
            }), {})
        )
          .map(([lowestPoint, member]) => ({
            lowestPoint,
            ...member,
          }));

        const calculatePoints = () => Object.values(indexedPoints)
          .map(
            ({ index, ...point }) => {
              const { x, y, z } = coerce(point);

              return [
                index,
                x * 10,
                y * 10,
                z * 10,
              ].join('\t');
            }
          )
          .join('\n');

        const calculateRestraints = () => {
          const count = parseInt(window.prompt('Type the amount of restraints', 10));

          const validCount = isNaN(count) ? 10 : count;

          return classifiedElements
            .sort((a, b) => a.lowestY - b.lowestY)
            .slice(0, validCount)
            // .filter(({ y }) => y >= -0.075 && y < 0.025)
            .map(({ lowestPoint }) => [indexedPoints[lowestPoint].index, 'TRUE', 'TRUE', 'TRUE'].join('\t'))
            .join('\n');
        };

        const calculateLoads = () => {
          const defaultImposedLoadT = 5;
          const userImposedLoad = parseFloat(window.prompt('Type the imposed load (Ton)', defaultImposedLoadT));
          const imposedLoadT = isNaN(userImposedLoad) ? defaultImposedLoadT : userImposedLoad;
          const imposedLoadN = imposedLoadT * 10000;

          const defaultLoadPoints = 5;
          const userLoadPoints = parseInt(window.prompt('Type the amount of points to distribute the load', defaultLoadPoints));
          const loadPoints = (isNaN(userLoadPoints) || userLoadPoints === 0) ? defaultLoadPoints : userLoadPoints;

          const defaultOmitFirst = 0;
          const userOmitFirst = parseInt(window.prompt('Type the amount of points to omit from the top', defaultOmitFirst));
          const omitFirst = isNaN(userOmitFirst) ? defaultOmitFirst : userOmitFirst;

          const singleLoad = imposedLoadN / loadPoints;

          return new Array(loadPoints).fill(null)
            .map(
              (_, index) => [
                index + 1 + omitFirst,
                0,
                singleLoad * -1,
                0,
              ].join('\t')
            ).join('\n');
        };

        const writeToClipboard = (text) => setTimeout(() => {
          navigator.clipboard.writeText(text);
        }, 1)

        $('#copy-points').off('click');
        $('#copy-members').off('click');
        $('#copy-restraints').off('click');
        $('#copy-loads').off('click');

        setTimeout(() => {
          $('#copy-points').on('click', () => {
            const points = calculatePoints();

            writeToClipboard(points);
          });
          $('#copy-members').on('click', () => {
            const elements = calculateElements();

            writeToClipboard(elements);
          });
          $('#copy-restraints').on(
            'click',
            () => {
              const restraints = calculateRestraints();

              writeToClipboard(restraints);
            },
          );
          $('#copy-loads').on(
            'click',
            () => {
              const loads = calculateLoads();

              writeToClipboard(loads);
            },
          );
        }, 50);

        return figure;
      }
    }, {
      name: 'push log',
      process: function (figure) {
        // state and last state diff
        var diff = _.reduce(state, function (diff, value, key) {
          if (form._lastState[key] !== state[key])
            diff[key] = value;
          return diff;
        }, {});

        // save last form state
        form._lastState = _.mapObject(state, _.clone);

        // fix initial page height (auto scroll position refreshed page issue)
        if ($('body').css('height') !== 'auto') {
          $('body').css('height', 'auto');
        }

        if (!_.isEmpty(diff)) {
          console.log('figure diff:', diff);
        }

        return figure;
      }
    }
  ]));

  form._lastState = state;
}


// progress bar of calculation process
!function () {
  var $progress = $('.geodesic .progress'), progressTotal;

  function progress(step, msg) {
    $progress.text(msg + '  ' + (step + 1) + '/' + progressTotal);
  }

  calcProc
    .on('start', function (chain) {
      $progress.show();
      progressTotal = chain.length;
      progress(0, 'calculation started...');
      console.time && console.time('process time');
    })
    .on('cancel', function (chain) {
      progress(null, 'calculation was brutal cancelled');
      console.time && console.timeEnd('process time');
    })
    .on('complete', function (chain) {
      progress(chain.length, 'calculation complete');
      console.time && console.timeEnd('process time');
      $progress.hide();
    })
    .on('stage', function (stage, step) {
      progress(step, stage.name);
    })
    .on('stageOk', function (stage, step) {
      progress(step, stage.name + ' ok');
    });
}();


// geo receiver
$(document).on('geo-complete', function (event, geo) {
  console.log('geo complete with', geo);
});


// bind form layout with view-model instance
$(function () {
  // test lang is set
  var hasLang = i18n.lang();

  ko.applyBindings(form);
});