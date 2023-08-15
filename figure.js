/**
 * Figure is an object with properties:
 *   .$points  $([points])
 *   .type     string
 *
 * Vertex, Line, Face and Polygon definition.
 * 
 * @author   popitch@yandex.ru
 */

Figure.DEBUG = false && (location.protocol === 'file:');
Figure.__enum = 0;

function Figure(params) {
  // self as origin
  this.origin = this;

  // origin may be updated here
  $.extend(this, params);

  // базовые точки
  this.$points = $(params.$points || params.points ||
    console.log('Figure(): points not present'));
  this.$points.length > 0 ||
    console.log('Figure(): wrong count of points');

  if (Figure.DEBUG && this.type && this.$points.length < { vertex: 1, line: 2, face: 3 }[this.type]) {
    console.warn(this.type, 'with', this, 'points');
    debugger;
  }

  // тип
  this.type = this.type ||
    (this.$points.length < 4 ?
      [null, 'vertex', 'line', 'face'][this.$points.length] : 'polygon');

  this.removed = false;

  this._enum = Figure.__enum++;

  this.CuttingLine = _.memoize(this.CuttingLine);
}

Figure.prototype = {
  // поворот точек фигуры вокруг оси
  rotate: function (angle, axis) {
    this.$points.each(function () {
      var v = Vector.rotate(this, angle, axis);
      this.x = v.x;
      this.y = v.y;
      this.z = v.z;
    });
    return this;
  },

  // возвращает массив примитивов
  primitives: function () {
    return $([this]);
  },

  // testing relationship
  testRelationship: function () {
    const figure = this;

    // members
    _.each(figure.$primitives, member => {
      // super
      _.each(member.$super, ($supers, supersType) => {
        _.each($supers, supr => {
          _.contains(supr.$sub[member.type], member)
            || console.error(member, '-> super', supersType, supr, 'has no sub rel');
        });
      });

      // sub
      _.each(member.$sub, ($subs, subsType) => {
        _.each($subs, sub => {
          _.contains(sub.$super[member.type], member)
            || console.error(member, '-> sub', subsType, sub, 'has no super rel');
        });
      });

      // test vertex count
      const minPoints = { vertex: 1, line: 2, face: 3 }[member.type];

      member.$points.length >= minPoints
        || console.error(member.$points.length, 'point by', member.type);

      member.type === 'vertex' || member.$sub.vertex.length === member.$points.length
        || console.error('sub vertex', member.$sub.vertex.length, '!==', member.$points.length, 'points');

      member.type !== 'face' || member.$sub.vertex.length === member.$sub.line.length
        || console.error('sub vertex', member.$sub.vertex.length, '!==', member.$sub.line.length, 'sub lines');

      member.type === 'face' || member.$super.face.length > 0
        || console.error(member.type, 'has no super face');

      member.type !== 'vertex' || member.$super.line.length >= 2
        || console.error(member.type, '< 2 super line');
    });

    figure.subs('vertex').length === figure.$points.length
      || console.error('figure points and vertices count must be equals');

    _.unique(_.pluck(figure.$points, '_enum')).length === figure.$points.length
      || console.error('figure points _enum must be unique',
        _.chain(figure.$points).groupBy('_enum').values().filter(a => a.length > 1).flatten().groupBy('_enum').value()
      );

    // Euler
    /*
    const Euler = _.countBy(figure.$primitives, 'type');
  	
    if (Euler.face + Euler.vertex - Euler.line !== 2) {
      console.warn('Euler test failed with', Euler);
    }
    */
  },

  // @safe (with control relationships)
  // removing primitive
  safeRemoveMember: function (member, removeSuper, debug) {
    const figure = this;

    // super
    _.each(member.$super, ($supers, supersType) => {
      _.each($supers, supr => {
        if (false !== removeSuper) {
          figure.safeRemoveMember(supr, removeSuper, false);
        } else {
          // clean sub only
          supr.$sub = _.mapObject(supr.$sub, $subs => {
            return $subs.not([member]);
          });
        }
      });
    });

    // sub
    _.each(member.$sub, ($subs, subsType) => {
      const removingSubs = [];

      _.each($subs, sub => {
        const subSuperByMemberType = sub.$super[member.type]
          = sub.$super[member.type].not([member]);

        if (0 === subSuperByMemberType.length) {
          removingSubs.push(sub);
        }
      });

      _.each(removingSubs, sub => {
        figure.safeRemoveMember(sub, false, false);
      });
    });

    // point
    if (member.type === 'vertex') {
      figure.$points = figure.$points.not(member.$points);
    }

    Figure.DEBUG && false !== debug
      && console.warn('* safe remove', member.type, 'with', JSON.stringify(
        _.chain({ "super": member.$super, "sub": member.$sub })
          .mapObject(collect => {
            return _.mapObject(collect, 'length');
          })
      ));

    this.$primitives = this.$primitives.not([member]);

    Figure.DEBUG && false !== debug
      && this.testRelationship();
  },

  // @safe (with control relationships)
  // replace line and both line's super faces with new face
  safeRemoveFaceLine: function (line) {
    var linePoints = line.$points.get(),
      lineFaces = line.$super.face.get(),
      newFacePoints;

    if (!_.contains(this.$primitives, line)) {
      console.error('line is outbound of figure right now');
    }

    _.each(lineFaces, (face, faceIndex) => {
      let facePoints = face.$points.get(),
        anyLinePointIndex = _.findIndex(facePoints, _.contains.bind(_, linePoints));

      // roll to any line point placing in begin
      facePoints = facePoints.slice(anyLinePointIndex)
        .concat(facePoints.slice(0, anyLinePointIndex));

      let isLastPointFromLine = !_.contains(linePoints, facePoints[1]);

      if (faceIndex === 0) {
        newFacePoints = isLastPointFromLine ? facePoints
          : facePoints.slice(1).concat(facePoints.slice(0, 1));
      }
      else {
        newFacePoints = newFacePoints.concat(
          isLastPointFromLine ? facePoints.slice(1, -1) : facePoints.slice(2)
        );
      }
    });

    if (newFacePoints.length !== _.unique(newFacePoints).length) {
      console.error('not unique face points');
    }

    // new face
    const newFace = new Figure({
      type: 'face',
      points: newFacePoints,
      $super: {},
      $sub: {
        line: $(
          _.chain(lineFaces)
            .map(face => face.$sub.line.get())
            .flatten()
            .difference([line])
            .value()
        ),
        vertex: $(
          _.chain(lineFaces)
            .map(face => face.$sub.vertex.get())
            .flatten()
            .unique()
            .sortBy(function (vertex) {
              return _.indexOf(newFacePoints, vertex.$points[0]);
            })
            .value()
        ),
      },
      live: _.any(lineFaces, 'live')
    });

    // set convex protos
    newFace.protoConvexFaces = newFace.isFaceConvex() ? [newFace] :
      lineFaces.flatMap(face => face.protoConvexFaces || [face]);

    // test assertions
    if (newFacePoints.length !== newFace.$sub.vertex.length) {
      console.error('vertices and points has different size');
    }
    if (newFacePoints.length !== newFace.$sub.line.length) {
      console.error('lines and points has different size');
    }

    // add new face
    this.$primitives.push(newFace);

    // add back rels to newFace
    _.chain(newFace.$sub).invoke('get').flatten().each(sub => {
      sub.$super.face.push(newFace);
    });

    // safe remove line
    this.safeRemoveMember(line);

    Figure.DEBUG && this.testRelationship();
  },

  // is polygon convex?
  isFaceConvex: function () {
    const face = this,
      points = face.$points.get();

    face.type === 'face' || console.error('isFaceConvex(<not face>)');

    var prevPoint = _.last(points);
    const normals =
      _.map(points, (point, index) => {
        const nextPoint = points[index + 1] || points[0],
          prevSide = Vector.subtract(point, prevPoint),
          side = Vector.subtract(nextPoint, point);

        prevPoint = point;

        return Vector.crossProduct(prevSide, side);
      })
        .filter(normal => normal.length() > 1e-9);

    // all normals look in the same direction
    const isConvex = _.every(_.tail(normals), normal => Vector.dotProduct(normal, normals[0]) > -1e-9);

    //console.log(isConvex);

    return isConvex;
  },

  // @safe (with control relationships)
  // @return error string | sew line Figure
  // removing not needed middle point (vertex) of line
  safeRemoveLineMiddleVertex: function (vertex) {
    const vertexLines = vertex.$super.line,
      vertexSuperFaces = vertex.$super.face;

    if (vertexLines.length !== 2) {
      return 'expected 2 super lines, found ' + vertexLines.length;
    }

    const vertexPoint = vertex.$points[0];

    // test point is middle of two others
    var otherPoints = [],
      dirs = _.map(vertexLines, line => {
        var otherPoint = line.$points[line.$points[0] === vertexPoint ? 1 : 0];
        otherPoints.push(otherPoint);
        return Vector.subtract(otherPoint, vertexPoint);
      }),
      angle = dirs[1].angleWith(dirs[0]);

    // point's middle-position detector
    if (Math.abs(angle - Math.PI) < 1e-5) {
      // remove vertex (and both super lines)
      figure.safeRemoveMember(vertex, false, false); // no debug
      figure.safeRemoveMember(vertexLines[0], false, false);
      figure.safeRemoveMember(vertexLines[1], false, false);

      // add new line
      const sewLine = new Figure({
        type: 'line',
        points: otherPoints,
        $super: {
          face: $(vertexSuperFaces)
        },
        $sub: {
          vertex: $(
            _.chain(vertexLines)
              .map(l => l.$sub.vertex.get())
              .flatten()
              .difference([vertex])
              .sortBy(function (vertex) {
                return _.indexOf(otherPoints, vertex.$points[0]);
              })
              .value()
          )
        },
        live: true,
        reversible: true
      });

      // add back rels to sewLine
      _.each(sewLine.$sub.vertex, sub => {
        sub.$super.line.push(sewLine);
      });
      _.each(sewLine.$super.face, supr => {
        supr.$sub.line.push(sewLine);
        supr.$points = supr.$points.not([vertexPoint]);
      });

      figure.$primitives.push(sewLine);

      Figure.DEBUG
        && this.testRelationship();

      return sewLine; // good
    }
    else {
      return "can't to sew this vertex lines";
    }
  },

  /**
   * Устанавливает отношения (вложенность) примитивов фигуры
   * @return this
   */
  relations: function () {
    var $primitives = this.$primitives;

    // sub & super
    _.each($primitives, prim => {
      const a = prim.$points;

      prim.$sub = { vertex: $([]), line: $([]) };

      prim.$subsets = $primitives.map(function (pi) {
        const b = this.$points;

        if (b.length < a.length) {
          for (var i = 0, length = b.length; i < length; i++)
            if (-1 == $.inArray(b[i], a)) {
              return null;
            }

          if (!prim.$sub[this.type]) {
            console.warn('!prim.$sub[this.type]');
            return;
          }

          prim.$sub[this.type].push(this);
          return this;
        }

        return null;
      });

      prim.$supersets = $([]);
      prim.$super = { line: $([]), face: $([]) };
    });

    _.each($primitives, prim => {
      prim.$subsets.each(function () {
        this.$supersets.push(prim);
        this.$super[prim.type].push(prim);
      });
    });

    // figure subsets, supersets of root
    this.$subsets = $primitives;
    this.$supersets = null;

    // set face vertices to point's order
    this.subs('face').each(function () {
      var face = this;

      face.$sub.vertex = $(
        _.sortBy(face.$sub.vertex, function (vertex) {
          return _.indexOf(face.$points, vertex.$points[0]);
        })
      );
    });

    // selvage detection
    this.detectSelvage(); // why here?

    return this;
  },

  // selvage detection
  detectSelvage: function (advAttr) {
    this.$primitives.each(function () {
      this.selvage = false;
    });

    this.$primitives.each(function () {
      if (this.type == 'line' && this.origin === this)
        this.selvage = (1 === this.origin.$super.face.length);

      if (this.selvage) {
        this.$subsets.each(function () {
          this.selvage = true;

          if (advAttr) {
            this[advAttr] = true;
          }
        });

        if (advAttr) {
          this[advAttr] = true;
        }
      }
    });

    return this;
  },

  /**
   * Деление фейсов фигуры (равные хорды)
   * @return this
   */
  splitFaces: function (N) {
    N = N || 2;
    var figure = this;

    var points = {};
    figure.$points.each(function (i) {
      points[this._enum = this._enum || i] = this;
    });
    var $faces = $([]);
    function addFace(a, b, c) {
      $faces.push(new Figure({
        type: 'face',
        $points: $([a, b, c]).map(function () { return points[this] })
      }));
      addLine(a, b);
      addLine(b, c);
      addLine(c, a);
    }
    var lines = {};
    function addLine(a, b) {
      var uniq = [a, b].sort().join('-');
      lines[uniq] = lines[uniq] || new Figure({
        type: 'line',
        $points: $([a, b]).map(function () { return points[this] })
      });
    }

    var verts = {}, $splitted = $([]);
    figure.$primitives.each(function (i) {
      if (this.type == 'face') {
        var face = this;
        var f = _.pluck(face.$points, '_enum');
        var mini = f.slice(0).sort(function (a, b) { return a - b })[0];
        while (f[0] != mini) f.push(f.shift());
        var ai = f[0], bi = f[1], ci = f[2];
        var up = [ai];
        for (var n = 1; n <= N; n++) {
          var lu = [ai, bi, n].join('-'),
            li = verts[lu] || (verts[lu] =
              figure.splitFaces_middlePointEnum(ai, bi, n / N, points));
          var ru = [ai, ci, n].join('-'),
            ri = verts[ru] || (verts[ru] =
              figure.splitFaces_middlePointEnum(ai, ci, n / N, points));
          var down = [], i;
          for (i = 0; i <= n; i++) {
            var mu = (li < ri) ? '' + li + '-' + ri + '-' + i : '' + ri + '-' + li + '-' + (n - i);
            var mi = verts[mu] ? verts[mu] : (verts[mu] =
              figure.splitFaces_middlePointEnum(li, ri, i / n, points));
            down.push(mi);
          }
          addFace(up[0], down[0], down[1]);
          for (i = 1; i < up.length; i++) {
            addFace(up[i], up[i - 1], down[i]);
            addFace(up[i], down[i], down[i + 1]);
          }
          up = down;
        }
        $splitted.push(face);
      }
    });

    // заливаем новую форму
    figure.$primitives = $faces;
    figure.$points.each(function () {
      figure.$primitives.push(new Figure({
        type: 'vertex',
        points: [this],
        center: this.center
      }));
    });
    for (var i in lines) {
      figure.$primitives.push(lines[i]);
    }

    // добавляем преобразование к названию фигуры
    this.type += '.' + 'v(' + N + ')';

    return this;
  },

  splitFaces_middlePointEnum: function (ai, bi, q, enum2point) {
    if (q == 0) return ai;
    if (q == 1) return bi;
    var a = enum2point[ai], b = enum2point[bi];
    // определение центра кривизны
    var center, selvage = a.center && (center = b.center);
    center = selvage ? center : new Vector();
    /*selvage || (center.radius = 1);*/
    var point = Vector.add(
      Vector.subtract(a, center).scale(1 - q),
      Vector.subtract(b, center).scale(q)
    ).normalize()./*scale(center.radius).*/add(center);
    selvage && (point.center = center);
    point._enum = this.$points.length;
    this.$points.push(point);
    enum2point[point._enum] = point;
    return point._enum;
  },

  /**
   * срез фигуры по координате
   * @return this
   */
  sliceByAxis: function (axis, partial, filtrate) {
    if (partial == '1' || partial == '1/1') {
      _.each(this.$primitives, function (p) {
        p.live = true;
      });
      return this;
    }

    var threshold = 1 - 2 * eval(partial);

    this.$points.each(function () {
      this._remain = 0;
    });

    this.$primitives.each(function () {
      var $pp = this.$points, centroid = 0;

      if ($pp.length >= 3) {
        $.map($pp, function (p) {
          centroid += p[axis];
        });
        centroid /= $pp.length;
        if (Math.abs(centroid - threshold) > 1e-6 && centroid > threshold) {
          $.map($pp, function (p) {
            p._remain = 1;
          });
        }
      }
    });

    this.$primitives = this.$primitives.map(function () {
      var saved = 0;
      this.$points.each(function () {
        saved += this._remain || 0;
      });
      this.live = (saved == this.$points.length);
      return (filtrate === false) || this.live ? this : null;
    });

    this.$points = this.$points.map(function () {
      var live = (filtrate === false) || this._remain;
      delete this._remain;
      return live ? this : null
    });
    this.points = this.$points.get();

    return this;
  },

  /**
   * срез фигуры по остающейся доле фейсов в результате
   */
  sliceByFraction: function (startVertex, fraction, filtrate) {
    if (fraction == '1' || fraction == '1/1') {
      _.each(this.$primitives, function (p) {
        p.live = true;
      });
      return this;
    }

    fraction = eval(fraction);

    var $all = this.$primitives;
    var facesTotal = this.subs('face').length;
    var $wave = startVertex.$super.face;

    for (var faces = 0; faces / facesTotal < fraction;) {
      $wave.each(function () {
        $(this).add(this.$sub.line).add(this.$sub.vertex).each(function () {
          this.live = true;
        });
        this.$sub.line.each(function () {
          this.$super.face.each(function () {
            this._ready = true;
          });
          this.$points.each(function () {
            this.live = true;
          });
        });
        faces++;
      });
      $wave = $all.filter(function () {
        return this._ready && !this.live;
      });
    }

    // live if live origin
    $all.each(function () {
      this.live = this.origin.live;
      delete this._ready;
    });

    if (filtrate !== false) {
      this.$primitives = $all.filter(function () {
        return this.live;
      });

      this.$points = this.$points.filter(function () {
        var leave = this.live;
        delete this.live;
        return leave;
      });
      this.points = this.$points.get();
    }

    return this;
  },

  /**
   * Making a (inscribed) fulleren
   */
  fulleren: function () {
    var pointsBeforeLength = this.$points.length;
    var fig = this,
      newVertexByLine = {},
      fullerPrimitives = [],
      nil = Vector(0);

    function divideLine(near, far, line) {/*
			var vertex;

			if (!near.H) {
				near.H = _.reduce(near.$super.line, function(H, line) {
					var l = Vector.distance(line.$points[0], line.$points[1]);
					line.H = l * l / 2;
					return H + line.H;
				}, 0);
				near.H = near.H / near.$super.line.length; *//*Math.pow(near.H, 1 / near.$super.line.length);*//*
			}
			var q = near.H / line.H / 3; // 1/3;

			var mid = near.$points[0].clone().scale(1 - q).add(far.$points[0].clone().scale(q));
			//mid.scale(1 / mid.length()).add(line.center);*/
      var Near = near, vertex;
      near = near.$points[0].clone().subtract(near.center);
      far = far.$points[0].clone().subtract(far.center);

      //var alfa = near.angleWith(far);
      var q = 1 / 3;//0.5 - Math.tan(alfa / 6) * ( 0.5 / Math.tan(alfa / 2) );
      var mid = Vector.add(near.scale(1 - q), far.scale(q));
      mid.scale(1 / mid.length()).add(line.center);

      mid.center = line.center;
      mid.selvage = line.selvage;
      mid.sliced = line.sliced;

      // вершины рождаются здесь
      mid._enum = fig.$points.length - pointsBeforeLength;
      fig.$points.push(mid);
      fullerPrimitives.push(vertex = new Figure({
        type: 'vertex',
        points: [mid],
        center: near.center || nil,
        selvage: near.selvage,
        sliced: near.sliced
      }));
      return vertex;
    }

    // вершины образуются из ребер, по две на каждое
    fig.$primitives.each(function () {
      if (this.type === 'line') {
        var le = this._enum, vv = this.$sub.vertex;
        var vA = divideLine(vv[0], vv[1], this);
        var vB = divideLine(vv[1], vv[0], this);
        newVertexByLine[le] = [vA, vB];

        // ребра-остатки (середина базовых), половина всех ребер
        fullerPrimitives.push(new Figure({
          type: 'line',
          points: [vA.$points[0], vB.$points[0]],
          center: this.center,
          selvage: this.selvage,
          sliced: this.sliced/*,
					baseLineLength: Math.round(Vector.distance(vv[0].$points[0], vv[1].$points[0]) * 1e-6)*/
        }));
      }
    });

    // ищет в фейсе новые вершины, образованные от заданных, возвращает в том же порядке
    function getNewPoints(p0, p1, face) {
      var ret;
      face.$sub.line.each(function () {
        var vv = this.$sub.vertex;
        var nvv = newVertexByLine[this._enum];
        ret = ret ||
          (vv[0].$points[0] == p0 && vv[1].$points[0] == p1 && nvv) ||
          (vv[0].$points[0] == p1 && vv[1].$points[0] == p0 && [nvv[1], nvv[0]]);
      });
      return [ret[0].$points[0], ret[1].$points[0]];
    }

    // для вершинных фейсов
    var newVertexesByVertex = {};

    // грани и половина ребер
    fig.$primitives.each(function () {
      if (this.type == 'face') {
        var face = this;
        var p0 = face.$points[1], p1 = face.$points[2];
        var v6 = [];
        face.$points.each(function () {
          var p2 = this;
          /*var baseLine = face.$sub.line.filter(function() {
              return (this.$points[0] === p0 && this.$points[1] === p2) ||
                (this.$points[1] === p0 && this.$points[0] === p2);
            })[ 0 ];*/

          // точки нового фейса-остатка
          var nvv01 = getNewPoints(p0, p1, face);
          v6.push(nvv01[0]);
          v6.push(nvv01[1]);

          // ребра-скосы (образованные срезанием вершины), половина всех ребер
          var nvv12 = getNewPoints(p1, p2, face);
          fullerPrimitives.push(new Figure({
            type: 'line',
            points: [nvv01[1], nvv12[0]]/*,
						baseLineLength: Math.round(Vector.distance(baseLine.$points[0], baseLine.$points[1]) * 1e+6)*/
          }));

          // для вершинных фейсов
          newVertexesByVertex[p1._enum] = newVertexesByVertex[p1._enum] || {};
          newVertexesByVertex[p1._enum][p2._enum] = {
            point: nvv12[0],
            next: p0._enum
          };

          p0 = p1;
          p1 = p2;
        });

        if (v6.length != 6)
          console.log('v6.length != 6');

        // фейсы-остатки (середина фейсов-предшественников), столько же сколько было фейсов
        fullerPrimitives.push(new Figure({
          type: 'face',
          points: v6
        }));
      }
    });

    // фейсы-скосы (при вершинах, кроме крайних пока)
    fig.$primitives.each(function () {
      if (this.type == 'vertex' && !this.selvage) {
        var aster = newVertexesByVertex[this.$points[0]._enum],
          c = 0;
        for (var i in aster) c++;
        if (c >= 5) {
          var last = i, pp = [];
          do {
            pp.push(aster[i].point);
            i = aster[i].next;
          } while (i != last);

          if (pp.length < 5)
            console.log('face points.length < 5');

          // фейсы-скосы (при вершинах), столько же сколько было вершин
          fullerPrimitives.push(new Figure({
            type: 'face',
            points: pp
          }));
        }
      }
    });

    this.$primitives = $(fullerPrimitives);
    this.$points = $([].slice.call(this.$points, pointsBeforeLength));

    /*Figure.equalizeLineGroups(
      _.groupBy(_.where(this.$primitives, { type: 'line' }), 'baseLineLength')
    );*/

    return this;
  },

  /**
   * @required prepareUnify() before
   */
  outerFulleren: function () {
    var prevVertexes = this.subs('vertex'),
      prevFaces = this.subs('face'),
      nextLines = {},
      center = new Vector; // todo: remove center from project

    const nextVertexes = _.map(prevFaces, function (face, faceIndex) {
      face.newPoint = Solutions.planesCross.apply(this,
        _.map(face.$points, function (point) {
          return new Plane(point, point);
        })
      );
      var nextVertex = new Figure({
        type: 'vertex',
        points: [face.newPoint],
        center: center
      });

      face.newPoint._enum = faceIndex; // faceIndex === future point index    //nextVertex._enum;

      return nextVertex;
    });

    var nextFaces = _.map(prevVertexes, function (vertex) {
      var points = _.compact(_.map(vertex.$scheme, function (mem) {
        return mem.isFace && mem.source.newPoint;
      }));

      var prevPoint = _.last(points);
      _.each(points, function (point) {
        var lineIndex = [point._enum, prevPoint._enum].sort().join();
        nextLines[lineIndex] = nextLines[lineIndex] ||
          new Figure({
            type: 'line',
            points: [prevPoint, point]
          });
        prevPoint = point;
      });

      return new Figure({
        type: 'face',
        points: points,
        //_protoPoint: vertex.$points[0]
      });
    });

    this.$primitives = $(nextFaces.concat(_.values(nextLines)).concat(nextVertexes));
    this.$points = $(_.pluck(_.pluck(nextVertexes, '$points'), '0'));

    return this;
  },

  // adv relations
  prepareUnify: function () {
    // order line/face/line/face/.. around vertex
    this.subs('vertex').each(function () {
      var vertex = this;
      var point = vertex.$points[0];
      var chain = [];

      // список звеньев цепочки, с указанием остальных составляющих звено точек
      vertex.$supersets.each(function (i) {
        var pp = this.$points.get();
        var pos = $.inArray(point, pp);
        var others = pp.slice(pos + 1).concat(pp.slice(0, pos));
        var isFace = (others.length > 1);
        chain[i] = {
          i: i,
          source: this,
          others: others,
          isFace: isFace
        };
        if (isFace)
          chain[i].faceAngle = Vector.angle(others[0], point, others[others.length - 1]);
        else {// line
          chain[i].length = point.distance(others[0]);
          if (chain[i].length < 1e-6)
            console.log('rib length is nil');
        }
      });
      var iLost = undefined, countNext = 0, countLost = 0;

      // каждому звену прописывается индекс следующего
      vertex.$supersets.each(function (i) {
        var iOthers = chain[i].others;
        var iFace = iOthers.length > 1;

        var found = vertex.$supersets.map(function (j) {
          var jOthers = chain[j].others;
          return (jOthers.length > 1 ^ iOthers.length > 1) ? (
            iOthers[iOthers.length - 1] === jOthers[0] ? ++countNext && j : null
          ) : null;
        });

        if (found.length > 1)
          console.log('gt one next chain nodes this');

        var h = found[0];
        if (h !== undefined) {
          chain[i]._next = h;
        } else {
          iLost = i;
          ++countLost;
        }
      });

      // asserts
      if (countNext > vertex.$supersets.length)
        console.log(countNext + ' countNext > vertex.$supersets.length');
      if ((countNext == vertex.$supersets.length) == vertex.selvage)
        console.log('(countNext == vertex.$supersets.length) == vertex.selvage');
      if ((countNext == vertex.$supersets.length - 1) != vertex.selvage)
        console.log('(countNext == vertex.$supersets.length - 1) != vertex.selvage');
      if (countNext < vertex.$supersets.length - 1)
        console.log('countNext < vertex.$supersets.length - 1');

      if (countLost > 1)
        console.log({ countLost: countLost, countNext: countNext, chain: chain });
      (iLost !== undefined) === vertex.selvage ||
        console.log('selvage is not salve: ' + iLost + ', ' + countLost);
      (iLost !== undefined) === (countLost == 1) ||
        console.log('selvage is not salve2: ' + iLost + ', ' + countLost);

      // break the chain
      var sortChains = [];
      $(chain).each(function (i) {
        var start = this, curr = this;
        for (sortChains[i] = [];
          curr && sortChains[i].push(curr) && !_.contains(sortChains[i], curr = chain[curr._next]);
        );
      });
      sortChains.sort(function (a, b) {
        if (b.length - a.length)
          return b.length - a.length;
        for (var i = 0, l = a.length, d; i < l; i++) {
          d = (b[i].faceAngle - a[i].faceAngle) || (b[i].length - a[i].length);
          if (Math.abs(d) > 1e-3)
            return d;
        }
        return 0;
      });

      // сохраняем упорядоченный, выбранный список надмножеств
      vertex.$scheme = $(sortChains[0]);
    });

    // для линий: вершины, дополняющие соседние фейсы
    this.subs('line').each(function () {
      var line = this;
      line.$vertexes = line.$sub.vertex;
      line.$adjoinVertexes = $([]);
      line.$adjoinPoints = $([]);
      line.$super.face.each(function () {
        this.$sub.vertex.each(function () {
          if (-1 == $.inArray(this, line.$vertexes))
            line.$adjoinVertexes.push(this);
          line.$adjoinPoints.push(this.$points[0]);
        });
      });

      // для линий: для каждой вершины список линий соседних к линии-сабжу
      line.$nearLinesByVertex = $([]);
      line.$vertexes.each(function () {
        var vertex = this,
          point = this.$points[0],
          cont = $([]);
        vertex.$super.line.each(function () {
          if (this === line) return;
          if (this.$points[0] === point && -1 != $.inArray(this.$points[1], line.$adjoinPoints))
            cont.push(this);
          if (this.$points[1] === point && -1 != $.inArray(this.$points[0], line.$adjoinPoints))
            cont.push(this);
        });
        line.$nearLinesByVertex.push(cont);
      });

      if (line.$nearLinesByVertex.length != 2)
        console.log('line.$nearLinesByVertex.length != 2');
      else {
        if (-1 == $.inArray(line.$nearLinesByVertex[0].length, [1, 2]))
          console.log('line.$nearLinesByVertex.length[0].length: ' + line.$nearLinesByVertex[0].length);
        if (-1 == $.inArray(line.$nearLinesByVertex[1].length, [1, 2]))
          console.log('line.$nearLinesByVertex.length[1].length: ' + line.$nearLinesByVertex[1].length);
      }
    });

    // фейсам выстроим sub- отрезки и вершины по-порядку
    this.subs('face').each(function () {
      const face = this,
        facePoints = face.$points.get();
      /*
      var $vv = this.$sub.vertex;
      var mid = new Vector;
      $vv.each(function(){ mid.add(this.$points[0]); });
      mid.scale(1 / $vv.length);
    	
      function orderedVertexes(line){
        var $vv = line.$sub.vertex;
        var dir = Vector.crossProduct(
            Vector.subtract($vv[0].$points[0], mid),
            Vector.subtract($vv[1].$points[0], mid)
          );
        return Vector.dotProduct(dir, mid) > 0 ? $vv : $([$vv[1], $vv[0]]);
      }
    	
      var order = {}, i;
      this.$sub.line.each(function(){
        var vv = orderedVertexes(this);
        order[vv[0]._enum] = {
          line: this,
          vv: vv,
          next: i = vv[1]._enum
        };
      });
    	
      var vertexes = [];
      var lines = [];
    	
      try {
        for (var end = i, j = 0;
          order[i] &&
          lines.push(order[i].line) &&
          vertexes.push(order[i].vv[0]) &&
          order[i].next != end;
        i = order[i].next, j++) {
          if (j > 99) {
            throw ['endless order', order];
          }
        }
      	
        if (! order[i]) {
          throw ['breaked with no order[by i]', i, 'order', order];
        }
      	
        face.$sub.line = $(lines);
        face.$sub.vertex = $(vertexes);
      } catch(e) {
        console.warn.apply(console,
          this._hasUnifyError = _.flatten(['prepareUnify()', e, 'face', face._enum, face])
        );
      */

      // then... order by face points
      face.$sub.vertex = $(
        _.sortBy(face.$sub.vertex.get(), vertex => facePoints.indexOf(vertex.$points[0]))
      );
      face.$sub.line = $(
        _.sortBy(face.$sub.line.get(), line => {
          const pointIndex = line.$points.get().map(point => facePoints.indexOf(point)).sort();

          if (pointIndex[0] === 0 && pointIndex[1] === facePoints.length - 1) {
            return pointIndex[1];
          }
          else if (pointIndex[0] + 1 === pointIndex[1]) {
            return pointIndex[0];
          }
          else {
            //throw ['wrong points order with line', line, 'by face', face];
            console.error('wrong points order with line', line, 'by face', face);
          }
        })
      );
      /*
      console.log(
        'e.g.', face.$sub.line.get().map(line => line.$sub.vertex.get().map(v => v.$points[0]._enum).join())
      );
    /*
    }
    */
    });

    return this;
  },

  // pseudo-self-remove the member
  remove: function () {
    if (this.removed) return [];

    var removed = [this];

    this.removed = true;

    this.$supersets.each(function () {
      removed = removed.concat(this.remove());
    });
    this.$subsets.each(function () {
      var superPresent = this.$supersets.filter(function () {
        return !this.removed;
      });
      if (!superPresent.length)
        removed = removed.concat(this.remove());
    });

    return removed;
  },

  // restore pseudo-removed member
  restore: function () {
    if (!this.removed) return [];

    var restored = [this];

    this.removed = false;

    this.$subsets.each(function () {
      restored = restored.concat(this.restore());
    });

    return restored;
  },

  separate: function () {
    if (this.type !== 'line') {
      console.error('line expected');
    }

    this.separator = true;

    return [this];
  },

  connect: function () {
    if (this.type !== 'line') {
      console.error('line expected');
    }

    this.separator = false;

    return [this];
  },

  subs: function (type) {
    return type ? this.$subsets.filter(function () {
      return this.type === type;
    }) : this.$subsets;
  },

  supers: function (type) {
    return type ? this.$supersets.filter(function () {
      return this.type === type;
    }) : this.$supersets;
  },

  /**
   * Приземление кромки фигуры
   */
  groundSliced: function (axis) {
    var points = $.map(this.$primitives, function (p) {
      if (p.type !== 'vertex' || !p.live)
        return null;

      return _.some(p.$supersets, function (s) { return !s.live }) ? p.$points[0] : null;
    });

    var aval = false;

    // find minimal-absolute value by axis
    _.each(points, function (p) {
      aval = aval && Math.abs(aval) < Math.abs(p[axis]) ? aval : p[axis];
    });

    _.each(points, function (p) {
      if (Math.abs(p[axis] - aval) > 1e-6) {
        p[axis] = aval;
        var len = p.length(), q = Math.sqrt((1 - aval * aval) / (len * len - aval * aval));

        if (axis != 'x') p.x *= q;
        if (axis != 'y') p.y *= q;
        if (axis != 'z') p.z *= q;
      }
    });
  },

  /**
   * Унификация примитивов, поиск одинаковых
   * @return Object stat
   *
   * $todo insert product eacher
   */
  unify: function () {
    var result = { total: {}, count: {} };

    // для некоторых соединений, перед унификацией "крайних" узлов
    // требуется аккумулятор для накопление инфы об остальных узлах
    var accum = {};

    // сначала те, что не на краю,
    // и в порядке: коннекторы, ребра, грани
    var hashOrder = _.where(this.$primitives, { removed: false });

    _.each(['vertex', 'line', 'face'], function (type) {
      var stat = {};

      var ordered =
        $.map(hashOrder, function (f) {
          return f.type == type && f.live ? f : null;
        })
          .sort(function (a, b) {
            if (a.selvage != b.selvage)
              return (a.selvage ? 1 : 0) - (b.selvage ? 1 : 0);
            if (a.type == 'vertex')
              return a.$points[0].y - b.$points[0].y;
            return 0;
          });

      $(ordered).each(function (i) {
        if (!this.unifier) {
          if (this.product) {
            /* mixed connector types mode support, eg. Piped + Cone
             * if main failed => use <product>.alterProduct() instead
             */
            try {
              // try direct unify()
              this.unifier = this.product.unify(accum);
            }
            catch (e) {
              console.log(e);

              if (this.product.alterProduct) {
                this.product = this.product.alterProduct();
                // try one more
                this.unifier = this.product.unify(accum);
              } else {
                this.unifier = '<Uncaught: ' + e + '>';
              }
            }
          }
          else {
            this.unifier = '<Empty product O_o>';
          }
        }

        var unifier = this.unifier.replace(/\(\d+\)/g, '');
        stat[unifier] = stat[unifier] || [];
        stat[unifier].push(this);
      });

      // сортировка коллекции по убыванию кол-ва элементов данного типа
      var keys = [];
      $.each(stat, function (key, cont) {
        keys.push({ key: key, cont: cont });
      });

      // сортировка
      keys.sort(function (a, b) {
        // по убыванию кол-ва элементов данного типа
        if (b.cont.length != a.cont.length)
          return (b.cont.length - a.cont.length);

        // line: compare lengths
        if (type == 'line') {
          var diff = b.cont[0].product.maxLength() - a.cont[0].product.maxLength();
          if (diff) return diff;
        }

        // сравнение строк-унификаторов
        if (a.key !== b.key) {
          return ([a.key, b.key].sort()[0] === a.key) ? 1 : -1;
        }

        console.warn('Undefined sort order detected');
      });

      result[type] = {};
      result.total[type] = 0;
      result.count[type] = 0;
      $.each(keys, function (order) {
        var index = Product.index(this.cont[0].type, order);
        result[type][index] = {
          count: this.cont.length,
          unifier: this.key,
          index: index,
          order: order,
          collect: this.cont
        };
        $(this.cont).each(function () {
          this.index = index;
          this.order = order;
          //this.groups = result[type];
        });
        result.total[type] += this.cont.length;
        result.count[type]++;
      });
    });

    // вычисление максимальной длины ребра
    var maxOuter = 0, minOuter = Infinity, minInner = null;
    $.each(result.line, function (index, stat) {
      var outer = stat.collect[0].product.maxLength();
      var inner = stat.collect[0].product.minLength();
      maxOuter = outer > maxOuter ? outer : maxOuter;
      minOuter = outer < minOuter ? outer : minOuter;
      minInner = inner < minInner || minInner === null ? inner : minInner;
    });
    $.each(result.line, function (index, stat) {
      stat.collect[0].product.maxOuterLength = maxOuter;
      stat.collect[0].product.minOuterLength = minOuter;
      stat.collect[0].product.minInnerLength = minInner;
    });

    return this.stat = result;
  },

  visible: function () {
    if (this.type == 'polygon' || this.type == 'face') {
      var $p = this.$points.map(function () { return this.plane });
      return 0 <
        $p[1].x * $p[2].y - $p[1].y * $p[2].x +
        $p[2].x * $p[0].y - $p[2].y * $p[0].x +
        $p[0].x * $p[1].y - $p[0].y * $p[1].x;
    }
    return true;
  },

  prepareVisibility: function () {
    this.$primitives.each(function () {
      this.isVisible = false;
    });
    this.$primitives.each(function () {
      if (this.type == 'face') {
        if (this.isVisible = this.visible()) {
          this.$subsets.each(function () {
            this.isVisible = true;
          });
        }
      }
    });
  }
}

