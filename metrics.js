//##############################################################################
// File: 
//		metrics.js
// Dependencies:
//		utils.js
// Description:
//		Defines a Vector object for position, distance and dimensions in 3D, a
//		Rectangle object for neatly packaging position and dimensions together and
//		several utility functions for working with dimensions and/or positions of
//		DOM objects, the document, the window and the viewport.
//##############################################################################
// (c)2005-2006 Jeff Lau
//##############################################################################

function Metrics() {
};

// Heron triangle area
Metrics.triangleHeronArea = (a, b, c) => {
  const p = (a + b + c) / 2;
  return Math.sqrt(p * (p - a) * (p - b) * (p - c));
};

//##############################################################################

Vector =
  Metrics.Vector = function (x, y, z) {
    if (y === undefined && z === undefined && x === 0) {
      return new Vector();
    }
    this.x = isNaN(x) ? 0 : x.valueOf();
    this.y = isNaN(y) ? 0 : y.valueOf();
    this.z = isNaN(z) ? 0 : z.valueOf();
  };

Vector.prototype.copy = function (p) {
  this.x = p.x;
  this.y = p.y;
  this.z = p.z;
  return this;
};

Metrics.Vector.prototype.clone = function () {
  return new Metrics.Vector(this.x, this.y, this.z);
};

Metrics.Vector.prototype.equals = function (to) {
  return
  Math.abs(this.x - to.x) +
    Math.abs(this.y - to.y) +
    Math.abs(this.z - to.z) < .000001;
}


Metrics.Vector.prototype.add = function (vector) {
  this.x += vector.x;
  this.y += vector.y;
  this.z += vector.z;

  return this;
};

Metrics.Vector.add = function (vector1, vector2) {
  return new Metrics.Vector(vector1.x + vector2.x, vector1.y + vector2.y, vector1.z + vector2.z);
};

Metrics.Vector.prototype.subtract = function (vector) {
  this.x -= vector.x;
  this.y -= vector.y;
  this.z -= vector.z;

  return this;
};

Metrics.Vector.subtract = function (vector1, vector2) {
  return new Metrics.Vector(vector1.x - vector2.x, vector1.y - vector2.y, vector1.z - vector2.z);
};

Metrics.Vector.prototype.scale = function (scalar) {
  this.x *= scalar;
  this.y *= scalar;
  this.z *= scalar;

  return this;
};

Metrics.Vector.scale = function (vector, scalar) {
  return new Metrics.Vector(vector.x * scalar, vector.y * scalar, vector.z * scalar);
};

Metrics.Vector.prototype.length = function () {
  return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
};

Metrics.Vector.prototype.isZero = function () {
  return Vector.dotProduct(this, this) < 1e-20;
};

Metrics.Vector.prototype.normalize = function () {
  var length = this.x * this.x + this.y * this.y + this.z * this.z;

  //if (length && Math.abs(length - 1) > 0.01) {
  length = Math.sqrt(length);
  this.x /= length;
  this.y /= length;
  this.z /= length;
  //}
  return this;
};

Metrics.Vector.normalize = function (vector) {
  return (new Metrics.Vector(vector.x, vector.y, vector.z)).normalize();
};

Metrics.Vector.dotProduct = function (vector1, vector2) {
  return vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;
};

Metrics.Vector.crossProduct = function (vector1, vector2) {
  return new Metrics.Vector(
    vector1.y * vector2.z - vector1.z * vector2.y,
    vector1.z * vector2.x - vector1.x * vector2.z,
    vector1.x * vector2.y - vector1.y * vector2.x
  );
};

// проекция вектора1 на вектор2, вдоль вектора2
Metrics.Vector.project = function (vector1, vector2) {
  var square2 = Metrics.Vector.dotProduct(vector2, vector2);

  if (square2) {
    return Metrics.Vector.scale(vector2, Metrics.Vector.dotProduct(vector1, vector2) / square2);
  }

  return new Metrics.Vector();
};

