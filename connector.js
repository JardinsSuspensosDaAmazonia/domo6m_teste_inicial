/**
 * Определение продукта коннекторов
 * 
 * @author   popitch [at yandex.ru]
 */

Product.Connector = function () {
  Product.apply(this, arguments);
  // expected
  this.vertex || console.log('vertex not specified');
  this.point || console.log('point not specified');
}
  .inherits(Product)
  .override({
    // расстояние от вершины коннектора до плоскости ребра (средняя его плоскость)
    ribPlaneOffset: function (line) {
      return console.log('Product.Connector.ribPlaneOffset() abstract called', this) & 0;
    },

    // ребро, в которое упирается заданное ребро
    ribWall: function (line) {
      return null;
    },

    // расстояние от вершины коннектора до плоскости стены (в которую ребро упирается)
    ribWallOffset: function (line) {
      return 0;
    },

    // вектор от текущей точки вдоль line
    toOtherTail: function (line) {
      var OTHER = (line.$points[0] != this.point) ? (line.$points[1] != this.point) ?
        console.log('Product.Connector.toOtherTail: wrong line') : 0 : 1;
      return line.$points[OTHER].clone().subtract(this.point);
    },

    otherVertex: function (line) {
      var vertex = this.vertex;
      return line.$vertexes.map(function () {
        return this !== vertex ? this : null;
      })[0];
    },

    // вектор к центру от тукущей точки
    toCenter: function () {
      return this.point.center ?
        Vector.subtract(this.point.center, this.point) :
        (new Vector).subtract(this.point);
    },

    // угол к радиусу в тукущей точке
    angleByRaduis: function (line) {
      return this.toOtherTail(line).angleWith(this.toCenter());
    },

    // коллекция ребер данного фейса
    linesByFace: function (face) {
      var point = this.vertex.$points[0];
      return face.$sub.line.map(function () {
        return this.$points[0] === point || this.$points[1] === point ? this : null;
      });
    },

    afterTailsGiven: function (tail, i, line) {
      return tail;
    },

    unify: function () {
      var product = this;

      // подготовка схемы
      this.vertex.$scheme.each(function () {
        if (this.isFace) {
          /**
           * @todo брать не угол реал-фейса, а угол к остальным вершинам
           */
          var reals = this.source.product.realPoints().get();
          var i = this.source.$sub.vertex.index(product.vertex);
          this.faceAngle = Vector.angle(reals[(i - 1 + reals.length) % reals.length], reals[i], reals[(i + 1) % reals.length]);
        } else {
          this.radiusAngle = product.angleByRaduis(this.source);
        }
      });

      // прокрутим цепочку и выберем единственный вариант
      if (!this.vertex.selvage) {
        var chain = this.vertex.$scheme.get();
        var sortChains = [];
        $(chain).each(function (i) {
          sortChains.push(chain.slice(i).concat(chain.slice(0, i)));
        });
        sortChains.sort(function (a, b) {
          for (var i = 0, l = a.length, d; i < l; i++) {
            d = (b[i].faceAngle || b[i].radiusAngle) - (a[i].faceAngle || a[i].radiusAngle);
            if (-1e-6 > d || d > 1e-6)
              return d;
          }
          return 0;
        });
        this.vertex.$scheme = $(sortChains[0]);
      }

      // цепочка уголов ребра_к_радиусу - треугольника ...
      // префикс "ground " означает что это край
      return (this.vertex.selvage ? 'Ground ' : '') +
        this.vertex.$scheme.map(function () {
          return this.isFace ?
            'F' + Product.angleUnify(this.faceAngle) :
            'R' + Product.angleUnify(this.radiusAngle);
        }).get().join(' ');
    },

    meter: function () {
      var p = this.vertex.$points[0];
      var meter = {};

      if ('height' === form.state.partialMode) {
        const height = 2 * form.state.partialHeight;

        meter['max:' + __('Height from base, m')] = height * this.R;

        try {
          var radius = Math.sin(Math.acos(1 - height)) * this.R;

          meter['range:' + __('Base radius, m')] = radius;

          meter['max:' + __('Base circle area, m2')] = radius * radius * Math.PI;
        } catch (e) { };
      }
      else {
        meter['swing:' + __('Height from base, m')] = p.y * this.R;

        if (this.vertex.selvage)
          meter['range:' + __('Base radius, m')] = Math.sqrt(p.x * p.x + p.z * p.z) * this.R;
      }

      return meter;
    }
  });