// делает точки окружности равноудаленными с соседями (точки в начале должны быть в одной плоскости)
Figure.pointsEquidistant = function ($points, center, radius) {
  // приведение точек к окружности
  function circle() {
    $points.each(function () {
      this.subtract(center);
      this.scale(radius / this.length());
      this.add(center);
    });
  }

  // соседи
  var $near = [];
  $points.each(function (i) {
    var point = this, arr, $dist = [];
    $near[i] = (
      (arr = $points.get()
        .sort(function (a, b) {
          return a.distance(point) - b.distance(point);
        }))
        .slice(1, 3)
    );
  });

  // итерируем пока не понравится результат
  function aberration() {
    return $points.map(function (i) {
      return Math.abs($near[i][0].distance(this) - $near[i][1].distance(this));
    }).get().sort(function (a, b) {
      return a - b;
    }).pop();
  }
  do {
    // уводим точки в сторону более удаленного соседа
    var $dirs = $points.map(function (i) {
      return $near[i][0].clone().subtract(this).add($near[i][1]).subtract(this);
    });
    $points.each(function (i) {
      this.add(
        $dirs[i].scale(1 / 5)
      );
    });
    circle();
  } while (aberration() > 1e-15);
}

/**
 * @constructor Container
 */
Figure.Container = function (params) {
  params = params || {};
  var $points = params.points ? $(params.points) : $params.points || $([]);
  var $figures = params.figures ? $(params.figures) : $params.figures || $([]);
  var $primitives = $([]);
  $figures.each(function (i) {
    $primitives = $.merge($primitives, this.primitives());
    //this.source = params.source || console.log('Figure.Container: !source');
  });
  // parent::construct()
  Figure.apply(this, [$.extend({
    type: 'container',
    $points: $points,
    $figures: $figures,
    $primitives: $.unique($primitives)
  }, params)]);
}
  .inherits(Figure);