Metrics.Vector.component = function (vector1, vector2) {
  return Metrics.Vector.dotProduct(vector1, Metrics.Vector.normalize(vector2));
};

Metrics.Vector.perpendicular = function (vector1, vector2) {
  return Metrics.Vector.subtract(vector1, Metrics.Vector.project(vector1, vector2));
};

Metrics.Vector.rotate = function (vector, angle, axis) {
  var cosAngle = Math.cos(angle);
  var sinAngle = Math.sin(angle);

  switch (axis) {
    case "x":
      return new Metrics.Vector(
        vector.x,
        vector.y * cosAngle + vector.z * sinAngle,
        vector.z * cosAngle - vector.y * sinAngle
      );
    case "y":
      return new Metrics.Vector(
        vector.x * cosAngle + vector.z * sinAngle,
        vector.y,
        vector.z * cosAngle - vector.x * sinAngle
      );
    default:
      return new Metrics.Vector(
        vector.x * cosAngle + vector.y * sinAngle,
        vector.y * cosAngle - vector.x * sinAngle,
        vector.z
      );
  }
};

Metrics.Vector.prototype.toString = function () {
  return "(" + (this._enum ? 'enum:' + this._enum + ', ' : '') + this.x + ", " + this.y + ", " + this.z + ")";
};

Metrics.Vector.prototype.cosWith = function (B) {
  var a2 = this.x * this.x + this.y * this.y + this.z * this.z;
  var b2 = B.x * B.x + B.y * B.y + B.z * B.z;
  var c = this.clone().subtract(B);
  var c2 = c.x * c.x + c.y * c.y + c.z * c.z;
  var cos = (a2 + b2 - c2) / Math.sqrt(4 * a2 * b2);
  return Math.abs(cos + 1) > 1e-9 ? Math.abs(cos - 1) > 1e-9 ? cos : 1 : -1;
}

Metrics.Vector.prototype.angleWith = function (B, precision) {
  var angle = Math.acos(this.cosWith(B));
  return precision ? Math.round(angle * 180 / Math.PI / precision) * precision : angle;
}

Metrics.Vector.angle = function (A, B, C, precision) {
  return C ? A.clone().subtract(B).angleWith(C.clone().subtract(B), precision) :
    A.angleWith(B, precision);
}

Metrics.Vector.distance = function (A, B, precision) {
  var d = A.clone().subtract(B).length();
  return precision ? Math.round(d / precision) * precision : d;
}

Metrics.Vector.prototype.distance = function (B, precision) {
  return Metrics.Vector.distance(this, B, precision);
}

Vector.prototype.carousel = function () {
  var t = this.x;
  this.x = this.y;
  this.y = this.z;
  this.z = t;
  return this;
}

//############################################################################## plane

Plane =
  Metrics.Plane = function (A, B, C, D) {
    if (arguments.length == 2) {
      Plane.apply(this, [A.x, A.y, A.z, B || 0]);
      return;
    }
    if (typeof D != 'number') {
      Plane.apply(this, [A, B, C, 0]);
      this.D = - this.result(D);
      return;
    }
    this.A = A;
    this.B = B;
    this.C = C;
    this.D = D;
  }
Plane.prototype = {
  normal: function () {
    return new Vector(this.A, this.B, this.C);
  },

  normalize: function () {
    var length = Math.sqrt(this.A * this.A + this.B * this.B + this.C * this.C);
    this.A /= length;
    this.B /= length;
    this.C /= length;
    this.D /= length;
    return this;
  },

  result: function (p) {
    return this.A * p.x + this.B * p.y + this.C * p.z + this.D;
  },

  clone: function () {
    return new Plane(this.A, this.B, this.C, this.D);
  },

  revert: function () {
    this.A = -this.A;
    this.B = -this.B;
    this.C = -this.C;
    this.D = -this.D;
    return this;
  },

  crossWithRay: function (point, vector) {
    return point.clone().add(
      vector.clone().scale(
        - (Vector.dotProduct(this.normal(), point) + this.D) / Vector.dotProduct(this.normal(), vector)
      )
    );
  },

  _add: function (p) {
    this.A += p.A;
    this.B += p.B;
    this.C += p.C;
    this.D += p.D;
    return this;
  }
};

