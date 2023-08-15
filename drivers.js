viewer.drivers = (function () {
  var geometry;

  // new vertices registration helper
  function pushVertex(v) {
    var index = _.indexOf(_.pluck(geometry.vertices, 'source'), v);
    if (-1 != index) return index;

    var vertice = new THREE.Vector3().copy(v);
    //vertice.w = 1;
    vertice.source = v;
    geometry.vertices.push(vertice);
    return geometry.vertices.length - 1;
  }

  function pushFace(face, appendRevertedVersion) {
    if (appendRevertedVersion) {
      pushFace(face.slice(0).reverse(), false);
    }

    face = _.map(face, pushVertex);
    if (face.length == 3) {
      geometry.faces.push(new THREE.Face3(face[0], face[1], face[2]));
    }
    else if (face.length >= 4) {
      for (var i = 1, l = face.length; i < l - 2; i += 2) {
        var face4 = new THREE.Face4(face[0], face[i + 0], face[i + 1], face[i + 2]);

        geometry.faces.push(face4);

        if (face.length > 4) {
          face4._source = face;
          (face._collect = face._collect || []).push(face4);
        }
      }
      if (face.length % 2) {
        var face3 = new THREE.Face3(face[0], face[i + 0], face[i + 1]);
        geometry.faces.push(face3);
        if (face.length > 4) {
          face3._source = face;
          (face._collect = face._collect || []).push(face3);
        }
      }
    }
    else {
      console.error('wrong face', face);
    }
  }

  function averageVertex3(target, vertices) {
    target.x =
      target.y =
      target.z = 0;
    _.reduce(vertices, function (center, v) {
      return center.add(v);
    }, target)
      .multiplyScalar(1 / vertices.length);
  }

  const MAX_FONT_SIZE = 200,
    MAX_BG_RADIUS = 200;

  function makeParticleLabelProgram(options) {
    const font = Math.min(options.fontSize, MAX_FONT_SIZE) + 'px ' + options.fontFamily,
      bgRadius = options.bgRadius && Math.min(options.bgRadius, MAX_BG_RADIUS);

    return function (ctx) {
      ctx.transform(1, 0, 0, -1, 0, 0);

      if (bgRadius) {
        ctx.beginPath();

        var gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, bgRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.arc(0, 0, bgRadius, 0, Math.PI * 2);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'black';
      ctx.font = font;
      ctx.fillText(options.text, 0, 0);
    };
  }

  const CUTTING_LINE_MATERIAL = new THREE.LineDashedMaterial({
    color: 0,
    linewidth: 2,
    dashSize: 7,
    gapSize: 4,
    vertexColors: THREE.VertexColors
  }),
    presentCuttingLine = (face) => {
      if (_.isEmpty(face.cuttingLine)) return;

      var lineGeometry = new THREE.Geometry();

      _.each(face.cuttingLine, function (point) {
        lineGeometry.vertices.push(
          new THREE.Vector3().copy(point).multiplyScalar(1010 * form.state.radius)
        );
      });

      return new THREE.Line(lineGeometry, CUTTING_LINE_MATERIAL);
    };

  return {
    "carcass": {
      particle: 1,
      present: function (figure, color) {
        // cutting line
        if (figure.type === 'face') {
          return presentCuttingLine(figure);
        }

        // lines only
        if (figure.type !== 'line') return null;

        geometry = new THREE.Geometry();

        // get product model
        var model = figure.product.model(true);

        var material = new THREE.MeshLambertMaterial({
          color: color,
          shading: THREE.FlatShading,
          overdraw: true,
          wireframe: false,
          opacity: 0.95
        });

        _.each(model, function (face) {
          pushFace(face, false);
        });

        //geometry.normalsNeedUpdate = true;
        geometry.computeFaceNormals();

        // restore normals of face4 like face3
        _.each(geometry.faces, function (face) {
          const sface = face._source;

          if (sface) {
            const normally = _.find(sface._collect, face4 => face4.normal.length() > 0);

            normally && _.each(sface._collect, function (face4) {
              face4.normal.copy(normally.normal);
            });
          }
        });

        return new THREE.Mesh(geometry, material);
      }
    },

    "tent": {
      N: {
        loader: null,
        content: null
      },
      showRemoved: false,
      particle: (function (particle) {
        // optional
        if (!CONFIG.get('view.modeTent.present')) {
          return particle;
        }

        // static code
        const loader = new THREE.TextureLoader();

        loader.load('./N.jpg');
        loader.addEventListener("load", function (loader) {
          var texture = loader.content;

          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.magFilter = THREE.NearestFilter;

          //texture.needsUpdate = true;

          var driver = viewer.drivers["tent"],
            N = driver.N,
            content = loader.content,
            image = content.image;

          N.loader = loader,
            N.content = content,
            N.width = image.width;
          N.height = image.height;

          driver.mapper = (function () {
            var width = N.width,
              height = N.height;

            return function (u, v) {
              return [
                u,//* width,
                v //* height
              ];
            }
          })();

          console.log('N loaded...', N);
        });

        return particle;
      })(1),

      present: function (figure, color) {
        if ('vertex' === figure.type) return;

        var isModePattern = ('pattern' === viewer.pattern.mode()),
          useUV = figure.tentPoints && figure.tentPoints[0].stratoUV;

        var driver = viewer.drivers["tent"],
          faceMaterial,
          modelFace,
          smallFace,
          uvs;

        // hack to use-uv mode drawing without line
        if (!driver.useUV && useUV) {
          _.delay(function () {
            delete driver.useUV;
          });
          driver.useUV = true;
        }
        useUV = driver.useUV;

        // face model
        modelFace = figure.product.model(true)[0];
        smallFace = _.map(modelFace, function (point, index) {
          return nearPoint(
            point,
            modelFace[(index + 1) % 3],
            modelFace[(index + 2) % 3]
          );
        });

        function renderFaceModel(options) {
          options = options || {};

          var rendered = {};

          if (useUV) {
            // texture
            var facePoints = isModePattern ? figure.tentPoints : smallFace;
            pushFace(facePoints, false);

            faceMaterial = new THREE.MeshBasicMaterial({
              map: viewer.drivers["tent"].N.content, //texture
              side: THREE.DoubleSide,
              shading: THREE.FlatShading,

              overdraw: true,
              wireframe: false,

              opacity: .94//.93
            });

            uvs = geometry.faceVertexUvs[0] = [];

            _.each(geometry.faces, function () { // !!! once face onto geometry
              var mapper = viewer.drivers["tent"].mapper
                || (function (u, v) { return [u, v] }),

                uvs = _.pluck(figure.tentPoints, 'stratoUV')
                  .map(function (uv) {
                    var mapped = mapper(uv[0], uv[1]);

                    return new THREE.Vector2(mapped[0], mapped[1]);
                  });

              geometry.faceVertexUvs[0].push(
                //uvs	
                isModePattern ? uvs : uvs.reverse()
              );
            });

            geometry.uvsNeedUpdate = true;
          }
          else {
            // ! useUV
            // solid filling
            pushFace(smallFace, true);

            faceMaterial = new THREE.MeshLambertMaterial({
              color: color,
              side: THREE.DoubleSide,
              overdraw: true,
              wireframe: false
            });
          }

          geometry.computeFaceNormals();

          rendered.face = new THREE.Mesh(geometry, faceMaterial);

          // mouse :hover
          if (options.hover) {
            var overFace = false;

            function updateFaceOpacity() {
              faceMaterial.opacity =
                overFace ? (options.hover.on || 1)
                  : (options.hover.off || .9);
              //contourMaterial.opacity = overFace ? .9 : 0.5;

              if (options.hover.cursor) {
                $('canvas')[0].style.cursor = overFace ? options.hover.cursor : '';
              }
            }

            updateFaceOpacity();

            _.extend(rendered.face, Backbone.Events)
              .on('mousein', function (e) {
                overFace = true;
                updateFaceOpacity();
              })
              .on('mouseout', function (e) {
                overFace = false;
                updateFaceOpacity();
              })
              .on('click', function (e) {
                options.click();

                overFace = true;
                updateFaceOpacity();

                _.delay(function () {
                  // after all drived
                  viewer.flash(true);
                });
              });
          }

          // contour
          if (true === options.contour) {
            var contourMaterial = new THREE.LineDashedMaterial({
              color: THREE.ColorKeywords.gray,
              linewidth: 2,
              dashSize: 5,
              gapSize: 3,
              vertexColors: THREE.VertexColors
            }),
              contourGeometry = new THREE.Geometry();

            _.each(geometry.vertices, function (vertice) {
              contourGeometry.vertices.push(
                vertice.clone().multiplyScalar(1.010 * form.state.radius)
              );
            });
            contourGeometry.vertices.push(
              geometry.vertices[0].clone().multiplyScalar(1.010 * form.state.radius)
            );

            rendered.contour = new THREE.Line(contourGeometry, contourMaterial);
          }

          return rendered;
        }

        geometry = new THREE.Geometry();

        // 2d mode
        if ('pattern' === viewer.pattern.mode()) {
          if ('face' === figure.type) {
            // render face model
            var face = figure,
              facePoints = face.$points.get(),
              faceMesh = renderFaceModel().face;

            // render overlaps
            var overlapMeshList = _.where(face.$sub.line, {
              separator: true
            })
              // down-to-up direction for separation sides only
              .filter(function (line) {
                var points = line.$points.get(),
                  map = _.map(points, function (point) {
                    return _.indexOf(facePoints, point);
                  }),
                  dir = line._sideDir = (map[1] === (map[0] + 1) % 3),
                  product = Vector.crossProduct(points[0], points[1])[AXIS];

                return dir ? product > 0 : product <= 0;
              })
              .map(function (line) {
                var overlapPoints = _.map(line.$points.get(), function (point) {
                  var facePointIndex = _.indexOf(facePoints, point);

                  return face.tentPoints[facePointIndex].clone();
                }),

                  OVERLAP_WIDTH = .1 / form.state.radius,

                  alongOverlap = overlapPoints[1].clone().subtract(overlapPoints[0])
                    .normalize()
                    .scale(OVERLAP_WIDTH * .62), // gold

                  director = (new THREE.Vector3)
                    .crossVectors(alongOverlap, AXIS_VECTOR3)
                    .normalize()
                    .multiplyScalar(line._sideDir ? - OVERLAP_WIDTH : OVERLAP_WIDTH),

                  overlapMaterial = new THREE.MeshBasicMaterial({
                    color: THREE.ColorKeywords.gray,
                    shading: THREE.FlatShading,
                    side: THREE.DoubleSide,
                    overdraw: false,
                    wireframe: false,
                    opacity: .33
                  });

                overlapPoints.push(
                  overlapPoints[1].clone().add(director).subtract(alongOverlap)
                    // hack overlap visibility under texture through "z-index" coordinate
                    .add({ x: 0, y: -OVERLAP_WIDTH, z: 0 })
                );
                overlapPoints.push(
                  overlapPoints[0].clone().add(director).add(alongOverlap)
                    // etc
                    .add({ x: 0, y: -OVERLAP_WIDTH, z: 0 })
                );

                // render
                geometry = new THREE.Geometry();

                pushFace(overlapPoints, true);

                var overlapMesh = new THREE.Mesh(geometry, overlapMaterial);

                //overlapMesh.sortOrder = 0;
                return overlapMesh;
              });

            //faceMesh.sortOrder = 1;
            return overlapMeshList.concat([faceMesh]);
          }
          // pattern => face only
          return;
        }

        // 3d mode
        if (figure.type === 'face') {
          geometry = new THREE.Geometry();

          // render model
          var rendered = renderFaceModel({
            hover: {
              off: .94,
              on: 1,
              cursor: "all-scroll",
            },
            click: function () {
              form.tentNetBeginFace(figure["removeIndex"]);
            }
          });

          return [rendered.face];
        }
        else if ('line' === figure.type) {
          var line = figure,
            linePoints = line.$points.get(),

            isStatic = _.contains(form.tentNetStaticLineList(), line),
            isAdvanced = _.contains(form.tentNetAdvancedLineList(), line),

            lineObjects = _.chain(line.origin.$super.face)
              .map(function (face) {
                if (face.removed) return null;

                var farFacePoint = _.difference(face.$points.get(), linePoints)[0],
                  semiLineFace = _.map([
                    nearPoint(linePoints[0], linePoints[1], farFacePoint, .07),
                    nearPoint(linePoints[1], linePoints[0], farFacePoint, .07),
                    //linePoints[1],
                    //linePoints[0],
                    nearPoint(linePoints[1], linePoints[0], linePoints[0], .05),
                    nearPoint(linePoints[0], linePoints[1], linePoints[1], .05),
                  ], v => v.scale(1)),
                  semiFaceColor = productPalette[face.type][face.order].integer;

                geometry = new THREE.Geometry();

                pushFace(semiLineFace, true);

                var semiLineMaterial = new THREE.MeshLambertMaterial({
                  color: isStatic ? THREE.ColorKeywords.red
                    : (isAdvanced ? THREE.ColorKeywords.green : THREE.ColorKeywords.green),
                  shading: THREE.FlatShading,
                  overdraw: true,
                  wireframe: false,
                });

                // semiLineMaterial._color = semiFaceColor;

                geometry.computeFaceNormals();

                var lineMesh = new THREE.Mesh(geometry, semiLineMaterial);

                _.extend(lineMesh, Backbone.Events)
                  .on('mousein', function (e) {
                    lineOver = true;
                    updateLineOpacity();
                  })
                  .on('mouseout', function (e) {
                    lineOver = false;
                    updateLineOpacity();
                  })
                  .on('click', function (e) {
                    if (isStatic) return;

                    if (isAdvanced) {
                      var connected = line.connect();
                      form.tentNetAdvancedLineList.removeAll(connected);
                      isAdvanced = false;
                    } else {
                      var separated = line.separate();
                      form.tentNetAdvancedLineList.push.apply(form.tentNetAdvancedLineList, separated);
                      isAdvanced = true;
                    }
                    updateLineOpacity();
                  });

                return lineMesh;
              })
              .compact()
              .value(),

            lineMaterials = _.pluck(lineObjects, 'material'),

            lineOver = false;

          updateLineOpacity();

          return lineObjects.length >= 2 ? lineObjects : [];

          function updateLineOpacity() {
            var opacity = lineOver ?
              (line.separator ? .75 : .5) :
              (line.separator ? 1 : .25);

            _.each(lineMaterials, function (semiLineMaterial) {
              semiLineMaterial.opacity = opacity;
              //semiLineMaterial.color = color;
            });
          }
        }
        else return null;

        function nearPoint(master, slave1, slave2, how) {
          how = how || .05;

          return new Metrics.Vector()
            .add(master.clone().scale(1 - how))
            .add(slave1.clone().scale(how / 2))
            .add(slave2.clone().scale(how / 2));
        }
      }
    },

    "cover": {
      showRemoved: true,
      particle: 1,
      present: function (figure, color) {
        if (figure.type != 'face') return null;

        geometry = new THREE.Geometry();

        // get product model
        var model = figure.product.model(true);

        _.each(model, function (face) {
          pushFace(face, true);
        });

        //geometry.normalsNeedUpdate = true;
        geometry.computeFaceNormals();

        // restore normals of face4 like face3
        _.each(geometry.faces, function (face) {
          var sface = face._source;

          if (sface) {
            var normal = _.filter(sface._collect, function (face4) {
              return face4.normal.length() > 0;
            })[0].normal;

            _.each(sface._collect, function (face4) {
              face4.normal.copy(normal);
            });
          }
        });

        var material = new THREE.MeshLambertMaterial({
          color: color,
          shading: THREE.FlatShading,
          overdraw: true,
          wireframe: false
        }),
          contourMaterial = new THREE.LineDashedMaterial({
            color: 0,
            linewidth: 5,
            dashSize: 8,
            gapSize: 5,
            vertexColors: THREE.VertexColors
          }),
          contourGeometry = new THREE.Geometry();

        _.each(figure.$points.get(), point => {
          const vertice = _.findWhere(geometry.vertices, { source: point });

          contourGeometry.vertices.push(
            vertice.clone().multiplyScalar(1000 * form.state.radius)
          );
        });
        contourGeometry.vertices.push(
          _.findWhere(geometry.vertices, { source: figure.$points[0] })
            .clone().multiplyScalar(1000 * form.state.radius)
        );
        /*
        _.each(geometry.vertices, function(vertice) {
          contourGeometry.vertices.push(
            vertice.clone().multiplyScalar(1000 * form.state.radius)
          );
        });
        contourGeometry.vertices.push(
          geometry.vertices[0].clone().multiplyScalar(1000 * form.state.radius)
        );
        */

        var contour = new THREE.Line(contourGeometry, contourMaterial);

        updateOpacity();

        var object = new THREE.Mesh(geometry, material),
          over = false;

        _.extend(object, Backbone.Events)
          .on('mousein', function (e) {
            over = true;
            updateOpacity();
          })
          .on('mouseout', function (e) {
            over = false;
            updateOpacity();
          })
          .on('click', function (e) {
            if (figure.removed) {
              var restored = _.pluck(figure.restore(), 'removeIndex');
              form.removedList.removeAll(restored);
            } else {
              var removed = _.pluck(figure.remove(), 'removeIndex');
              form.removedList.push.apply(form.removedList, removed);
            }
            updateOpacity();
          });

        // cutting line
        return [object, contour, presentCuttingLine(figure)]; // todo: how to do cutting bolder?

        function updateOpacity() {
          material.opacity = CONFIG.view.modeCover.opacity(over, figure.removed);
          contourMaterial.opacity = over ? .5 : 0;
        }
      }
    },

    "schema": {
      particle: 1 / 3,
      present: function (figure, color) {
        geometry = new THREE.Geometry();

        _.each(figure.$points, pushVertex);

        var object = new THREE.Object3D();

        //				if (this[figure.type]) {
        //					var adv = this[figure.type](figure, color);
        //					if (adv) object.add(adv);
        //				}

        // product index
        var fontSize = (form.state.radius / form.state.detail * 100) * (form.state.subdivClass == 'I' ? 1 : 1.33),
          particle = new THREE.Particle(new THREE.ParticleCanvasMaterial({
            color: color,
            program: makeParticleLabelProgram({
              fontSize: fontSize * (figure.type === 'face' ? 1.3 : 1),
              fontFamily: 'Optimer, verdana',
              bgRadius: fontSize,
              text: figure.index
            })
          }));

        if (figure.type == 'vertex') {
          averageVertex3(particle.position, figure.$points);
          particle.position.multiplyScalar(1 + 0.05 / figure.product.R); // 5cm to outside
        } else {
          var points = _.unique(_.flatten(figure.product.model(true)));

          if (figure.type == 'line' && /^GoodKarma|Semicone$/.test(form.state.connType)) {
            //points = points.concat()
            points = points.concat(figure.bindedFace.$points.get());
          }

          averageVertex3(particle.position, points);
          particle.position.normalize();
        }
        particle.position.multiplyScalar(1.001);
        //particle.updateMatrix();

        object.add(particle);

        return [viewer.drivers["carcass"].present(figure, color), object];
      }
    },

    "base": {
      particle: 1 / 3,
      present: (function () {
        return function (figure, color) {
          if (figure.type != 'line' || figure.origin.removed || (figure.bindedFace && figure.bindedFace.removed)) return;

          var isActive = (_.where(figure.origin.$super.face, { removed: false }).length == 1), // basically
            isBase = isActive;

          var lineObject = viewer.drivers["carcass"].present(figure, color),
            objects = [lineObject];

          begin(objects);

          if (isBase) {
            baseLines.push(figure);
          }

          lineObject.material.opacity = isActive ? .5 : .027;

          _.extend(lineObject, Backbone.Events)
            .on('mousein', function (e) {
              this.material.opacity = .263;
            })
            .on('mouseout', function (e) {
              this.material.opacity = isActive ? .5 : .027;
            })
            .on('click', function (e) {
              // toggle activity
              isActive = !isActive;

              if (isActive) {
                activeLines.push(figure);
              } else {
                activeLines = _.difference(activeLines, [figure]);
              }

              if (isBase) {
                recalcBaseMetricContainer();
              }

              _.each(figure.origin.$sub.vertex, updateVertexMetric);

              this.material.opacity = isActive ? .5 : .027;
            });

          _.each(figure.origin.$sub.vertex, function (vertex) {
            if (once(vertex)) {
              vertex.metricObjects = vertexMetric(vertex);

              objects = objects.concat(vertex.metricObjects);
            }
            updateVertexMetric(vertex);
          });

          if (isActive) {
            activeLines.push(figure)
          }

          return objects;
        };

        var inited, axisDown, R,
          vertexRegister, activeLines, baseLines, baseVertexes,
          baseMetricContainer;

        function begin(objects) {
          if (inited) return;

          vertexRegister = [];
          activeLines = [];
          baseLines = [];

          // release mem
          _.each(figure.subs('vertex'), function (vertex) {
            delete vertex.metricObjects;
          });

          // init base metric container
          baseMetricContainer = new THREE.Object3D();
          objects.push(baseMetricContainer);

          R = form.state.radius;

          // get down position by axis uses global figure object
          axisDown = _.chain(figure.subs('vertex'))
            .where({ removed: false, live: true })
            .pluck('$points').pluck('0')
            .pluck(AXIS)
            .min()
            .value();

          // destroy inited state after driver been fully applied by current runtime
          _.defer(end);

          inited = true;
        }
        function end() {
          // order base vertexes collection as polygon
          var lines = _.tail(baseLines, 0),
            line = lines[0],
            vertex = line.origin.$sub.vertex[0];
          baseVertexes = [];
          while (line) {
            baseVertexes.push(vertex);
            lines = _.difference(lines, [line]);
            line = _.find(lines, function (l) {
              return _.contains(l.origin.$sub.vertex, vertex);
            });
            vertex = line && line.origin.$sub.vertex[line.origin.$sub.vertex[0] === vertex ? 1 : 0];
          }

          _.isEmpty(lines) || console.error('Achtung happens');

          recalcBaseMetricContainer();
          viewer.trigger('render');

          inited = false;
        }

        function once(entity) {
          if (!_.contains(vertexRegister, entity)) {
            vertexRegister.push(entity);
            return true;
          }
        }

        function recalcBaseMetricContainer() {
          var cont = baseMetricContainer;

          // clear
          for (var i = cont.children.length - 1; i >= 0; i--)
            cont.remove(cont.children[i]);

          // fill
          var vertexes = _.intersection(baseVertexes, _.chain(activeLines).pluck('origin').unique().pluck('$sub').pluck('vertex').invoke('get').flatten().value());
          if (vertexes.length > 1) {
            var lineColor = 0x808080,
              lineMaterial = new THREE.LineBasicMaterial({
                color: lineColor,
                opacity: 1,
                linewidth: 1,
                vertexColors: THREE.VertexColors
              }),
              prevVertex = _.last(vertexes);

            _.each(vertexes, function (vertex) {
              var lineGeometry = new THREE.Geometry,
                vertices = _.map([prevVertex, vertex], function (vertex) {
                  var point = vertex.$points[0],
                    vertice = new THREE.Vector3(point.x, point.y, point.z);
                  vertice[AXIS] = axisDown;
                  lineGeometry.vertices.push(vertice.multiplyScalar(1000 * R));
                  return vertice;
                });
              baseMetricContainer.add(new THREE.Line(lineGeometry, lineMaterial));

              // line length, mm
              var lineParticle = new THREE.Particle(new THREE.ParticleCanvasMaterial({
                color: 'black',
                program: makeParticleLabelProgram({
                  fontSize: (24 * R),
                  fontFamily: 'monospace, Optimer, verdana',
                  text: Math.round(vertices[0].clone().sub(vertices[1]).length())
                })
              }));
              lineParticle.position.addVectors(vertices[0], vertices[1]).multiplyScalar(.5 / 1000 / R); // todo: refactor for no coords magic
              baseMetricContainer.add(lineParticle);

              prevVertex = vertex;
            });
          }

          // metric polygon members
          var members = _.intersection()
        }

        function updateVertexMetric(vertex) {
          _.each(vertex.metricObjects, function (object) {
            object.visible = _.any(vertex.$super.line, function (line) {
              return _.contains(activeLines, line);
            });
          });
        }

        function vertexMetric(vertex) {
          var point = vertex.$points[0],
            baseDelta = Math.abs(point[AXIS] - axisDown) * R;

          // radius
          var vertexColor = productPalette[vertex.type][vertex.order].integer,
            radiusGeometry = new THREE.Geometry,
            radiusVertice = new THREE.Vector3(point.x, point.y, point.z),
            radiusCenter = new THREE.Vector3,
            vertexMaterial = new THREE.LineBasicMaterial({
              color: vertexColor,
              opacity: 1,
              linewidth: 1,
              vertexColors: THREE.VertexColors
            });

          radiusCenter[AXIS] = axisDown;
          radiusVertice[AXIS] = axisDown;

          radiusGeometry.vertices.push(radiusCenter.multiplyScalar(1000 * R));
          radiusGeometry.vertices.push(radiusVertice.multiplyScalar(1000 * R));

          var radiusLine = new THREE.Line(radiusGeometry, vertexMaterial);

          // radius length, mm
          var radiusParticle = new THREE.Particle(new THREE.ParticleCanvasMaterial({
            color: 'black',
            program: makeParticleLabelProgram({
              fontSize: (24 * R),
              fontFamily: 'monospace, Optimer, verdana',
              text: Math.round(radiusVertice.clone().sub(radiusCenter).length())
            })
          }));
          radiusParticle.position.addVectors(radiusCenter, radiusVertice).multiplyScalar(.5 / 1000 / R); // todo: refactor for no coords magic

          if (baseDelta > 1e-6) {
            var deltaBase = new THREE.Vector3(point.x, point.y, point.z),
              deltaVertice = deltaBase.clone(),
              deltaGeometry = new THREE.Geometry;

            deltaBase[AXIS] = axisDown;

            deltaGeometry.vertices.push(deltaBase.multiplyScalar(1000 * R));
            deltaGeometry.vertices.push(deltaVertice.multiplyScalar(1000 * R));

            var deltaLine = new THREE.Line(deltaGeometry, vertexMaterial);

            // delta, mm
            var deltaParticle = new THREE.Particle(new THREE.ParticleCanvasMaterial({
              color: 'black',
              program: makeParticleLabelProgram({
                fontSize: (24 * R),
                fontFamily: 'monospace, Optimer, verdana',
                text: Math.round(deltaBase.clone().sub(deltaVertice).length())
              })
            }));
            deltaParticle.position.subVectors(deltaVertice, deltaBase).setLength(32 * R).add(deltaVertice).multiplyScalar(1 / 1000 / R);
          }

          return _.compact([radiusLine, radiusParticle, deltaLine, deltaParticle]);
        }
      })()
    }
  };
})();
