/**
 * Доска для чертежей
 */

Plotter = function (canvas, opts) {
  var plotter = this;

  // canvas
  this._$canvas = $(canvas);
  this._context = this._$canvas[0].getContext('2d');
  this._width = this._$canvas.width() - (opts.milkRight || 0);
  this._height = this._$canvas.height();

  // canvas style
  this._context.lineCap = 'round',
    this._context.lineJoin = 'bevel',
    this._context.miterLimit = 10;
  this._context.globalAlpha = .9;

  // styles
  this._styles = {
    solid: {
      strokeStyle: "black",
      lineWidth: 2
    },
    backside: {
      strokeStyle: "gray",
      lineWidth: 2
    },
    division: {
      strokeStyle: "rgba(141,141,141,.5)",
      lineWidth: 1
    },
    white: {
      strokeStyle: "white",
      lineWidth: 2
    },
    fillWhite: {
      fillStyle: 'white'
    }
  };

  this._dashedLine = false;
  this._dashedStep = 5;

  this._currentStyle = {
    line: {},
    point: {}
  };

  // props & defaults
  $.extend(this, opts);

  // text zooming
  this.textZoom = this.textZoom || 1;

  this.R = opts.R || 1;
  this.margin = opts.margin || 16; // px

  // input frame (data)
  this._frameIn = {
    l: 0,
    t: 0,
    w: opts.width || console.log('Plotter: no width'),
    h: opts.height || console.log('Plotter: no height')
  };

  // output frame (canvas)
  this._frameOut = {
    l: this.margin,
    t: this.margin,
    w: this._width - 2 * this.margin,
    h: this._height - 2 * this.margin
  };

  // plot current offset
  this._offset = {
    x: opts.offset && opts.offset.x || 0,
    y: opts.offset && opts.offset.x || 0
  };

  // gaps on x
  this.xGaps = opts.xGaps || [];
  this.xGapDelta = 0;
  $(this.xGaps).each(function () {
    plotter.xGapDelta += this.to - this.from;
  });
  this._frameIn.w += this.xGapDelta;

  // пропорции
  if (opts.fixOutXProportion) {
    this._frameOut.w = this._frameOut.h * (this._frameIn.w / this._frameIn.h);
  } else {
    this._frameOut.h = this._frameOut.w * (this._frameIn.h / this._frameIn.w);
  }

  // resize
  if (opts.resize) {
    var of = this._offset;
    this._offset = { x: 0, y: 0 };
    this.resizeCanvasHeightByInputProportion();
    this._offset = of;
  }

  // ratio
  this.ratio = {
    x: this._frameOut.w / this._frameIn.w,
    y: this._frameOut.h / this._frameIn.h
  };
  this.ratio.l = Math.sqrt(this.ratio.x * this.ratio.y);
}
  .override({
    resizeCanvasHeightByInputProportion: function () {
      var height = this._plane({ x: 0, y: this._frameIn.h }, { y: this.margin }).y;
      this._frameOut.h = height - 2 * this.margin;
      this._$canvas[0].height = height;
    },

    _setStyle: function (subj, style) {
      if (style instanceof Array) {
        for (var i = 0; i < style.length; i++) {
          this._setStyle(subj, style[i]);
        }
        return;
      }
      var values = typeof style == 'object' ? style : this._styles[style] || {};
      for (var k in values) {
        this._context[k] = values[k];
      }
      if (subj == 'line') {
        this._dashedLine = (style == 'backside' || style == 'dashed');
      }
    },

    _plane: function (p, offset) {
      var plotter = this;
      var xGapDelta = 0;
      $(this.xGaps).each(function () {
        if (plotter._offset.x + p.x > this.x + this.from)
          xGapDelta += this.to - this.from;
      });
      return {
        x: Math.round(
          this._frameOut.l +
          ((this._offset.x + p.x + xGapDelta) - this._frameIn.l) * this._frameOut.w / this._frameIn.w +
          (offset && offset.x || 0)
        ),
        y: Math.round(
          this._frameOut.t +
          ((this._offset.y + p.y) - this._frameIn.t) * this._frameOut.h / this._frameIn.h +
          (offset && offset.y || 0)
        )
      };
    },

    _moveTo: function (p) {
      this._context.moveTo(p.x + .5, p.y + .5);
    },

    _lineTo: function (p) {
      this._context.lineTo(p.x + .5, p.y + .5);
    },

    offset: function (o) {
      if (!o) return this._offset;
      this._offset.x += o.x || 0;
      this._offset.y += o.y || 0;
      return this;
    },

    line: function (p1, p2, style, outputXY) {
      var ctx = this._context;
      ctx.save();
      this._setStyle('line', style);
      ctx.beginPath();

      if (this._dashedLine) {
        var s = outputXY ? p1 : this._plane(p1);
        var f = outputXY ? p2 : this._plane(p2);
        var length = Math.sqrt((s.x - f.x) * (s.x - f.x) + (s.y - f.y) * (s.y - f.y));
        var step = this._dashedStep;
        var v = { x: (f.x - s.x) * step / length, y: (f.y - s.y) * step / length };
        var p = { x: s.x + v.x / 2, y: s.y + v.y / 2 };
        for (var i = 0, l = 0; l < length; i++) {
          this[(i % 2) ? '_lineTo' : '_moveTo'](p);
          l += step;
          p.x += l < length - 1 ? v.x : v.x / 2;
          p.y += l < length - 1 ? v.y : v.y / 2;
        }
      } else {
        this._moveTo(outputXY ? p1 : this._plane(p1));
        this._lineTo(outputXY ? p2 : this._plane(p2));
      }

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return this;
    },

    circle: function (pos, r, style) {
      pos = this._plane(pos);
      r *= this.ratio.l;

      var ctx = this._context;
      ctx.save();
      this._setStyle('circle', style);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      return this;
    },

    text: function (pos, text, opts) {
      opts = $.extend({
        planePos: true,
        fillStyle: 'black',
        strokeStyle: 'black'
      }, opts || {});
      pos = opts.planePos ? this._plane(pos) : pos;

      var ctx = this._context;
      ctx.save();
      ctx.textBaseline = opts.valign || 'middle';
      ctx.textAlign = opts.align || 'center';
      ctx.font = (opts.fontSize || 0.5) * this.textZoom + "em monospace, Optimer, verdana";
      ctx.fillStyle = opts.fillStyle;
      ctx.strokeStyle = opts.strokeStyle;
      ctx.strokeWidth = 2;
      ctx.translate(pos.x, pos.y);
      ctx.rotate(opts.rotate || 0);
      ctx.fillText(text, 0, 0);
      ctx.restore();
      return this;
    },

    textByLine: function (text, A, B, opts) {
      if (text === undefined) {
        //debugger;
      }

      opts = opts || {};
      var pos = this.average(A, B, opts.q || 1 / 2),
        length = Math.sqrt((A.x - B.x) * (A.x - B.x) + (A.y - B.y) * (A.y - B.y)),
        normal = { x: (A.y - B.y) / length, y: (B.x - A.x) / length };
      var rev = (opts.sup && normal.y) ^ opts.otherSide > 0 ? -1 : 1;
      pos.x += rev * normal.x * 10 / this.ratio.x;
      pos.y += rev * normal.y * 10 / this.ratio.y;
      var angle = Math.atan2(A.y - B.y, A.x - B.x);
      this.text(pos, text, $.extend({
        rotate: angle < Math.PI / 2 ? angle > -Math.PI / 2 ? angle : angle + Math.PI : angle - Math.PI,
        fontSize: 0.6
      }, opts));
    },

    vertical: function (x, style) {
      this.line(
        this._plane({ x: x, y: 0 }, { y: -this.margin }),
        this._plane({ x: x, y: this._frameIn.h }, { y: this.margin }),
        style,
        true // dont plane again
      );
      return this;
    },

    xdivision: function (x, align, valign, anchor) {
      this.vertical(x, 'division');

      // division
      var floatDiv = (x + this._offset.x) * this.R / 0.001;

      // rounding
      var div = Math.round(
        (typeof anchor != 'undefined') ? anchor + Math.round(floatDiv - anchor) : floatDiv
      );

      var pos = this._plane({
        x: x,
        y: (valign == 'top') ? 0 : this._frameIn.h
      }, {
        y: (valign == 'top') ? -this.margin : this.margin
      });

      //this.text(pos, div, {valign: valign, align: align});
      var ctx = this._context;
      ctx.textBaseline = valign;
      ctx.textAlign = align;
      ctx.font = "14px monospace, Optimer, verdana";//(0.5) * this.textZoom + "em Optimer, verdana";
      ctx.fillStyle = "black";
      ctx.strokeStyle = "black";
      ctx.strokeWidth = 2;
      ctx.fillText(div, pos.x, pos.y);
      return floatDiv;
    },

    horizontal: function (y, style) {
      this.line(
        this._plane(
          { x: 0, y: y },
          { x: -this.margin }
        ),
        this._plane(
          { x: this._frameIn.xmax || this._frameIn.w, y: y },
          { x: this.margin }
        ),
        style,
        true // dont plane coordinates again
      );
      // gaps on x
      var plotter = this;
      setTimeout(function () {
        $(plotter.xGaps).each(function () {
          plotter.line(
            { x: this.x, y: y },
            { x: this.x + this.from + 0.00001, y: y },
            ['white', 'dashed']
          );
        });
      }, 1);
      return this;
    },

    ydivision: function (y, align, valign) {
      this.horizontal(y, 'division');

      // division
      var div = Math.round((y + this._offset.y) * this.R / 0.001);
      var pos = this._plane({
        x: (align == 'left') ? 0 : this._frameIn.w,
        y: y
      }, {
        x: (align == 'left') ? -this.margin : this.margin
      });
      var ctx = this._context;
      ctx.textBaseline = valign;
      ctx.textAlign = align;
      ctx.font = "14px monospace, Optimer, verdana"; //(0.5) * this.textZoom + "em Optimer, verdana";
      ctx.fillStyle = "black";
      this._context.fillText(div, pos.x, pos.y);
      return this;
    },

    vertexLabel: function (index, pos, ribs) {
      var rayCount = _.filter(ribs, function (rib) {
        return rib === rib.origin;
      }).length;

      pos = this._plane(pos);

      // sun-connector
      var ctx = this._context, r = 12;
      ctx.strokeStyle = "#ccc";
      ctx.strokeWidth = 1;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // rays
      rayCount = rayCount || 6;
      for (var i = 0.3; i < rayCount; i++) {
        var offset = {
          x: r * Math.cos(i * 2 * Math.PI / rayCount),
          y: r * Math.sin(i * 2 * Math.PI / rayCount)
        };
        ctx.beginPath();
        ctx.moveTo(pos.x + offset.x, pos.y + offset.y);
        ctx.lineTo(pos.x + 2 * offset.x, pos.y + 2 * offset.y);
        ctx.closePath();
        ctx.stroke();
      }

      // index
      ctx.fillStyle = "#000";
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.textWeight = 'bold';
      ctx.font = "12px monospace, Optimer, verdana";
      ctx.fillText(index || 'n/a', pos.x, pos.y);
    },

    planeAngle: function (A, B, C, style) {
      style = $.extend({
        strokeStyle: 'gray',
        fillStyle: 'black'
      }, style);

      var AB = this.distance(A, B);
      var BC = this.distance(B, C);
      var CA = this.distance(C, A);
      var angle = Math.acos((AB * AB + BC * BC - CA * CA) / (2 * AB * BC));
      angle = Math.round(angle * 180 * 5 / Math.PI) / 5;

      var Ar = Math.atan2(A.y - B.y, A.x - B.x);
      var Cr = Math.atan2(C.y - B.y, C.x - B.x);
      var R = 62;

      A = this._plane(A);
      B = this._plane(B);
      C = this._plane(C);

      var ctx = this._context;
      ctx.save();
      this._setStyle('circle', style);

      ctx.beginPath();
      ctx.arc(B.x, B.y, R, Ar, Cr, true);
      ctx.stroke();
      ctx.restore();

      // degrees
      var bstx = (Ar + Cr) / 2 + (Math.abs(Ar - Cr) > Math.PI ? Math.PI : 0);
      //bstx += bstx > Math.PI + 1e-5 ? -Math.PI : 0;
      if (angle) {
        this.text(
          {
            x: B.x + (R + 10) * Math.cos(bstx),
            y: B.y + (R + 10) * Math.sin(bstx)
          },
          angle + '°',
          _.extend({
            rotate: bstx + Math.PI / 2 + (bstx > 0 ? Math.PI : 0),
            planePos: false,
            fontSize: 0.6
          }, style)
        );
      }
      return this;
    },

    average: function (a, b, q) {
      q = (q === undefined) ? .5 : q;
      return {
        x: a.x * (1 - q) + b.x * q,
        y: a.y * (1 - q) + b.y * q
      };
    },

    distance: function (A, B) {
      return Math.sqrt((A.x - B.x) * (A.x - B.x) + (A.y - B.y) * (A.y - B.y));
    }
  });