Plane.average = function (
  p1, p2,
  acute, // true/false = разбивать острый/тупой угол
  impossibleResult  // вернется если результат не определен
) {
  if (arguments.length < 3) {
    return [
      Plane.average(p1, p2, false),
      Plane.average(p1, p2, true)
    ];
  }
  p1 = p1.clone().normalize();
  p2 = p2.clone().normalize();
  var cos = p1.normal().cosWith(p2.normal());
  // cos > 0 => сумма нормалей внутри тупого угла => сумма нормальных плоскостей внутри острого
  var revert = cos > 0 ^ acute;
  var ret = p1._add(revert ? p2.revert() : p2).normalize();
  if (isNaN(ret.A) || isNaN(ret.B) || isNaN(ret.C) || isNaN(ret.D))
    ret = (arguments.length == 4) ? typeof (impossibleResult) == 'function' ? impossibleResult() : impossibleResult :
      console.warn('Plane.average(): impossible');
  return ret;
}

//############################################################################## not linear solutions

Solutions = {
  planesCross: function (p0, p1, p2) {
    var A = [p0.A, p1.A, p2.A];
    var B = [p0.B, p1.B, p2.B];
    var C = [p0.C, p1.C, p2.C];
    var D = [p0.D, p1.D, p2.D];

    return new Vector(
      -h3(B, C, D) / h3(B, C, A),
      -h3(C, A, D) / h3(C, A, B),
      -h3(A, B, D) / h3(A, B, C)
    );

    function h3(A, B, C) {
      return 0 +
        C[0] * (A[2] * B[1] - A[1] * B[2]) +
        C[1] * (A[0] * B[2] - A[2] * B[0]) +
        C[2] * (A[1] * B[0] - A[0] * B[1]);
    }
  },
  twoPlanesAndSphere: function (plane0, plane1/*, radius, center*/) {
    //center = center || Vector(0);
    //radius = radius || 1;

    // simple case with both planes intersect center sphere
    if (0 === plane0.D && 0 === plane1.D) {
      const result0 = Vector.crossProduct(plane0.normal(), plane1.normal()).normalize();

      return [result0, Vector.scale(result0, -1)];
    }

    /**
     * вычел 1) из 2, 3) получается такая система: 
     * 5) Px*A + Py*B + Pz*C = Pd
     * 6) Qx*A + Qy*B + Qz*C = Qd
     * +4)  A*A +  B*B +  C*C = 1
     */
    var P = plane0.normal(), //.subtract(center),
      Pd = -plane0.D;
    var Q = plane1.normal(), //.subtract(center),
      Qd = -plane1.D;
    // крутанем
    var mapi = 0, value = 0;
    for (var i = 0; i < 3; i++) {
      P.carousel();
      Q.carousel();
      //mapi++;
      /**
       * 5 =>    7) A = (Pd - Py*B - Pz*C) / Px
       * 6 =>    8) A = (Qd - Qy*B - Qz*C) / Qx
       * 7,8 =>  9) (Pd - Py*B - Pz*C) * Qx = (Qd - Qy*B - Qz*C) * Px
       * 9 =>   10) (Qy*Px - Py*Qx)*B + (Qz*Px - Pz*Qx)*C = Qd*Px - Pd*Qx
       * 5,6 => 11) (Qx*Py - Px*Qy)*A + (Qz*Py - Pz*Qy)*C = Qd*Py - Pd*Qy
       * => переход к новым буквам
       */
      var _Ry = Q.y * P.x - P.y * Q.x, _Rz = Q.z * P.x - P.z * Q.x, _Rd = Qd * P.x - Pd * Q.x;
      var _Sx = Q.x * P.y - P.x * Q.y, _Sz = Q.z * P.y - P.z * Q.y, _Sd = Qd * P.y - Pd * Q.y;

      var val = Math.min(Math.abs(_Ry), Math.abs(_Sx));

      if (val > value) {
        var Ry = _Ry, Rz = _Rz, Rd = _Rd;
        var Sx = _Sx, Sz = _Sz, Sd = _Sd;
        mapi = i + 1;
        value = val;
      };
    }
    for (var i = 0; i < mapi; i++) {
      P.carousel();
      Q.carousel();
    }

    if (value < 1e-4)
      console.log('twoPlanesAndSphere(): error');

    for (var i = 0; i < mapi; i++) {
      P.carousel();
      Q.carousel();
    }

    /**
     * 12)        Ry*B + Rz*C = Rd
     * 13) Sx*A +      + Sz*C = Sd
     * +4)  A*A +  B*B +  C*C = 1
     */
    var Ry2 = Ry * Ry, Sx2 = Sx * Sx, Ry2Sx2 = Sx2 * Ry2;
    var Sz2 = Sz * Sz, Rz2 = Rz * Rz;
    /**
     * 12 =>    14) B = (Rd - Rz*C) / Ry
     * 13 =>    15) A = (Sd - Sz*C) / Sx
     * 12,13,4=>16) Ry2*(Sd - Sz*C)^2 + Sx2*(Rd - Rz*C)^2 + Ry2Sx2*C^2 = Ry2Sx2
     * 16 => 17) (Ry2*Sz2 + Sx2*Rz2 + Ry2Sx2)*C^2 - 2*(Ry2*Sd*Sz + Sx2*Rd*Rz)*C + (Ry2*Sd^2 + Sx2*Rd^2 - Ry2Sx2) = 0
     */
    var a = Ry2 * Sz2 + Sx2 * Rz2 + Ry2Sx2, b = -2 * (Ry2 * Sd * Sz + Sx2 * Rd * Rz), c = Ry2 * Sd * Sd + Sx2 * Rd * Rd - Ry2Sx2;
    var d = b * b / 4 - a * c;

    if (d < -1e-16)
      return [];
    else if (d < 1e-16)
      d = 0;

    d = Math.sqrt(d);
    //console.log(d);
    var sols = d ? [(-b / 2 - d) / a, (-b / 2 + d) / a] : [(-b / 2) / a];

    if (sols.length != 2)
      console.log('sols.length=' + sols.length);

    //console.log([(-b/2 - d)/a, (-b/2 + d)/a]);
    // var lineNormal = Vector.crossProduct(
    // pp[0].subtract(pp[0].center || Vector(0)),
    // pp[1].subtract(pp[1].center || Vector(0)));
    for (var i = 0; i < sols.length; i++) {
      var C = sols[i],
        A = (Sd - Sz * C) / Sx, // 15)
        B = (Rd - Rz * C) / Ry, // 14)
        n = new Vector(A, B, C);
      // debug
      n.mapi = mapi;
      n.sols = sols;
      // крутим обратно (через вперед)))
      for (var j = mapi; j < 3; j++) {
        n.carousel();
      }
      sols[i] = n;
    }
    return sols;
  }
};

