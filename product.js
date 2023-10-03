/**
 * Abstraction of the product needed to build an acid sphere.
 *
 * @author   popitch@yandex.ru
 */

Product = function (params) {
  $.extend(this, params);
  this.cache = {};
}
  .override({
    // calculation accuracy
    //PRECISION: 10000,
    //round: function(value) {
    //	return Math.round(value * this.PRECISION) / this.PRECISION;
    //},

    // @return string that defines the product
    unify: function () {
      console.log(['abstract method unify()', this]);
    },

    // @return figure that defines the product
    model: function () {
      //console.log(['abstract method model()', this]); //alcohol yad
      // default null model
      return null;
    },

    // draw product scheme on canvas
    //plot: function(canvas){},

    // product meter
    meter: function () {
      return {};
    }
  })
  .statics({
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    index: function (type, order) {
      if (type == 'line')
        return (order >= 26 ? Product.index(type, Math.floor(order / 26) - 1) : '') + Product.characters[order % 26];
      else
        return order + 1;
    },

    selectChain: function (chain, nodeAttrScalar, cyclic, bilateral) {
      chain = $(chain).get();

      function breaked(i) {
        var sample = chain.slice(i).concat(chain.slice(0, i));

        var arr = sample.slice();
        var forward = [], el, i = 0;
        do {
          if (el = arr.shift()) {
            forward.push({
              forward: true,
              sequence: forward,
              i: i++,
              node: el
            });
          }
        } while (el && !el.terminate);
        forward[0].node.dontStart ||
          list.push(forward);

        if (!bilateral) {
          arr = sample.slice();
          var reversed = [];
          i = 0;
          do {
            if (el = arr.pop()) {
              reversed.push({
                forward: false,
                sequence: reversed,
                i: i++,
                node: el
              });
            }
          } while (el && !el.terminate);
          reversed[0].node.dontStart ||
            list.push(reversed);
        }
      };

      var list = [];
      cyclic ? $(chain).each(breaked) : breaked(0);

      function zeroDetector(v) {
        return (Math.abs(v) < 1e-5) ? 0 : v;
      }

      var cmp;
      switch (typeof nodeAttrScalar) {
        case 'string':
          cmp = function (a, b) {
            return zeroDetector(b.node[nodeAttrScalar] - a.node[nodeAttrScalar]);
          };
          break;
        case 'function':
          cmp = function (a, b) {
            return zeroDetector(
              nodeAttrScalar.call(b.node, b.i, b.sequence, b.forward) -
              nodeAttrScalar.call(a.node, a.i, a.sequence, a.forward));
          };
          break;
        default:
          console.log('Product.selectChain(): wrong comparator')
      }

      // caching sequences of actual values
      $.map(list, function (seq) {
        seq.used = $.map(seq, function (a) {
          return a.node.sortIgnore ? null : a;
        });
      });

      // get sorted first
      // TODO: use one-cicle algorithm to search
      var selected = list.sort(function (A, B) {
        if (B.used.length - A.used.length)
          return (B.used.length - A.used.length);

        for (
          var i = 0, res = 0;
          i < A.used.length && !(res = cmp(A.used[i], B.used[i]));
          i++
        );

        return res;
      })[0];

      return $(selected).map(function () {
        this.node.forward = this.forward;
        return this.node;
      }).get();
    },

    // number unifiers
    ANGLE_PRECISION: 0.1, // degrees
    LENGTH_PRECISION: 0.001, // m (to 1 mm)

    angleUnify: function (angle) {
      angle = angle * 180 / Math.PI;
      return Math.round(angle / Product.ANGLE_PRECISION);
    },

    lengthUnify: function (length) {
      return Math.round(length / Product.LENGTH_PRECISION);
    }
  });