/**
 * @constructor Octohedron
 */
Figure.Octohedron = function (params) {
  var center = Vector(0);

  // defaults
  params = $.extend(
    {
      symmetry: 'Pentad'
    },
    params || {}
  );

  // вершины
  var points = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1]
  ],
    primitives = [];

  for (var i = 0; i < points.length; i++) {
    points[i] = $.extend(new Vector(points[i][0], points[i][1], points[i][2]), {
      _enum: i,
      pptPoint: true
    });

    // вершина
    primitives.push(new Figure({
      type: 'vertex',
      points: [points[i]],
      center: center
    }));
  }

  // грани & ребра
  var faces = _.invoke([
    [0, 5, 3], [0, 3, 4], [0, 4, 2], [0, 2, 5],
    [1, 3, 5], [1, 4, 3], [1, 2, 4], [1, 5, 2]
  ], 'reverse'), // reverse-fix for common with Icosa vertices order

    snakeTail = { 0: 1, 1: 2, 2: 0 };

  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    // грань
    primitives.push(new Figure({
      type: 'face',
      points: [points[f[0]], points[f[1]], points[f[2]]]
    }));

    for (var m in snakeTail) {
      var n = snakeTail[m];

      if (f[m] < f[n]) {
        // ребро
        primitives.push(new Figure({
          type: 'line',
          points: [points[f[m]], points[f[n]]]
        }));
      }
    }
  }

  // parent::construct()
  Figure.apply(this, [$.extend({
    type: 'Octohedron',
    $points: $(points),
    $primitives: $(primitives)
  }, params)]);

  // orientate figure for given rotational symmetry around given axis
  switch (params.symmetry) {
    case 'Pentad':
      break;

    case 'Cross':
      this.rotate(Math.PI / 4, { y: 'x', z: 'y', x: 'z' }[params.axis]);
      break;

    case 'Triad':
      var beta = new Vector(1, 1, 1).angleWith(new Vector(1, 0, 0));

      this.rotate(Math.PI / 4, 'y');
      this.rotate(- beta, 'x');
      //this.rotate(Math.asin( 2 / ( Math.sqrt(3) + Math.sqrt(15) ) ), {y:'z', z:'x', x:'y'}[params.axis]);
      break;
  }
}
  .inherits(Figure)
  .override({
    primitives: function () {
      return this.$primitives;
    }
  });