/**
 * Чертеж отрезов бруса
 */

Plotter.Beam = function (canvas, opts) {
  Plotter.apply(this, arguments);

  this._frameIn.xmax = opts.length || opts.width;
}
  .inherits(Plotter)
  .override({
    start: function (product, tail) {
      this._offset = {
        x: tail.coneAngle ? Math.abs(tail.bevelInner) :
          Math.max(
            Math.abs(tail.bevelInner + (!tail.bevelChaos && tail.bevelSides[0])),
            Math.abs(tail.bevelInner + (!tail.bevelChaos && tail.bevelSides[1]))),
        y: 0
      };

      this._left = [null, null];
      this._right = [null, null];

      return this;
    },

    tail: function (tail, turnMe, whichSide/*nothing*/, product) {
      var TURN = turnMe ? -1 : 1;
      var outerLink, innerLink;

      var outerCenter = { x: -TURN * tail.bevelInner, y: this._frameIn.h / 2 },
        innerCenter = { x: TURN * tail.bevelInner, y: this._frameIn.h / 2 };

      if (tail.bevelZero || tail.bevelsEquals || tail.bevelChaos) {
        outerLink = this.xdivision(outerCenter.x, turnMe ? 'left' : 'right', 'top');
        innerLink = this.xdivision(innerCenter.x, turnMe ? 'right' : 'left', 'bottom');
      }

      var outerBevels = [];

      for (var i = 0; i < 2; i++) {
        var TOP = (turnMe ^ i) ? 1 : 0;
        var outerBevel = { x: outerCenter.x + TURN * tail.bevelSides[i], y: TOP ? 0 : this._frameIn.h },
          innerBevel = { x: innerCenter.x + TURN * tail.bevelSides[i], y: TOP ? 0 : this._frameIn.h };

        outerBevels.push(outerBevel);

        if (!tail.bevelZero && tail.bevelsEquals && i || tail.bevelChaos) {
          outerLink = this.xdivision(outerBevel.x, turnMe ? 'left' : 'right', 'top', outerLink);
          innerLink = this.xdivision(innerBevel.x, turnMe ? 'right' : 'left', 'bottom', innerLink);
        }
        if (tail.bevelStraight && !tail.bevelsEquals) {
          outerLink = this.xdivision(outerBevel.x, turnMe ? 'left' : 'right', TOP ? 'top' : 'bottom', outerLink);
          innerLink = this.xdivision(innerBevel.x, turnMe ? 'right' : 'left', TOP ? 'top' : 'bottom', innerLink);
        }

        //var style = (whichSide == 'middle') || (whichSide == 'right' ^ outerCenter.x < innerCenter.x) ? 'backside' : 'solid';
        this.line(outerCenter, outerBevel, 'solid');
        this.line(innerCenter, innerBevel, ((innerCenter.x > outerCenter.x) ^ turnMe) ? 'dashed' : 'solid');

        function accum(accum, val, method) {
          return accum == null ? val : Math[method](accum, val);
        }
        this._left[TOP] = accum(this._left[TOP], this._offset.x + outerBevel.x, 'min');
        this._right[TOP] = accum(this._left[TOP], this._offset.x + outerBevel.x, 'max');

        // angle between outer plane and plane to cut
        if (
          (tail.bevelZero && !i) || // Piped (once)
          (!tail.bevelStraight && !i) || // Cone (once)
          (!tail.bevelZero && tail.bevelStraight && (turnMe ^ outerBevel.x > outerCenter.x)) // side what near to rub center (Joint, GoodKarma, Semicone)
        ) {
          var byOuter = new Vector(outerBevel.x - outerCenter.x, outerBevel.y - outerCenter.y, 0);
          var toInner = new Vector(innerCenter.x - outerCenter.x, innerCenter.y - outerCenter.y, this.depth);

          var normalCut = Vector.crossProduct(byOuter, toInner).scale(i ? 1 : -1),
            normalOuter = new Vector(0, 0, this.depth),
            normalSide = new Vector(0, 1, 0);

          var angleToOuter = Math.round(
            normalOuter.angleWith(normalCut)
            / Math.PI * 1800) / 10,

            angleToSide = Math.round(
              normalSide.angleWith(normalCut)
              / Math.PI * 1800) / 10;

          var pp = i ? [outerBevel, outerCenter] : [outerCenter, outerBevel];

          this.textByLine(
            '∟' +
            angleToOuter +
            '°',
            pp[0], pp[1],
            {
              q: turnMe ? 0.382 : 0.618,
              fillStyle: 'blue'
            }
          );
        }
        else if (
          tail.bevelStraight && // side what far from rib center (Joint, GoodKarma)
          (!tail.bevelZero || i) // <exclude> Piped (once)
        ) {
          // angle on a outer plane
          var planeAngle = [outerCenter, outerBevel, { x: outerBevel.x, y: outerCenter.y }];

          if (turnMe ^ i ^ outerBevel.x > outerCenter.x)
            planeAngle.reverse();

          this.planeAngle.apply(this, planeAngle.concat([{ fillStyle: 'red', strokeStyle: 'gray' }]));
        }
      }

      if (!tail.bevelZero && tail.bevelsEquals || tail.bevelChaos) {
        this.line(innerCenter, outerCenter, 'dashed');
      }

      // label
      this.vertexLabel(tail.vertex.index, outerCenter, tail.vertex.$super.line);

      // angle on outer plane (Cone)
      if (!tail.bevelStraight) {
        var planeAngle = [outerBevels[0], outerCenter, outerBevels[1]];

        if (!tail.bevelChaos ^ tail.bevelsEquals)
          planeAngle = planeAngle.reverse();

        this.planeAngle.apply(this, planeAngle.concat([{ fillStyle: 'red', strokeStyle: 'gray' }]));
      }

      return this;
    },

    end: function () {
      this._offset = { x: 0, y: 0 };
      this.line({ x: this._left[1], y: 0 }, { x: this._right[1], y: 0 }, 'solid');
      this.line({ x: this._left[0], y: this._frameIn.h }, { x: this._right[0], y: this._frameIn.h }, 'solid');
      return this;
    }
  });