//##############################################################################

Orientation =
  Metrics.Orientation = function () {
    this.right = new Metrics.Vector(1, 0, 0);
    this.up = new Metrics.Vector(0, 1, 0);
    this.forward = new Metrics.Vector(0, 0, 1);
  };

//using("Metrics.Orientation");

Metrics.Orientation.prototype.clone = function () {
  var clone = new Metrics.Orientation();
  clone.right = this.right.clone();
  clone.up = this.up.clone();
  clone.forward = this.forward.clone();
  return clone;
}

Metrics.Orientation.prototype.translateVector = function (v) {
  var
    x = this.right.x * v.x + this.up.x * v.y + this.forward.x * v.z,
    y = this.right.y * v.x + this.up.y * v.y + this.forward.y * v.z,
    z = this.right.z * v.x + this.up.z * v.y + this.forward.z * v.z;
  if (isNaN(x) || isNaN(y) || isNaN(z))
  //alert('Orientation'+this+'.translateVector('+v+'): NaN result ('+x+','+y+','+z+')');
  //alert('x = '+this.right.x+' * '+v.x+' + '+this.up.x+' * '+v.y+' + '+this.forward.x+' * '+v.z);
  //alert('v='+v+', v.x='+v.x+' , v.y='+v.y+' , v.z='+v.z);
  {
    var rep = [];
    for (var i in v)
      rep[rep.length] = i;
    error.error.error.error
  }

  return new Metrics.Vector(
    //this.right.x	 * v.x + this.right.y	 * v.y + this.right.z	 * v.z,
    //this.up.x			* v.x + this.up.y			* v.y + this.up.z			* v.z,
    //this.forward.x * v.x + this.forward.y * v.y + this.forward.z * v.z
    x, y, z
  );
};

