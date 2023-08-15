var viewer = (function () {
  var zoom = { current: 16, progress: 1, target: 16 },
    ZOOM_RANGE = [-8, 40],// 32 stable!
    ZOOM_LATENCY = 80, // ms
    SCROLL_NATIVE_WHEEL = {
      DELAY_MAX: 600, // ms
      lastNativeTime: +new Date
    },
    NEAR = 1.01, FAR = 10;

  var viewer = _.clone(Backbone.Events);

  var $dom = viewer.$dom = $('.geodesic'),
    $canvas = $dom.find('canvas.preview'),
    $form = $dom.find('form.options');

  // resize spy
  !function () {
    // bind
    $(window).on('resize', _.debounce(resizeCanvas, 300));

    // init
    $(function () {
      $dom.show();
      $(window).resize();

      // brut-fix strange small canvas on small-height viewport
      _.delay(resizeCanvas, 2000);
    });

    function resizeCanvas() {
      var w = $(window).width(),
        h = $(window).height(),
        fb = _.chain($form)
          .map(form => $(form).outerHeight(true) + $(form).offset().top)
          .max().value();

      if (w != canvasW || h != canvasH) {
        canvasH = Math.max(fb, h - (IS_IFRAME ? 0 : 50));
        canvasW = w;
        viewer.trigger('render');
      }
    }
  }();

  // mouse spy
  !function () {
    var touchStart, touchCurrent, overObject, hasRotate;

    $canvas
      .bind('mousedown touchstart', function (e) {
        if (!commonGroup) return;
        touchStart = touchScene(e);
      })
      .bind('mouseup touchend', function (e) {
        touchStart = null;
        _.defer(function () {
          hasRotate = false;
        });
      })
      .bind('mousemove touchmove', function (e) {
        touchCurrent = touchScene(e);
        if (touchStart) {
          // rotate startTouch.matrix, from startTouch.sphereCross to touch.sphereCross
          rotateSphere(touchStart, touchCurrent);
          hasRotate = true;
        }
        return false;
      })
      .click(function (e) {
        if (!hasRotate) {
          trigger('click', e);
        }
        //touchStart = null;
      });

    // mouse wheel / zooming
    $canvas[0].addEventListener('DOMMouseScroll', handleScroll, false);
    $canvas[0].addEventListener('mousewheel', handleScroll, false);

    function handleScroll(e) {
      var evt = e || window.event;
      var delta = (evt.detail < 0 || evt.wheelDelta > 0) ? 1 : -1;

      function skip() {
        SCROLL_NATIVE_WHEEL.lastNativeTime = +new Date;
      }

      if (delta) {
        var before = touchScene(e);

        if (!before.sphereTouch) {
          // except scroll without touched sphere
          return skip();
        }

        if (+new Date - SCROLL_NATIVE_WHEEL.lastNativeTime <= SCROLL_NATIVE_WHEEL.DELAY_MAX) {
          // except native serial scroll events
          return skip();
        }

        zoom.target = Math.min(Math.max(zoom.target + delta, ZOOM_RANGE[0]), ZOOM_RANGE[1]);
        if (zoom.progress === 1) {
          zoom = _.extend(zoom, {
            progress: 0,
            start: zoom.current,
            startTouch: before,
            startAt: new Date,
            startEvent: e
          });
        }
        zoomProgress();
      }

      return e.preventDefault() && false;
    }

    viewer.setZoomTarget = function (target, e) {
      _.extend(zoom, {
        target: target,
        progress: 0,
        start: zoom.current,
        //startTouch: before,
        startAt: new Date//,
        //startEvent: e
      });
      zoomProgress();
    };

    // auto zoom progresser
    function zoomProgress() {
      var now = (new Date).getTime(),
        timeout = 100,
        current = zoom.current;

      if (zoom.startAt) {
        zoom.progress = Math.min(now - zoom.startAt.getTime(), ZOOM_LATENCY) / ZOOM_LATENCY;
        zoom.current = zoom.start + (zoom.target - zoom.start) * zoom.progress;

        if (zoom.current != current) {
          viewer.trigger('render');
          //viewer.flash(false);

          if (zoom.startEvent) {
            var touch = touchScene(zoom.startEvent);
            rotateSphere(zoom.startTouch, touch);
          }

          timeout = 0;
        }

        //console.log('zoom', zoom.current);
      }

      if (zoom.progress < 1) {
        _.delay(zoomProgress, timeout);
      }
    }

    function rotateSphere(touch1, touch2) {
      var axis = touch1.sphereCross.clone().cross(touch2.sphereCross);
      var angle = touch1.sphereCross.angleTo(touch2.sphereCross);

      if (Math.abs(angle) < 1e-4 || Math.abs(axis.length()) < 1e-9) return;

      commonGroup.matrix = (new THREE.Matrix4).rotateByAxis(axis, angle)
        .multiply(touch1.matrix);

      viewer.trigger('render');
    }

    function touchScene(e) {
      var raycaster = getRaycaster(e);

      // fix Threejs: prepare mesh's vertices position to world coordinates
      _.each(scene.getDescendants(), function (mesh) {
        if (mesh instanceof THREE.Mesh) {
          mesh._geometryVertices = mesh.geometry.vertices;
          mesh.geometry.vertices = mesh._geometryWorldVertices = mesh._geometryWorldVertices ||
            _.map(mesh.geometry.vertices, function (v) {
              return v.clone().add(mesh.position);
            });
        }
      });
      var intersects = raycaster.intersectObjects(scene.children, true);
      // from fix
      _.each(scene.getDescendants(), function (mesh) {
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry.vertices = mesh._geometryVertices;
        }
      });


      // cross with shere
      var R = SCALE * form.state.radius,
        p = raycaster.ray.origin,
        v = raycaster.ray.direction,
        a = v.dot(v),
        b = v.dot(p) * 2,
        c = p.dot(p) - R * R,
        D = b * b - 4 * a * c,
        q = - b / 2 / a;
      if (D > 0) {
        D = Math.sqrt(D) / 2 / a;
        q = (c > 0) ? q - D : q + D;
      }

      var sphereCross = v.clone().multiplyScalar(q).add(p);

      if (_.isEmpty(intersects)) {
        trigger('mouseout', e);
        overObject = null;
      } else {
        if (overObject === intersects[0].object) {
          trigger('mousemove', e);
        }
        else {
          trigger('mouseout', e);
          overObject = intersects[0].object;
          trigger('mousein', e);
        }
      }

      return {
        raycaster: raycaster,
        intersect: intersects[0],
        product: intersects[0] && intersects[0].object._product,
        sphereCross: sphereCross,
        sphereTouch: D > 0,
        matrix: commonGroup && commonGroup.matrix
      };
    }

    function trigger(eventName, e) {
      if (overObject && overObject.trigger && overObject._events[eventName]) { // handler present
        overObject.trigger(eventName, e);
        viewer.flash();
      }
    }

    var projectionMatrixInverse = new THREE.Matrix4;
    function getRaycaster(e) {
      // ray
      // FF fix: used page's [X,Y] with canvas position [0,0]
      var oe = e.originalEvent || e,
        x = (e.offsetX || e.pageX) || (oe.touches && oe.touches[0] && oe.touches[0].pageX) || 0,
        y = (e.offsetY || e.pageY) || (oe.touches && oe.touches[0] && oe.touches[0].pageY) || 0,
        v = new THREE.Vector3(
          (x / canvasW) * 2 - 1,
          -(y / canvasH) * 2 + 1,
          0.5
        );
      //v = projector.unprojectVector(v, camera);
      projectionMatrixInverse.getInverse(camera.projectionMatrix);
      v.applyProjection(projectionMatrixInverse).applyMatrix4(camera.matrixWorld);

      var p = camera.position;
      v.sub(p).normalize();

      return new THREE.Raycaster(p, v);
    }
  }();

  // view mode switcher
  var activeMode, currentFigure;

  viewer.mode = ko.observable();

  !function () {
    var $modeList = $('.mode-list .mode', $dom),
      $activeMode = $modeList.filter('.active');

    activeMode = $activeMode.data('mode');
    viewer.mode(activeMode);


    $(document).on('click', '.mode-list .mode', function (event) {
      var $mode = $(event.target).closest('li');

      if ($mode[0] !== $activeMode[0]) {
        $activeMode.removeClass('active');
        $activeMode = $mode;
        $activeMode.addClass('active');

        activeMode = $activeMode.data('mode');

        viewer.mode(activeMode);
      }
    });

    viewer.mode.subscribe(function (mode) {
      activeMode = viewer.mode();

      if (!activeMode) {
        debugger;
      }
      else {
        $activeMode = $('.mode-list .mode[data-mode]').removeClass('active')
          .filter('[data-mode="' + activeMode + '"]').addClass('active');
      }
      init();
    });

    viewer.flash = _.throttle(function (render) {
      updateCameraPosition();

      if (viewer.needRenderScene) {
        render = true;
        viewer.needRenderScene = false;
      }

      if (render) {
        // render & redraw
        viewer.trigger('render', currentFigure);
      } else {
        // redraw only
        renderer.render(scene, camera);
      }
    }, 16, { leading: true });

    function init() {
      viewer.flash(true);
    }

    // pattern as view mode
    viewer.pattern = (function () {
      var ready = ko.observable(true), // todo: ready is state with valid figure separated (by lines)

        pattern = {
          ready: ko.computed(function () {
            return ready() && pattern;
          }, null, { deferEvaluation: true }),

          progress: ko.observable(),

          tentCalcResult: ko.observable(),

          mode: ko.observable('polyhedron') //=)('pattern') //('polyhedron')
        };

      viewer.mode.subscribe(function (mode) {
        if ("tent" === mode) {
          pattern.mode('polyhedron');
        }
      });

      pattern.mode.subscribe(function (mode) {
        if ('pattern' === mode && pattern.lastNetStamp !== form.tentNetStamp()) {
          // rotate model for user can to see as pattern make self-form
          rootScene.children[1].matrix.rotateX(Math.PI / 2);

          // full image size
          viewer.setZoomTarget(15);

          form.tentCalculator.start();
        }

        viewer.flash(true);
      });

      viewer.on('tent-calc-start', function () {
        pattern.tentCalcResult(null);
      });

      viewer.on('tent-calc-success', function (result) {
        pattern.tentCalcResult(result);
      });

      return pattern;
    })();
  }();

  // stat switcher
  !function () {
    var active;

    $('.stat .toggle', $dom).click(function () {
      active = !active;
      $('.stat', $dom).add(this).toggleClass('active', active);
    });
  }();

  // adapt to tree.js
  var canvasW, canvasH,
    camera, scene, light, renderer, commonGroup;

  // const
  var SCALE = 1000;

  // projection helper
  var projector = new THREE.Raycaster();

  function updateCameraPosition() {
    var pos = (ZOOM_RANGE[1] - zoom.current) / ZOOM_RANGE[1], // [0..1]
      R = form.state.radius;

    // todo: zoom by logarithmic scale
    //pos = Math.pow(2, pos * 10) / 1025;

    pos = NEAR + (FAR - NEAR) * pos; // (NEAR..FAR]

    pos = new THREE.Vector3(
      0,
      0, // man's eyes average height =)
      R * pos //form.state.radius * 5
    );
    pos[AXIS] = (figure ? _.min(_.pluck(figure.$points, AXIS)) : 0) * R + // dome base
      1.6; // avg eyes height

    var part = viewer.drivers[activeMode].particle;

    var dist = (pos.length() + (part * 3 - 1) * R) * SCALE;

    camera.far = dist;
    camera.position.copy(pos.multiplyScalar(SCALE));
    camera.updateMatrixWorld();

    // light distance
    light.distance = dist;
  }

  // renderer init
  !function () {
    canvasW = $canvas.innerWidth();
    canvasH = $canvas.innerHeight();
    window.camera = // debug
      camera = new THREE.PerspectiveCamera(30, canvasW / canvasH, 10, 1e+5);

    scene = rootScene = new THREE.Scene();

    window.renderer = // debug
      renderer = new THREE.CanvasRenderer({ canvas: $canvas[0], antialias: true });

    window.light = // debug
      light = new THREE.PointLight(0xffffff, 1.5);
    scene.add(light);
  }();

  // renderer
  viewer.on('render', function (figure) {
    camera.aspect = canvasW / canvasH;
    renderer.setSize(canvasW, canvasH);
    camera.updateProjectionMatrix();

    //console.log(canvasW, canvasH);;

    // set camera distance position
    updateCameraPosition();

    // actualize light position
    light.position.copy(camera.position);

    // update figure, if required
    if (figure) {
      // renew common group object, with saving matrix rotation
      if (commonGroup) {
        var prevMatrix = commonGroup.matrix.clone();
        scene.remove(commonGroup);
      }

      window.commonGroup = // debug
        commonGroup = new THREE.Object3D();
      commonGroup.matrixAutoUpdate = false;

      commonGroup.matrix.copy(prevMatrix || commonGroup.matrix);
      var mel = commonGroup.matrix.elements;
      commonGroup.matrix.multiplyScalar(SCALE * form.state.radius / Math.sqrt(mel[0] * mel[0] + mel[4] * mel[4] + mel[8] * mel[8])); //commonGroup.matrix.getColumnX().length());

      scene.add(commonGroup);

      // ethalon
      var ethalon = (!form.showEthalon || form.showEthalon()) && CONFIG.get('view.wysiwyg.ethalon');

      ethalon = _.isFunction(ethalon) ? ethalon() : ethalon;

      if (ethalon instanceof THREE.Mesh) {
        commonGroup.add(ethalon);
      }
      else if (ethalon && 'height' === form.state.partialMode) (function () {
        const
          geometry = new THREE.CubeGeometry(
            0.5 / form.state.radius,
            1.8 / form.state.radius,
            0.3 / form.state.radius
          ),
          material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
          cube = new THREE.Mesh(geometry, material),
          baseY = (1 - 2 * form.state.partialHeight);

        cube.position.set(0, baseY + geometry.height / 2, 0);
        material.opacity = .4;

        commonGroup.add(cube);
      })();

      // refill common group
      _.each(figure.$primitives, function (f) {
        var showRemoved = viewer.drivers[activeMode].showRemoved;

        if (!showRemoved && f.removed) return;

        var color = (productPalette[f.type][f.order] || productPalette[f.type][98]).integer;

        var object = viewer.drivers[activeMode].present(f, color);
        var objects = _.compact(_.isArray(object) ? object : [object]);

        _.each(objects, function (object) {
          if (object.geometry) {
            // vertices relatively center
            averageVertex3(object.position, object.geometry.vertices);
            _.each(object.geometry.vertices, function (v) {
              v.sub(object.position);
            });
          }

          // back link
          object.sourceFigure = f;

          commonGroup.add(object);
        });
      });

      // sort if needed
      //if (_.has(commonGroup.children[0], 'sortOrder')) {
      //	commonGroup.children = _.sortBy(commonGroup.children, 'sortOrder');
      //}

      currentFigure = figure;
    }

    var renderStartAt = new Date;

    // update matrixWorld
    scene.updateMatrixWorld(true);

    camera.lookAt(scene.position);
    renderer.render(scene, camera);

    lastRenderAt = new Date - renderStartAt;
    if (figure) {
      console.log('render at', lastRenderAt, 'ms');
    }
  });

  return viewer;

  function averageVertex3(target, vertices) {
    target.x =
      target.y =
      target.z = 0;
    _.reduce(vertices, function (center, v) {
      return center.add(v);
    }, target)
      .multiplyScalar(1 / vertices.length);
  }
})();