/**
 * Чертеж треугольника
 */

Plotter.Triangle = function (canvas, opts) {
  var plotter = this;

  var angles = this.angles = opts.angles;
  var radiuses = this.radiuses = opts.radiuses;
  this.maxR = Math.max.apply(null, radiuses);
  this.$lines = opts.$lines;

  // вершины A, B, C
  var ABC = this.ABC = [];
  a = -Math.PI / 2;
  for (var i = 0; i < 3; i++) {
    ABC[i] = {
      x: radiuses[i] * Math.cos(a),
      y: radiuses[i] * Math.sin(a)
    }
    a -= 2 * angles[(i + 2) % 3];
  }

  // основания высот от вершин на чертеже Ah, Bh, Ch
  var ABCh = this.ABCh = [];
  for (var a = 0; a < 3; a++) {
    var b = (a + 1) % 3, c = (a + 2) % 3;
    ABCh[a] =
      Vector.project(
        Vector.subtract(ABC[a], ABC[c]),
        Vector.subtract(ABC[b], ABC[c])
      ).add(ABC[c]);
  }

  // размер полотна
  opts = $.extend({
    width: 2 * this.maxR,
    height: 2 * this.maxR,
    margin: 20, // px
    resize: true,
    offset: { x: this.maxR, y: this.maxR }
  }, opts);

  // parent::constructor()
  Plotter.apply(this, [canvas, opts]);
}
  .inherits(Plotter)
  .override({
    outerCircle: function () {
      return this.circle({ x: 0, y: 0 }, this.maxR, ['gray', 'fillWhite']);
    },

    triangle: function () {
      for (var i = 0; i < 3; i++) {
        var A = this.ABC[i], B = this.ABC[(i + 1) % 3], C = this.ABC[(i + 2) % 3];
        var Ah = this.ABCh[i];
        this.line(B, C, {
          strokeStyle: productPalette.line[this.$lines[i].order].css,
          lineWidth: 3
        });
        this.line(A, Ah, {
          strokeStyle: '#bbb'
        });
      }
      for (var i = 0; i < 3; i++) {
        var A = this.ABC[i], B = this.ABC[(i + 1) % 3], C = this.ABC[(i + 2) % 3];
        var Ah = this.ABCh[i];

        this.textByLine(Product.lengthUnify(this.distance(B, Ah)), B, Ah, { q: .38 });
        this.textByLine(Product.lengthUnify(this.distance(Ah, C)), Ah, C, { q: .62 });

        var edge = Math.round(this.abcEdges[i] * 180 * 10 / Math.PI) / 10;
        this.textByLine(this.$lines[i].index + '  ∟' + edge + '°', B, C, {
          fontSize: 0.9,
          fillStyle: productPalette.line[this.$lines[i].order].css
        });

        this.textByLine(Product.lengthUnify(this.distance(A, Ah)), A, Ah, { q: .9 });
      }
      return this;
    },

    heights: function () {

    },

    vertexes: function () {
      var plotter = this;
      $(this.ABC).each(function (i) {
        // todo: странная проблема разной направленности массивов angles и $vertexes, хотя источник у них один..
        // подогнал в ручную сверяя со схемой
        var n = 2 - i;
        plotter.vertexLabel(plotter.$vertexes[n].index, this, plotter.$vertexes[n].$super.line)
      });
    }
  });