Metrics.Orientation.prototype.rotate = function (angle, axis) {
  this.right = Metrics.Vector.rotate(this.right, angle, axis).normalize();
  this.up = Metrics.Vector.rotate(this.up, angle, axis).normalize();
  this.forward = Metrics.Vector.rotate(this.forward, angle, axis).normalize();
  return this;
};

Metrics.Orientation.prototype.rotateFrom = function (vector1, vector2) {
  vector1 = vector1.normalize();
  vector2 = vector2.normalize();
  axis = Vector.crossProduct(vector1, vector2);
  var l12 = Vector.subtract(vector1, vector2).length();
  if (l12 < 0.0001) return false;
  axis.normalize();

  var alpha = (Math.PI - Math.atan2(axis.y, axis.z)); // -patched
  axis = Vector.rotate(axis, alpha, 'x');
  var betta = (Math.PI - Math.atan2(axis.x, axis.z));
  var gamma = Math.acos((2 - l12 * l12) / 2);

  this.rotate(alpha, 'x');
  this.rotate(betta, 'y');
  this.rotate(gamma / 1.4142, 'z');
  this.rotate(-betta, 'y');
  this.rotate(-alpha, 'x');

  return true;
};

Metrics.Orientation.prototype.toString = function () {
  return "(" + this.right + ", " + this.up + ", " + this.forward + ")";
};
//##############################################################################

Quat =
  Metrics.Quat = function (w, x, y, z) {
    if (arguments.length == 4) {
      this.w = w;
      this.x = x;
      this.y = y;
      this.z = z;
    } else {
      this.w = 1;
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }
  };

//using("Metrics.Quat");

Metrics.Quat.prototype.clone = function () {
  return new Metrics.Quat(this.w, this.x, this.y, this.z);
};

Metrics.Quat.prototype.normalize = function () {
  var length = this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;

  if (Math.abs(length - 1) > 0.001) {
    length = Math.sqrt(length);

    this.w /= length;
    this.x /= length;
    this.y /= length;
    this.z /= length;
  }
};

Metrics.Quat.prototype.translateVector = function (v) {
  var xx = 2 * this.x * this.x;
  var yy = 2 * this.y * this.y;
  var zz = 2 * this.z * this.z;

  var xw = 2 * this.x * this.w;
  var xy = 2 * this.x * this.y;
  var xz = 2 * this.x * this.z;

  var yw = 2 * this.y * this.w;
  var yz = 2 * this.y * this.z;

  var zw = 2 * this.z * this.w;

  return new Metrics.Vector(
    v.x * (1 - yy - zz) + v.y * (xy + zw) + v.z * (xz - yw),
    v.x * (xy - zw) + v.y * (1 - xx - zz) + v.z * (yz + xw),
    v.x * (xz + yw) + v.y * (yz - xw) + v.z * (1 - xx - yy)
  );
};