/**
 * Joint connector https://popitch1.livejournal.com/1840.html
 */
Product.Connector.Joint = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'Joint',
    vertex: vertex,
    point: vertex.$points[0],
    whirlAsClock: '1'
  }, params || {})]);
}
  .inherits(Product.Connector)
  .override({
    ribPlaneOffset: function (line) {
      if (line.sliced || this.vertex.sliced)
        return 0;
      return (this.whirlAsClock != 0 ? 1 : -1) * line.product.thickness / 2; // @todo any product
    },

    // ребро, в которое упирается заданное ребро
    ribWall: function (line) {
      var vertexIndex = $.inArray(this.vertex, line.$vertexes);

      vertexIndex >= 0 ||
        console.log('its not my line', this);

      var $nearLines = line.$nearLinesByVertex[vertexIndex];
      var nearSlicedLines = $nearLines.filter(function () { return this.sliced });
      return nearSlicedLines[0];
    },

    // оконцовщик хвоста ребра
    getTail: function (line) {
      var vertex = this.vertex,
        point = vertex.$points[0],
        plane = line.product.getPlane(), // @todo
        outer;

      var vertexIter = (line.origin.$vertexes[0] == vertex) ? 0 : 1;

      // todo: copypasted from Rib.getTails() by refactor getTail mechanism

      var anotherPoint = line.origin.$sub.vertex.filter(function () { return this !== vertex })[0].$points[0];
      var center = line.origin.center || vertex.center || Vector(0);

      var result = plane.result(point);
      if (Math.abs(result) > 1e-6) {
        // базовая плоскость смещена (Joint + GoodKarma, Semicone)
        var $nearLines = line.origin.$nearLinesByVertex[vertexIter];
        var wall;
        $nearLines.each(function () {
          var otherVertex = this.$sub.vertex.filter(function () { return this !== vertex })[0];
          var otherPoint = otherVertex.$points[0];
          var otherResult = plane.result(otherPoint);
          if (otherResult * result < 0) {
            wall && console.log('too many walls for one tail');
            // по другую сторону от плоскости ребра, значит сюда уперлись
            wall = {
              plane: this.product.getPlane().clone(),
              line: this
            };
            // ориентируем плоскость стены относительно незадействованной здесь вершины лайна
            if (wall.plane.result(anotherPoint) < 0)
              wall.plane.revert();
          }
        });

        if (!wall)
          console.log(['Product.Rib::model(): no wall', this]);

        // двигаем стену в сторону сабжевого ребра, учитывая толщину ребра
        wall.plane.D -= wall.line.product.thickness / 2;


        var sols = Solutions.twoPlanesAndSphere(plane, wall.plane);

        sols.length == 2 ||
          console.log(['Product.Rib::model(): not two solutions', this]);

        outer = sols[0].distance(point) < sols[1].distance(point) ? sols[0] : sols[1];

        // refactor candidate
        //outer = Solutions.planesCross(line.product.getOuterPlane(), plane, wallPlane);

        // for points placed out of sphere (outer Fulleren)
        // ~
        outer.scale(point.length());

        return {
          // точка внешней поверхности
          outer: outer,
          center: center,
          wall: wall.plane,
          vertex: vertex
        };
      }
      // смещения нет

      if (!line.sliced) {
        wallLine = vertex.product.ribWall(line);

        // ребро не на краю
        if (wallLine) {
          // есть ребро, в которое упирается данное (Joint)
          var wall = {
            plane: wallLine.product.getPlane().clone(),
            line: wallLine
          };

          // ориентируем плоскость стены относительно незадействованной здесь вершины лайна
          if (wall.plane.result(anotherPoint) < 0)
            wall.plane.revert();

          // двигаем стену в сторону сабжевого ребра, учитывая толщину ребра
          wall.plane.D -= wall.line.product.thickness / 2;
        }
        else {
          console.error('This code branch must no usage');

          // нет ребра в которое упирается данное (Piped)
          center = vertex.center || line.center || center;
          var lineVector = Vector.subtract(point, anotherPoint);
          var pointVector = Vector.subtract(point, center);
          var sideVector = Vector.crossProduct(lineVector, pointVector);
          var wallNormal = Vector.crossProduct(sideVector, pointVector).normalize();
          var wall = {
            plane: new Plane(wallNormal, point)
          };
        }

        // двигаем стену на радиус трубы
        var offset = vertex.product.ribWallOffset(line);
        if (offset) {
          wall.plane.D += (wall.plane.result(anotherPoint) > 0 ? -offset : offset);
        }


        var sols = Solutions.twoPlanesAndSphere(plane, wall.plane);

        sols.length == 2 ||
          console.log(['Product.Rib->getTails()', 'not 2 solutions', this]);

        outer = sols[0].distance(point) < sols[1].distance(point) ? sols[0] : sols[1];

        // for points placed out of sphere (outer Fulleren)
        // ~
        outer.scale(point.length());

        return {
          // точка внешней поверхности
          outer: outer,
          center: center,
          wall: wall.plane,
          vertex: vertex
        };
      }

      // В НОВОЙ ВЕРСИИ СЮДА НЕ ПОПАДАЕМ
      console.error('// В НОВОЙ ВЕРСИИ СЮДА НЕ ПОПАДАЕМ');
    },

    unify: function () {
      return 'Joint ' + Product.Connector.prototype.unify.apply(this);
    }
  });