/**
 * @constructor Icosahedron
 */
Figure.Icosahedron = function (params) {
  var center = Vector(0);

  // defaults
  params = $.extend(
    {
      symmetry: 'Pentad'
    },
    params || {}
  );

  // золотой ключик
  var a = 4 / Math.sqrt(2 * (5 + Math.sqrt(5))) / 2,
    b = Math.sqrt(1 - a * a),
    primitives = [];

  // вершины
  var points = [
    [-a, 0.0, b], [a, 0.0, b], [-a, 0.0, -b], [a, 0.0, -b],
    [0.0, b, a], [0.0, b, -a], [0.0, -b, a], [0.0, -b, -a],
    [b, a, 0.0], [-b, a, 0.0], [b, -a, 0.0], [-b, -a, 0.0]
  ];

  for (var i = 0; i < points.length; i++) {
    points[i] = $.extend(new Vector(points[i][0], points[i][1], points[i][2]), {
      _enum: i,
      pptPoint: true
    });

    // вершина
    primitives.push(new Figure({
      type: 'vertex',
      points: [points[i]],
      center: center
    }));
  }

  // грани & ребра
  var faces = [
    [0, 4, 1], [0, 9, 4], [9, 5, 4], [4, 5, 8], [4, 8, 1],
    [8, 10, 1], [8, 3, 10], [5, 3, 8], [5, 2, 3], [2, 7, 3],
    [7, 10, 3], [7, 6, 10], [7, 11, 6], [11, 0, 6], [0, 1, 6],
    [6, 1, 10], [9, 0, 11], [9, 11, 2], [9, 2, 5], [7, 2, 11]
  ], snakeTail = { 0: 1, 1: 2, 2: 0 };
  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    // грань
    primitives.push(new Figure({
      type: 'face',
      points: [points[f[0]], points[f[1]], points[f[2]]]
    }));
    for (var m in snakeTail) {
      var n = snakeTail[m];
      if (f[m] < f[n]) {
        // ребро
        primitives.push(new Figure({
          type: 'line',
          points: [points[f[m]], points[f[n]]]
        }));
      }
    }
  }
  // parent::construct()
  Figure.apply(this, [$.extend({
    type: 'Icosahedron',
    $points: $(points),
    $primitives: $(primitives)
  }, params)]);

  // orientate figure for given rotational symmetry around given axis
  switch (params.symmetry) {
    case 'Pentad':
      this.rotate(Math.atan(a / b), { y: 'x', z: 'y', x: 'z' }[params.axis]);
      break;

    case 'Cross':
      break;

    case 'Triad':
      this.rotate(Math.asin(2 / (Math.sqrt(3) + Math.sqrt(15))), { y: 'z', z: 'x', x: 'y' }[params.axis]);
      break;
  }
}
  .inherits(Figure)
  .override({
    primitives: function () {
      return this.$primitives;
    }
  });