Metrics.Quat.multiply = function (q1, q2) {
  var result = new Quat(
    q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
    q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w
  );

  result.normalize();

  return result;
};

Metrics.Quat.fromAxisRotation = function (axisVector, angle) {
  var sinAngle = Math.sin(angle / 2);

  return new Metrics.Quat(
    Math.cos(angle / 2),
    axisVector.x * sinAngle,
    axisVector.y * sinAngle,
    axisVector.z * sinAngle
  );
};

Metrics.Quat.rotate = function (quat, axisVector, angle) {
  return Metrics.Quat.multiply(Metrics.Quat.fromAxisRotation(axisVector, angle), quat);
};

//##############################################################################

Rectangle =
  Metrics.Rectangle = function (pos, dims) {
    this.pos = pos.clone();
    this.dims = dims.clone();
  };

//using("Metrics.Rectangle");

Metrics.Rectangle.prototype.clone = function () {
  return new Metrics.Rectangle(this.pos, this.dims);
};

Metrics.Rectangle.prototype.getPos = function () {
  return this.pos.clone();
};

Metrics.Rectangle.prototype.getDims = function () {
  return this.dims.clone();
};

Metrics.Rectangle.prototype.getTopLeft = function () {
  return this.pos.clone();
};

Metrics.Rectangle.prototype.getTopRight = function () {
  return new Metrics.Vector(this.pos.x + this.dims.x - 1, this.pos.y);
};

Metrics.Rectangle.prototype.getBottomLeft = function () {
  return new Metrics.Vector(this.pos.x, this.pos.y + this.dims.y - 1);
};

Metrics.Rectangle.prototype.getBottomRight = function () {
  return new Metrics.Vector(this.pos.x + this.dims.x - 1, this.pos.y + this.dims.y - 1);
};

Metrics.Rectangle.prototype.overlaps = function (rect) {
  return (this.pos.x + this.dims.x > rect.pos.x) &&
    (this.pos.y + this.dims.y > rect.pos.y) &&
    (rect.pos.x + rect.dims.x > this.pos.x) &&
    (rect.pos.y + rect.dims.y > this.pos.y);
};

Metrics.Rectangle.prototype.containsPoint = function (point) {
  return point.x >= this.pos.x && point.x + this.pos.x < this.dims.x &&
    point.y >= this.pos.y && point.y + this.pos.y < this.dims.y;
};

Metrics.Rectangle.prototype.containsRect = function (rect) {
  return rect.pos.x >= this.pos.x && rect.pos.x + rect.dims.x <= this.pos.x + this.dims.x &&
    rect.pos.y >= this.pos.y && rect.pos.y + rect.dims.y <= this.pos.y + this.dims.y;
};

Metrics.Rectangle.prototype.clipPoint = function (point) {
  var result = point.clone();

  if (result.x < this.pos.x) {
    result.x = this.pos.x;
  } else if (result.x >= this.pos.x + this.dims.x) {
    result.x = this.pos.x + this.dims.x - 1;
  }

  if (result.y < this.pos.y) {
    result.y = this.pos.y;
  } else if (result.y >= this.pos.y + this.dims.y) {
    result.y = this.pos.y + this.dims.y - 1;
  }

  return result;
};

Metrics.Rectangle.prototype.clipRect = function (rect) {
  var x = Math.max(this.pos.x, rect.pos.x);
  var y = Math.max(this.pos.y, rect.pos.y);

  var w = Math.min(this.pos.x + this.dims.x, rect.pos.x + rect.dims.x) - x;
  var h = Math.min(this.pos.y + this.dims.y, rect.pos.y + rect.dims.y) - y;

  if (w > 0 && h > 0) {
    return new Rectangle(new Vector(x, y), new Vector(w, h));
  } else {
    return null;
  }
};

Metrics.Rectangle.prototype.toString = function () {
  return this.pos + ", " + this.dims;
};

//##############################################################################