// Труба (расположена вдоль радиуса) с лучами для крепления ребер, классика для любителей сварки и стыков металл+дерево
Product.Connector.Piped = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'Piped',
    vertex: vertex,
    point: vertex.$points[0],
    bilateral: false
  }, params || {})]);

  // габариты приводим к долям радиуса, а получаем в неких единицах измерения
  this.Dpipe *= (this.measure || 1) / this.R;
}
  .inherits(Product.Connector)
  .override({
    ribPlaneOffset: function (line) {
      return 0;
    },

    // расстояние от вершины коннектора до плоскости стены (в которую ребро упирается)
    ribWallOffset: function (line) {
      return this.Dpipe / 2;
    },

    // оконцовщик хвоста ребра
    getTail: function (line) {
      // take origin line figure
      line = line.origin;

      // cache
      this.cache.pipedTail = this.cache.pipedTail || {};
      if (this.cache.pipedTail[line._enum])
        return this.cache.pipedTail[line._enum];

      var vertex = this.vertex, point = vertex.$points[0];
      var plane = line.product.getPlane();

      var vertexIter = line.$vertexes[0] == vertex ? 0 : 1;
      var anotherPoint = line.$vertexes[1 - vertexIter].$points[0];
      var center = line.center || vertex.center || Vector(0);

      if (!line.sliced) {
        // ребро не на краю
        center = vertex.center || line.center || center;
        var lineVector = Vector.subtract(point, anotherPoint);
        var pointVector = Vector.subtract(point, center);
        var sideVector = Vector.crossProduct(lineVector, pointVector);
        var wallNormal = Vector.crossProduct(sideVector, pointVector).normalize();
        var wall = {
          plane: new Plane(wallNormal, point)
        };

        // двигаем стену на радиус трубы
        var offset = vertex.product.ribWallOffset(line);
        wall.plane.D += (wall.plane.result(anotherPoint) > 0 ? -offset : offset);

        return this.cache.pipedTail[line._enum] = {
          // точка внешней поверхности
          outer: Solutions.planesCross(line.product.getOuterPlane(), plane, wall.plane),
          center: center,
          wall: wall.plane,
          vertex: vertex
        };
      }

      // ребро целиком на краю (Piped, Joint)
      line.sliced ||
        console.log(['Product.Rib->getTails()', 'fail']);

      var $anotherSelvageLines = vertex.$super.line.filter(function () { return this.selvage && this !== line });

      if ($anotherSelvageLines.length != 1)
        console.log(['Product.Rib->getTails()', 'not 1 anotherSelvageLines: ', $anotherSelvageLines]);

      var linePlane = line.product.getPlane(),
        line2Plane = $anotherSelvageLines[0].product.getPlane();

      Vector.dotProduct(linePlane.normal(), line2Plane.normal()) < 0 &&
        line2Plane.revert();

      var outer = point,
        offset = this.ribWallOffset(line);

      center = vertex.center || line.center || center;
      var lineVector = Vector.subtract(point, anotherPoint);
      var pointVector = Vector.subtract(point, center);
      var sideVector = Vector.crossProduct(lineVector, pointVector);
      var wallNormal = Vector.crossProduct(sideVector, pointVector).normalize();
      var wallPlane = new Plane(wallNormal, point);


      // двигаем стену на радиус трубы
      if (offset) {
        wallPlane.D += (wallPlane.result(anotherPoint) > 0 ? -offset : offset);

        outer = Solutions.planesCross(line.product.getOuterPlane(), plane, wallPlane);
      }

      return this.cache.pipedTail[line._enum] = {
        outer: outer,
        wall: wallPlane,
        center: center,
        vertex: vertex
      };
    },

    unify: function () {
      var product = this;

      // проекция ребер на основание радиус-вектора вершины
      var prev, pinAngleSum = 0;
      var radius = Vector.subtract(this.vertex.$points[0], this.vertex.center);

      this.$hedgehog = this.vertex.$scheme.map(function () {
        if (this.source.type == 'line') {
          var vector = product.toOtherTail(this.source);

          return prev = {
            vector: vector,
            source: this.source,
            pin: Vector.subtract(vector, Vector.project(vector, radius)),
            terminate: this.selvage
            //product: product
          };
        }
        return null;
      });

      // углы
      this.$hedgehog.each(function () {
        var angle = (Vector.add(prev.pin, this.pin).length() < 1e-9) ? Math.PI : prev.pin.angleWith(this.pin);

        if (Vector.dotProduct(Vector.crossProduct(this.pin, prev.pin), radius) < 0)
          angle = Math.PI * 2 - angle;

        pinAngleSum += (
          prev.forwardAngle = this.backAngle = angle
        );

        prev = this;
      });

      // total control
      if (Math.abs(pinAngleSum - Math.PI * 2) > 1e-7)
        console.log('Piped.unify(): pin angles sum is not full circle ' + pinAngleSum);

      // sort & select
      this.$hedgehog = $(
        Product.selectChain(
          this.$hedgehog,
          function (i, arr, forward) {
            return forward ? this.backAngle : this.forwardAngle;
          },
          true,
          product.bilateral
        )
      );

      return this.$hedgehog.map(
        function () {
          return Product.angleUnify(this.forward ? this.backAngle : this.forwardAngle);
        }
      ).get().join('-');
    },

    // draw product scheme on canvas
    // @param DomElement canvas
    // @param Object plotter options
    plot: function (canvas, opts) {
      var product = this;
      var C = { x: 1, y: 1 };
      var plotter = new Plotter(canvas, $.extend(opts, {
        width: 2,
        height: 2,
        margin: 20, // px
        resize: true,
        R: this.R,
        textZoom: 2
      }))
        .circle(C, .8, ['solid', 'fillWhite']);

      var angle = 0, prev;//Math.PI;
      this.$hedgehog.each(function () {
        prev = angle;
        angle += this.forward ? this.backAngle : this.forwardAngle;

        var A = { x: 1 + Math.cos(angle), y: 1 + Math.sin(angle) };

        // line
        plotter.line(C, A, 'bbb');

        // index
        plotter.textByLine(this.source.index, C, A, { q: .9, sup: true });

        // degree
        var mid = (prev + angle) / 2;
        var degree = Math.round(1800 * (angle - prev) / Math.PI) / 10 + '°';
        plotter.text(
          { x: 1 + .38 * Math.cos(mid), y: 1 + .38 * Math.sin(mid) },
          degree
        );
      });
    }
  });