/**
 * @constructor https://en.wikipedia.org/wiki/Tetrakis_hexahedron
 */
Figure.TetrakisHexahedron = function (params) {
  Figure.Octohedron.call(this, params);

  this.relations();

  var base = this;
  var points = this.$points;
  primitives = this.subs('vertex');

  _.each(this.subs('face'), function (f) {
    var p = _.reduce(f.$points, Vector.add, new Vector).normalize();
    p._enum = points.length;
    points.push(p);
    primitives.push(new Figure({ points: [p] }));
    f._dodCenter = p;
  });

  _.each(this.subs('face'), function (f) {
    var C = f._dodCenter;
    var lines = f.subs('line');

    var B = f.$points[2];
    _.each(f.$points, function (A) {
      var line = _.filter(lines, function (l) {
        var pair = l.$points;
        return (pair[0] === A && pair[1] === B) || (pair[1] === A && pair[0] === B);
      })[0];
      var anotherFace = _.difference(line.supers('face'), [f])[0];

      addFace([C, anotherFace._dodCenter, A])
      B = A;
    });
  });

  this.$points = $(this.points = points);
  this.$primitives = $(primitives);

  this.type = 'TetrakisHexahedron';

  function addFace(tri) {
    primitives.push(new Figure({ points: tri }));
    for (var i = 0, j = 2; i < 3; j = i++) {
      var A = tri[j], B = tri[i];
      if (A._enum < B._enum) {
        // ребро
        primitives.push(new Figure({ points: [A, B] }));
      }
    }
  }
}
  .inherits(Figure);