Metrics.getViewportWidth = function (win) {
  win = win || self;

  if (win.innerWidth) {
    // all except IE
    return win.innerWidth;
  }

  if (win.document.documentElement && win.document.documentElement.clientWidth) {
    // IE6 strict
    return Math.min(win.document.documentElement.clientWidth, win.document.body.clientWidth);
  }

  // other IE
  return win.document.body.clientWidth;
};

Metrics.getViewportHeight = function (win) {
  win = win || self;

  if (win.innerHeight) {
    // all except IE
    return win.innerHeight;
  }

  if (win.document.documentElement && win.document.documentElement.clientHeight) {
    // IE6 strict
    return Math.min(win.document.documentElement.clientHeight, win.document.body.clientHeight);
  }

  // other IE
  return win.document.body.clientHeight;
};

Metrics.getViewportDims = function (win) {
  win = win || self;
  var width, height;

  if (win.innerWidth) {
    width = win.innerWidth;
    height = win.innerHeight;
  } else if (win.document.documentElement && win.document.documentElement.clientWidth) {
    // IE6 strict
    if (win.document.documentElement.clientWidth < win.document.body.clientWidth) {
      width = win.document.documentElement.clientWidth;
      height = win.document.documentElement.clientHeight;
    } else {
      width = win.document.body.clientWidth;
      height = win.document.body.clientHeight;
    }
  } else {
    // other IE
    width = win.document.body.clientWidth;
    height = win.document.body.clientHeight;
  }

  return new Metrics.Vector(width, height);
};

Metrics.getViewportTop = function (win) {
  win = win || self;

  if (win.pageYOffset !== undefined) {
    return win.pageYOffset;
  }

  if (win.document.documentElement && win.document.documentElement.scrollTop) {
    return win.document.documentElement.scrollTop;
  }

  return win.document.body.scrollTop;
};

Metrics.getViewportLeft = function (win) {
  win = win || self;

  if (win.pageXOffset !== undefined) {
    return win.pageXOffset;
  }

  if (win.document.documentElement && win.document.documentElement.scrollLeft) {
    return win.document.documentElement.scrollLeft;
  }

  return win.document.body.scrollLeft;
};

Metrics.getViewportPos = function (win) {
  win = win || self;
  var x, y;

  if (win.pageYOffset !== undefined) {
    x = win.pageXOffset;
    y = win.pageYOffset;
  } else if (win.document.documentElement && win.document.documentElement.scrollTop) {
    x = win.document.documentElement.scrollLeft;
    y = win.document.documentElement.scrollTop;
  } else {
    x = win.document.body.scrollLeft;
    y = win.document.body.scrollTop;
  }

  return new Metrics.Vector(x, y);
};

Metrics.getViewportRect = function (win) {
  return new Metrics.Rectangle(Metrics.getViewportPos(win), Metrics.getViewportDims(win));
};

Metrics.getDocumentWidth = function (win) {
  win = win || self;

  return Math.max(win.document.body.scrollWidth, win.document.offsetWidth);
};

Metrics.getDocumentHeight = function (win) {
  win = win || self;

  return Math.max(win.document.body.scrollHeight, win.document.offsetHeight);
};

Metrics.getDocumentDims = function (win) {
  win = win || self;
  var width, height;

  if (win.document.body.scrollHeight > win.document.body.offsetHeight) {
    width = win.document.body.scrollWidth;
    height = win.document.body.scrollHeight;
  } else {
    width = win.document.body.offsetWidth;
    height = win.document.body.offsetHeight;
  }

  return new Metrics.Vector(width, height);
};

Metrics.getWidth = function (node) {
  if (node.offsetWidth !== undefined) {
    return node.offsetWidth;
  } else if (node.clientWidth !== undefined) {
    return node.clientWidth;
  } else if (node.width !== undefined) {
    return node.width;
  } else {
    throw "Metrics.getWidth doesn't work in this browser";
  }
};