// helper for Cone
function AngleSet() { }
AngleSet.prototype = {
  add: function (angle, weight) {
    // sense a near value
    for (var a in this)
      if (this.hasOwnProperty(a))
        angle = Math.abs(a - angle) > 1e-6 ? angle : a;
    // increment
    this[angle] = (this[angle] || 0) + weight;
    return angle;
  },
  merge: function (set, maxus) {
    for (var a in set)
      if (set.hasOwnProperty(a)) {
        this.add(a, set[a]);
        maxus = Math.max(maxus, this[a]);
      }
    return maxus;
  }
};

/**
 * Корабль, карандаш, конус... ибо шишка
 */
Product.Connector.Cone = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'Cone',
    vertex: vertex,
    point: vertex.$points[0],
    bilateral: false
  }, params || {})]);

  this.alterProduct = function () {
    return new Product.Connector.Piped(vertex, params);
  };
}
  .inherits(Product.Connector.Piped)
  .override({
    ribPlaneOffset: function (line) {
      return 0;
    },

    // расстояние от вершины коннектора до плоскости стены (в которую ребро упирается)
    ribWallOffset: function (line) {
      return 0;
    },

    // ключ аккумулятора
    /*
    pinAccumKey: function(pin, finaly){
      var back = pin.forward ? pin.backAngle : pin.forwardAngle;
      var forward = pin.forward ? pin.forwardAngle : pin.backAngle;
      var pp = pin.source.$points;
      var length = Product.lengthUnify( pp[0].distance(pp[1]) * this.R );
      var suffix;
    	
      if (!finaly){
        var otherProduct = this.otherVertex(pin.source).product;
      	
        if (otherProduct === this)
          console.log('otherProduct === this product');
      	
        // prepare other hedgehog
        if (!otherProduct.$hedgehog)
          Product.Connector.Piped.prototype.unify.call(otherProduct);
      	
        var otherHedgehog = otherProduct.$hedgehog;
        var otherPin = otherHedgehog.map(function(){
          return this.source === pin.source ? this : null;
        })[0];
        suffix = otherProduct.pinAccumKey(otherPin, true);
      }
    	
      return (back >= Math.PI ? 'none' : Product.angleUnify(back)) + ' ' + length + ' ' + 
        (forward >= Math.PI ? 'none' : Product.angleUnify(forward)) + (suffix ? ' => ' + suffix : '');
    },
    */

    unify: function (accum) {
      if (this.cache.coneUnifier)
        return this.cache.coneUnifier;

      var product = this;
      var unifier = Product.Connector.Piped.prototype.unify.apply(this, arguments);

      //accum = accum || {};
      accum.cone = accum.cone || {};

      function mirrorKey(key) {
        //key = key.replace(/(\S+) (\S+) (\S+)$/g, '$3 $2 $1');
        key = key.replace(/^(\S+) (\S+) (\S+)/g, '$3 $2 $1');
        return key;
      }

      if (!this.vertex.selvage) {
        // решение зацикленной системы линейных уравнений
        if (this.$hedgehog.length % 2) {
          // единственно, если лучей нечетное кол-во
          this.$hedgehog.each(function () {
            this.coneAngle = 0;
          });
          this.$hedgehog.each(function (i) {
            var subj = this;
            product.$hedgehog.each(function (j) {
              var pin = product.$hedgehog[(i + j) % product.$hedgehog.length];
              subj.coneAngle += (j % 2 ? -1 : 1) * pin[pin.forward ? 'forwardAngle' : 'backAngle'];
              // assertion
              if (isNaN(subj.coneAngle))
                console.log('isNaN(subj.coneAngle)');
            });
          });
          this.$hedgehog.each(function (i) {
            if (this.coneAngle < 0)
              console.log('<0');
            this.coneAngle = Math.abs(this.coneAngle / 2);
            // assertion
            if (isNaN(this.coneAngle))
              console.log('isNaN(this.coneAngle)');
          });
        }
        else {
          // при четном кол-ве сходящихся лучей (ребер)
          var sum = [0, 0];
          this.$hedgehog.each(function (i) {
            sum[i % 2] += this.forwardAngle;
          });
          if (Math.abs(sum[0] - sum[1]) < 1e-6 && Math.abs(sum[0] - Math.PI) < 1e-6) {
            // если сумма углов через один равна Пи, то беск. кол-во решений
            // выбираем лучшее...
            var alfa = 0;
            var mins = [9, 9];
            this.$hedgehog.each(function (i) {
              this.coneAngle = alfa;
              mins[i % 2] = Math.min(mins[i % 2], alfa);
              var forwardAngle = this.forward ? this.forwardAngle : this.backAngle;
              alfa = forwardAngle - alfa;
              // assertion
              if (isNaN(alfa))
                console.log('isNaN(alfa)');
            });
            var mid = (mins[0] + mins[1]) / 2;
            this.$hedgehog.each(function (i) {
              this.coneAngle += mid - mins[i % 2];
              // assertion
              if (isNaN(this.coneAngle))
                console.log('isNaN(this.coneAngle)');
            });
          }
          else {
            // иначе решений нет
            //console.warn('Cone.unify(): zero solution');

            throw 'Cone.unify(): zero solution';
          }
        }

        // аккумуляция значений вычисленых coneAngle для различных соседних углов лучу (ребру)
        /*
        this.$hedgehog.each(function(i){
          var angle = this.coneAngle;
        	
          var key = product.pinAccumKey(this);
          accum.cone[key] = accum.cone[key] || new AngleSet;
          accum.cone[key].add(angle, 1000);
          var revLeft = mirrorKey(key);
          accum.cone[revLeft] = accum.cone[revLeft] || new AngleSet;
          accum.cone[revLeft].add(angle, 1);
        });
        */

        //console.log('direct', this.$hedgehog.map(function(){ return this.coneAngle }))
      }
      else {
        console.error('accum depricated call');
        throw 'accum depricated call';
        /*
      	
        // край фигуры
        // попытка вытащить из аккумулятора
        var found, foundMaxus;
        this.$hedgehog.each(function(i){
          var curr = this;
          var key = product.pinAccumKey(curr);
          var keySense = new RegExp(
              key
              .replace(/none/g, '(?:\\d+|none)')
              .replace(/(\d+)/g, '(?:$1|none)')
            );
        	
          var angle, maxus = 0;
          var angleSols = new AngleSet;
          for (var k in accum.cone)
            if (keySense.test(k))
              maxus = angleSols.merge(accum.cone[k], maxus);
        	
          var solus = 0;
          for (var a in angleSols){
            if (angleSols[a] == maxus){
              solus++;
              angle = a;
            }
          }
        	
          if (solus == 1 && (!found || maxus > foundMaxus)){
            curr.coneAngle = parseFloat(angle);
          	
            // registration
            //accum.cone[key] = accum.cone[key] || new AngleSet;
            //accum.cone[key].add(angle, 1000);
            //var left = mirrorKey(key);
            //accum.cone[left] = accum.cone[left] || new AngleSet;
            //accum.cone[left].add(angle, 1);
  
            //console.log('add solution for key', key, 'with solutions set', angleSols)
          	
            // assertion
            if (isNaN(curr.coneAngle))
              console.log('isNaN(curr.coneAngle)');
          	
            // order founded
            found = i;
            foundMaxus = maxus;
            //return false;
          }
          else{
            //console.log('Cone.unify():', solus, 'solutions for ', key, angleSols, 'by', accum.cone);
          }
        });
      	
        if (found !== undefined){
          var length = this.$hedgehog.length;
        	
          //if (length == 2)
            //console.log('found', found, 'length', length);
        	
          for (var incr = 1, back = 0; incr >= -1; incr -= 2, back = 1){
            var i = found;
            var curr = this.$hedgehog[i];
            while((i = (i + incr + length) % length) != found) {
              var prev = curr;
              curr = this.$hedgehog[i];
            	
              var sum = back ?
                (prev.forward ? prev.backAngle : prev.forwardAngle) :
                (prev.forward ? prev.forwardAngle : prev.backAngle);
            	
              // hardcode for situation when non-fuller must be breaked (PI * 4 / 5 gt 2.5)
              if (sum > 2.5){
                //console.log('cones sum > 2.5, sum is', sum);
                break;
              }
            	
              curr.coneAngle = (sum > Math.PI ? Math.PI * 2 - sum : sum) - prev.coneAngle;
            	
              if (curr.source.selvage && prev.source.selvage)
                break;
            }
          }
        }
        else{
          var keys = this.$hedgehog.map(function(i){ return product.pinAccumKey(this) });
          var lens = $.map(keys, function(key){ return key.replace(/^\S+ (\d+).*$/, '$1') });
          var acc = {};
          $.each(accum.cone, function(key, as){
            for (var i = 0, l = lens.length; i < l; i++)
              if (key.split(lens[i]).length > 1)
                acc[key] = as;
          });
          console.log('Cone angle for keys', keys, 'not found in accum', acc);
        }
        */
      }

      // control shot
      if (this.$hedgehog.filter(function () { return isNaN(this.coneAngle) }).length)
        console.log('Cone-' + unifier, 'cone without angle detected', this.$hedgehog);
      if (this.$hedgehog.filter(function () { return this.coneAngle > Math.PI / 2 }).length)
        console.log('Cone-' + unifier, 'cone with angle gt PI/2', this.$hedgehog);

      return this.cache.coneUnifier =
        'Cone-' + unifier;
    },

    // оконцовщик ребра
    getTail: function (line) {
      // take origin line figure
      line = line.origin;

      $.inArray(this.vertex, line.$vertexes) >= 0 || console.log('its not my line', this);

      var tail = Product.Connector.Piped.prototype.getTail.apply(this, arguments);

      this.unify();
      var vertex = this.vertex, product = this,
        pinIndex, pinCount = this.$hedgehog.length;

      this.$hedgehog.each(function (i) {
        if (this.source == line) {
          pinIndex = i;
          tail.coneAngle = this.coneAngle;
          tail.coneSide = (i != 0) ? (i != pinCount - 1) ? 'both' : 'left' : 'right';
          return false;
        }
      });

      //var $nearLines = line.$nearLinesByVertex[vertexIndex];

      return tail;
    },

    plot: function (canvas, opts) {
      Product.Connector.Piped.prototype.plot.apply(this, arguments);

      var plotter = new Plotter(canvas, $.extend(opts, {
        width: 2,
        height: 2,
        margin: 20, // px
        R: this.R,
        textZoom: 2
      }));

      var angle = 0;
      this.$hedgehog.each(function () {
        angle += this.forward ? this.backAngle : this.forwardAngle;

        // degree
        var degree = Math.round(1800 * this.coneAngle / Math.PI) / 10;
        plotter.text(
          { x: 1 + .618 * Math.cos(angle), y: 1 + .618 * Math.sin(angle) },
          degree * 2 + '°'
        );
      });
    }
  });