/**
 * @constructor https://en.wikipedia.org/wiki/Pentakis_dodecahedron
 */
Figure.PentakisDodecahedron = function (params) {
  Figure.Icosahedron.call(this, params);

  this.relations();

  var base = this;
  var points = this.$points;
  primitives = this.subs('vertex');

  _.each(this.subs('face'), function (f) {
    var p = _.reduce(f.$points, Vector.add, new Vector).normalize();

    p._enum = points.length;
    points.push(p);

    primitives.push(new Figure({ points: [p] }));
    f._dodCenter = p;
  });

  _.each(this.subs('face'), function (f) {
    var C = f._dodCenter;
    var lines = f.subs('line');

    var B = f.$points[2];
    _.each(f.$points, function (A) {
      var line = _.filter(lines, function (l) {
        var pair = l.$points;
        return (pair[0] === A && pair[1] === B) || (pair[1] === A && pair[0] === B);
      })[0];
      var anotherFace = _.difference(line.supers('face'), [f])[0];

      addFace([C, anotherFace._dodCenter, A])
      B = A;
    });
  });

  this.$points = $(this.points = points);
  this.$primitives = $(primitives);

  this.type = 'PentakisDodecahedron';

  function addFace(tri) {
    primitives.push(new Figure({ points: tri }));
    for (var i = 0, j = 2; i < 3; j = i++) {
      var A = tri[j], B = tri[i];
      if (A._enum < B._enum) {
        // ребро
        primitives.push(new Figure({ points: [A, B] }));
      }
    }
  }
}
  .inherits(Figure);