Metrics.getHeight = function (node) {
  if (node.offsetHeight !== undefined) {
    return node.offsetHeight;
  } else if (node.clientHeight !== undefined) {
    return node.clientHeight;
  } else if (node.height !== undefined) {
    return node.height;
  } else {
    throw "Metrics.getHeight doesn't work in this browser";
  }
};

Metrics.getDims = function (node) {
  var width, height;

  if (node.offsetWidth !== undefined) {
    width = node.offsetWidth;
    height = node.offsetHeight;
  } else if (node.clientWidth !== undefined) {
    width = node.clientWidth;
    height = node.clientHeight;
  } else if (node.width !== undefined) {
    width = node.width;
    height = node.height;
  } else {
    throw "Metrics.getDims doesn't work in this browser";
  }

  return new Metrics.Vector(width, height);
};

Metrics.setDims = function (node, dims) {
  node.style.width = dims.x + "px";
  node.style.height = dims.y + "px";

  var adjustment = Vector.subtract(dims, Metrics.getDims(node));

  if (!adjustment.isZero()) {
    dims = Vector.add(dims, adjustment);

    node.style.width = dims.x + "px";
    node.style.height = dims.y + "px";
  }
};

Metrics.getInnerWidth = function (node) {
  if (node.clientWidth !== undefined) {
    return node.clientWidth;
  } else if (node.width !== undefined) {
    return node.width;
  } else {
    throw "Metrics.getInnerWidth doesn't work in this browser";
  }
};

Metrics.getInnerHeight = function (node) {
  if (node.clientHeight !== undefined) {
    return node.clientHeight;
  } else if (node.height !== undefined) {
    return node.height;
  } else {
    throw "Metrics.getInnerHeight doesn't work in this browser";
  }
};

Metrics.getInnerDims = function (node) {
  var width, height;

  if (node.clientWidth !== undefined) {
    width = node.clientWidth;
    height = node.clientHeight;
  } else if (node.width !== undefined) {
    width = node.width;
    height = node.height;
  } else {
    throw "Metrics.getInnerDims doesn't work in this browser";
  }

  return new Metrics.Vector(width, height);
};

Metrics.getOffsetLeft = function (node) {
  return node.offsetLeft;
};

Metrics.getOffsetTop = function (node) {
  return node.offsetTop;
};

Metrics.getOffsetPos = function (node) {
  return new Metrics.Vector(node.offsetLeft, node.offsetTop);
};

Metrics.getOffsetRect = function (node) {
  return new Metrics.Rectangle(Metrics.getOffsetPos(node), Metrics.getDims(node));
};

Metrics.setOffsetPos = function (node, pos) {
  node.style.left = pos.x + "px";
  node.style.top = pos.y + "px";
};

Metrics.setOffsetRect = function (node, rect) {
  Metrics.setOffsetPos(node, rect.pos);
  Metrics.setDims(node, rect.dims);
};

Metrics.getLeft = function (node) {
  var x = 0;

  do {
    x += node.offsetLeft;
    node = node.offsetParent;
  } while (node);

  return x;
};

Metrics.getTop = function (node) {
  var y = 0;

  do {
    y += node.offsetTop;
    node = node.offsetParent;
  } while (node);

  return y;
};

Metrics.getPos = function (node) {
  var x = 0;
  var y = 0;

  do {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  } while (node);

  return new Metrics.Vector(x, y);
};

Metrics.getRect = function (node) {
  return new Metrics.Rectangle(Metrics.getPos(node), Metrics.getDims(node));
};

Metrics.setPos = function (node, pos) {
  if (node.offsetParent) {
    var offsetPos = Vector.subtract(pos, Metrics.getPos(node.offsetParent));
    Metrics.setOffsetPos(node, offsetPos);
  } else {
    Metrics.setOffsetPos(node, pos);
  }
};

Metrics.setRect = function (node, rect) {
  Metrics.setPos(node, rect.pos);
  Metrics.setDims(node, rect.dims);
};