/**
 * Пол-шишки тоже шишка
 * - это просто нос, полуконус дальше будет
 */
Product.Connector.Nose = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'Nose',
    vertex: vertex,
    point: vertex.$points[0],
    //bilateral: true,
    whirlAsClock: 0
  }, params || {})]);
  // type cast
  this.whirlAsClock = (1 == this.whirlAsClock);
  // no pipe
  this.Dpipe = 0;
}
  .inherits(Product.Connector.Piped)
  .override({
    afterTailsGiven: function (tail, i, line) {
      var product = this;
      var wall = this.$hedgehog.map(function () {
        if (this.source === line)
          return null;
        //if (!this.pin || !tail.backDir)
        //	console.error('must to be');
        if (this.pin.cosWith(tail.backDir) > 0) // angle must be < 90 degrees
          return null;
        var is = Vector.dotProduct(
          Vector.crossProduct(this.pin, tail.backDir),
          product.point // strangen center not found
        ) > 0;
        if (is ^ !product.whirlAsClock)
          return null;
        return product.getTail(this.source).wall;
      })[0];

      if (wall) {
        //var oi = Vector.subtract(tail.inner, tail.outer);
        //tail.walker0clone = tail.walker0clone || tail.walkers[0].clone();
        //var revert = Vector.dotProduct(Vector.crossProduct(tail.walker0clone, oi), tail.backDir) < 0 ? 0 : 1;
        var pp = [],
          dd = $.map(tail.walkers, function (w, j) {
            pp[j] = Vector.add(product.point, w);
            return wall.result(pp[j]) //Math.abs( wall.result(pp[j]) );
          }),
          index = (dd[0] > dd[1]) ? 0 : 1,
          p = pp[index],
          d = dd[index],
          walker = tail.walkers[index];

        // wall.result(p + X * tail.backDir) = 0
        var td = wall.result(Vector.add(p, tail.backDir));
        var X = d / (d - td);

        tail.walkers[index].add(Vector.scale(tail.backDir, X));
      }
      return tail;
    }
  });


/**
 * GoodKarma
 */
Product.Connector.GoodKarma = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'GoodKarma',
    vertex: vertex,
    point: vertex.$points[0],
    whirlAsClock: 0
  }, params || {})]);
  // type cast
  this.whirlAsClock = (1 == this.whirlAsClock);
  // no pipe
  this.Dpipe = 0;
}
  .statics({
    lineSeparatelyForFaces: true
  })
  .inherits(Product.Connector.Joint)
  .override({
    ribPlaneOffset: function (line) {
      return 0;
    },

    // ребро, в которое упирается заданное ребро
    //	ribWall: function(line) {
    //		var product = this;
    //
    //		return _.filter(figure.$primitives, function(p) {
    //			return 1
    //				&& p.bindedFace === line.bindedFace
    //				&& p !== line
    //				&& _.indexOf(p.origin.$vertexes, product.vertex) > -1;
    //		})[0];
    //	},

    // оконцовщик хвоста ребра
    getTail: function (line) {
      var vertex = this.vertex,
        point = vertex.$points[0],
        secondVertex = line.origin.$vertexes[line.origin.$vertexes[0] === vertex ? 1 : 0],
        secondPoint = secondVertex.$points[0],

        plane = line.product.getPlane(true),
        planeNormal = plane.normal();

      var wallLine = _.find(line.bindedFace.bindedLines, function (any) {
        return 1
          && any !== line
          && _.contains(any.origin.$vertexes, vertex);
      }),
        wallPlane = wallLine.product.getPlane(true).clone().normalize(),

        thirdVertex = wallLine.origin.$vertexes[wallLine.origin.$vertexes[0] === vertex ? 1 : 0],
        thirdPoint = thirdVertex.$points[0];

      // ориентируем плоскость стены относительно незадействованной здесь вершины лайна
      if (wallPlane.result(secondPoint) < 0)
        wallPlane.revert();

      // двигаем стену в сторону сабжевого ребра, учитывая толщину ребра
      wallPlane.D += (
        this.whirlAsClock ^
          (Vector.dotProduct(
            Vector.crossProduct(
              secondPoint.clone().subtract(point),
              thirdPoint.clone().subtract(point)
            ),
            point
          ) > 0)
          ? -1 : 1) * wallLine.product.thickness / 2;

      var outer = plane.crossWithRay(
        wallPlane.crossWithRay(
          point,
          secondPoint.clone().subtract(point)
        ),
        Vector.crossProduct(line.product.getOuterPlane().normal(), wallPlane.normal())
      );

      return {
        // точка внешней поверхности
        outer: outer,
        center: Vector(0),
        wall: wallPlane,
        vertex: vertex
      };
    },

    unify: function () {
      return 'GoodKarma ' + Product.Connector.prototype.unify.apply(this);
    }
  });



/**
 * Semicone
 */
Product.Connector.Semicone = function (vertex, params) {
  Product.Connector.apply(this, [$.extend({
    type: 'Semicone',
    vertex: vertex,
    point: vertex.$points[0]
  }, params || {})]);
  // no pipe ?
  //this.Dpipe = 0;
}
  .statics({
    lineSeparatelyForFaces: true
  })
  .inherits(Product.Connector.Joint)
  .override({
    ribPlaneOffset: function (line) {
      return 0;
    },

    // оконцовщик хвоста ребра
    getTail: function (line) {
      var vertex = this.vertex,
        point = vertex.$points[0],
        secondVertex = line.origin.$vertexes[line.origin.$vertexes[0] === vertex ? 1 : 0],
        secondPoint = secondVertex.$points[0],

        plane = line.product.getPlane(true),
        planeNormal = plane.normal(),

        thirdVertex = _.difference(line.bindedFace.$sub.vertex.get(), [vertex, secondVertex])[0],
        thirdPoint = thirdVertex.$points[0],

        wallPlane = new Plane(
          Vector.crossProduct(
            // bisectrix
            Vector.add(
              Vector.subtract(secondPoint, point).normalize(),
              Vector.subtract(thirdPoint, point).normalize()
            ),
            // radius vector
            point
          ),
          point
        ).normalize();

      // ориентируем плоскость стены относительно незадействованной здесь вершины лайна
      //		if (wallPlane.result(secondPoint) < 0)
      //			wallPlane.revert();

      var outer = plane.crossWithRay(
        wallPlane.crossWithRay(
          point,
          secondPoint.clone().subtract(point)
        ),
        Vector.crossProduct(line.product.getOuterPlane().normal(), wallPlane.normal())
      );

      return {
        // точка внешней поверхности
        outer: outer,
        center: Vector(0),
        wall: wallPlane,
        vertex: vertex
      };
    },

    unify: function () {
      return 'Semicone ' + Product.Connector.prototype.unify.apply(this);
    }
  });
